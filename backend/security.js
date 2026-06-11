const fs = require('fs');
const path = require('path');

// 安全日志目录
const LOG_DIR = path.join(__dirname, 'security-logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 速率限制存储
const rateLimitStore = new Map();

// 登录失败存储
const loginFailures = new Map();

// 注册限制存储
const registerAttempts = new Map();

// 清理过期项
function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, data] of rateLimitStore) {
    if (data.expiresAt < now) {
      rateLimitStore.delete(key);
    }
  }
  for (const [key, data] of loginFailures) {
    if (data.expiresAt < now) {
      loginFailures.delete(key);
    }
  }
  for (const [key, data] of registerAttempts) {
    if (data.expiresAt < now) {
      registerAttempts.delete(key);
    }
  }
}

// 定期清理
setInterval(cleanupRateLimits, 60000);

// 通用速率限制中间件
function rateLimitMiddleware(options = {}) {
  const {
    windowMs = 60000,
    max = 100,
    message = '请求过于频繁，请稍后再试',
    skipPaths = [] // 排除的路径列表
  } = options;

  return (req, res, next) => {
    // 对心跳、未读数等轮询接口排除速率限制
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const key = req.ip || req.socket.remoteAddress;
    const now = Date.now();
    
    let data = rateLimitStore.get(key);
    if (!data || data.windowStart < now - windowMs) {
      data = {
        count: 1,
        windowStart: now,
        expiresAt: now + windowMs
      };
    } else {
      data.count++;
    }
    rateLimitStore.set(key, data);

    if (data.count > max) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        ip: key,
        path: req.path,
        count: data.count,
        limit: max
      });
      return res.status(429).json({ message });
    }

    next();
  };
}

// 注册限制（每个IP只能注册一次）
function registerLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress;

  // 检查该IP是否已经注册过
  if (registerAttempts.has(key)) {
    logSecurityEvent('REGISTER_LIMIT_EXCEEDED', {
      ip: key
    });
    return res.status(429).json({ 
      message: '该设备/IP已注册过账号，如需帮助请联系管理员' 
    });
  }

  next();
}

// 登录失败限制（3次失败锁定5分钟）
function loginLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress;
  const now = Date.now();

  const failure = loginFailures.get(key);
  if (failure && failure.lockedUntil > now) {
    const remaining = Math.ceil((failure.lockedUntil - now) / 1000);
    logSecurityEvent('LOGIN_LOCKED', {
      ip: key,
      remainingSeconds: remaining
    });
    return res.status(429).json({ 
      message: `登录失败次数过多，请${remaining}秒后再试` 
    });
  }

  req.onLoginFailure = () => {
    const existing = loginFailures.get(key);
    if (!existing) {
      // 第1次失败
      loginFailures.set(key, {
        count: 1,
        lockedUntil: null,
        expiresAt: now + 10 * 60 * 1000
      });
    } else {
      existing.count++;
      // 达到3次失败，锁定5分钟
      if (existing.count >= 3) {
        existing.lockedUntil = now + 5 * 60 * 1000;
        logSecurityEvent('LOGIN_THRESHOLD_EXCEEDED', {
          ip: key,
          failures: existing.count
        });
      }
      existing.expiresAt = now + 10 * 60 * 1000;
    }
  };

  next();
}

// XSS防护 - 转义HTML特殊字符（用于查询参数渲染）
function sanitizeXSS(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// XSS防护中间件 - 仅清理查询参数（用于HTML渲染）
// req.body 不做修改：数据库操作由参数化查询保护，JSON输出由res.json保护，HTML输出由EJS自动转义
function xssProtection(req, res, next) {
  if (req.query && typeof req.query === 'object') {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeXSS(req.query[key]);
      }
    }
  }
  next();
}

// SQL注入检测 - 仅检测真正的注入攻击模式
// 参数化查询已由 mysql2 驱动处理，此层作为额外防线
function detectSQLInjection(str) {
  if (typeof str !== 'string') return false;
  const len = str.length;
  if (len === 0) return false;
  const patterns = [
    /;\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE|EXEC)\b/i,  // 堆叠查询
    /\bUNION\s+(ALL\s+)?SELECT\b/i,                      // UNION注入
    /\b(OR|AND)\s+\d+\s*=\s*\d+\s*--/i,                  // 数字比较注入
    /\bWAITFOR\s+DELAY\b/i,                                // 时间盲注
    /\bBENCHMARK\s*\(/i,                                    // 基准测试注入
    /\bSLEEP\s*\(/i,                                       // 睡眠注入
  ];
  return patterns.some(p => p.test(str));
}

// SQL注入防护中间件
function sqlInjectionProtection(req, res, next) {
  const checkObject = (obj) => {
    for (const key in obj) {
      const value = obj[key];
      if (typeof value === 'string' && detectSQLInjection(value)) {
        logSecurityEvent('SQL_INJECTION_ATTEMPT', {
          ip: req.ip,
          key,
          value
        });
        return true;
      }
      if (typeof value === 'object' && value !== null) {
        if (checkObject(value)) return true;
      }
    }
    return false;
  };

  if (checkObject(req.query) || checkObject(req.body)) {
    return res.status(400).json({ message: '无效的请求参数' });
  }
  next();
}

// 安全日志记录
let currentLogFile = null;
let logFileStream = null;

function getLogFileName() {
  const now = new Date();
  return `security-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.log`;
}

function getLogFileStream() {
  const fileName = getLogFileName();
  if (currentLogFile !== fileName) {
    if (logFileStream) {
      logFileStream.end();
    }
    currentLogFile = fileName;
    const filePath = path.join(LOG_DIR, fileName);
    logFileStream = fs.createWriteStream(filePath, { flags: 'a' });
  }
  return logFileStream;
}

function logSecurityEvent(type, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = JSON.stringify({
    timestamp,
    type,
    data
  }) + '\n';

  const stream = getLogFileStream();
  stream.write(logEntry);
}

// 不需要自动保存，使用 fs.createWriteStream 自动会 flush

// 记录用户操作
function logUserAction(userId, action, details = {}) {
  logSecurityEvent('USER_ACTION', {
    userId,
    action,
    details,
    timestamp: Date.now()
  });
}

// 记录管理员操作
function logAdminAction(adminId, action, details = {}) {
  logSecurityEvent('ADMIN_ACTION', {
    adminId,
    action,
    details,
    timestamp: Date.now()
  });
}

module.exports = {
  rateLimitMiddleware,
  registerLimit,
  loginLimit,
  xssProtection,
  sqlInjectionProtection,
  sanitizeXSS,
  logSecurityEvent,
  logUserAction,
  logAdminAction,
  registerAttempts  // 导出供server.js使用
};

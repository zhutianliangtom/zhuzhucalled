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

// 每分钟注册统计
const registrationStats = {
  count: 0,
  startTime: Date.now()
};

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
    message = '请求过于频繁，请稍后再试'
  } = options;

  return (req, res, next) => {
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

// 注册限制（10分钟1次）
function registerLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress;
  const now = Date.now();

  // 更新注册统计
  if (now - registrationStats.startTime > 60000) {
    registrationStats.count = 0;
    registrationStats.startTime = now;
  }
  registrationStats.count++;

  // 1分钟超过100次注册，直接拒绝
  if (registrationStats.count > 100) {
    logSecurityEvent('MASS_REGISTRATION_ATTACK', {
      ip: key,
      count: registrationStats.count,
      timeWindow: '1分钟'
    });
    return res.status(429).json({ 
      message: '检测到异常注册行为，请稍后再试' 
    });
  }

  // 单个IP 10分钟内只能注册1次
  const attempt = registerAttempts.get(key);
  if (attempt && now - attempt.lastAttempt < 10 * 60 * 1000) {
    const remaining = Math.ceil((10 * 60 * 1000 - (now - attempt.lastAttempt)) / 1000);
    logSecurityEvent('REGISTER_RATE_LIMIT', {
      ip: key,
      remainingSeconds: remaining
    });
    return res.status(429).json({ 
      message: `注册过于频繁，请${remaining}秒后再试` 
    });
  }

  registerAttempts.set(key, {
    lastAttempt: now,
    expiresAt: now + 10 * 60 * 1000
  });

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
      loginFailures.set(key, {
        count: 1,
        lockedUntil: now + 5 * 60 * 1000,
        expiresAt: now + 10 * 60 * 1000
      });
    } else {
      existing.count++;
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

// XSS防护 - 转义HTML
function sanitizeXSS(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// XSS防护中间件
function xssProtection(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeXSS(req.body[key]);
      }
    }
  }
  if (req.query && typeof req.query === 'object') {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeXSS(req.query[key]);
      }
    }
  }
  next();
}

// SQL注入检测
function detectSQLInjection(str) {
  if (typeof str !== 'string') return false;
  const patterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /\b(AND|OR)\b\s+\d+\s*=\s*\d+/i,
    /\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b/i,
    /\b(EXEC|EXECUTE)\b/i,
    /\b(DECLARE|SET)\b/i
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
  logAdminAction
};

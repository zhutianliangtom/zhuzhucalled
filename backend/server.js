require('express-async-errors')
const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const multer = require('multer')
const cors = require('cors')
const { v4: uuidv4 } = require('uuid')
const path = require('path')
const cookieParser = require('cookie-parser')
const fs = require('fs')
const os = require('os')
const mysql = require('mysql2/promise')
require('dotenv').config()

// ==================== 实时日志功能 ====================
const LOG_DIR = path.join(__dirname, 'server_log')
const LOG_FLUSH_INTERVAL = 30000 // 30秒自动保存

// 创建日志目录
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

// 获取当前日期的日志文件名
function getLogFileName() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}.log`
}

// ANSI 颜色代码
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',    // INFO - 绿色
  yellow: '\x1b[33m',   // WARN - 黄色
  red: '\x1b[31m',      // ERROR - 红色
  cyan: '\x1b[36m'      // 时间戳 - 青色
}

// 先保存原始 console 方法
const originalLog = console.log
const originalError = console.error
const originalWarn = console.warn

// 日志缓冲区：{ '2026-05-31.log': '...lines...', ... }
const logBuffer = {}

// 日志记录函数 - 写入缓冲区，定时批量刷盘
function log(level, ...args) {
  const now = new Date()
  const timestamp = now.toISOString().replace('T', ' ').replace('Z', '')
  const levelStr = level.toUpperCase().padEnd(7)
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 0) : String(arg)
  ).join(' ')

  const logLine = `[${timestamp}] [${levelStr}] ${message}\n`

  // 输出到控制台（带颜色）
  let color = COLORS.green
  if (level === 'error') color = COLORS.red
  if (level === 'warn') color = COLORS.yellow

  const colorLine = `${COLORS.cyan}[${timestamp}]${COLORS.reset} ${color}[${levelStr}]${COLORS.reset} ${message}`
  originalLog(colorLine)

  // 写入缓冲区
  const fileName = getLogFileName()
  if (!logBuffer[fileName]) {
    logBuffer[fileName] = ''
  }
  logBuffer[fileName] += logLine
}

// 刷盘：将缓冲区内容写入磁盘
function flushLogs() {
  const fileNames = Object.keys(logBuffer)
  for (const fileName of fileNames) {
    if (logBuffer[fileName].length > 0) {
      try {
        const filePath = path.join(LOG_DIR, fileName)
        fs.appendFileSync(filePath, logBuffer[fileName], 'utf8')
        logBuffer[fileName] = ''
      } catch (err) {
        originalError('[LOG] 刷盘失败:', err)
      }
    }
  }
}

// 清理旧日期的缓冲区（跨天后旧 key 不再有写入，刷盘后清理）
function cleanBuffer() {
  const today = getLogFileName()
  for (const fileName of Object.keys(logBuffer)) {
    if (fileName !== today && logBuffer[fileName].length === 0) {
      delete logBuffer[fileName]
    }
  }
}

// 定时刷盘
const flushTimer = setInterval(() => {
  flushLogs()
  cleanBuffer()
}, LOG_FLUSH_INTERVAL)

// 覆盖 console 方法，使其也记录到文件
console.log = (...args) => {
  log('info', ...args)
}
console.error = (...args) => {
  log('error', ...args)
}
console.warn = (...args) => {
  log('warn', ...args)
}

// 导入安全模块
const {
  rateLimitMiddleware,
  registerLimit,
  loginLimit,
  xssProtection,
  sqlInjectionProtection,
  logUserAction,
  logAdminAction
} = require('./security')

const app = express()
const port = 5000

// JWT 密钥从环境变量读取，生产环境必须配置强随机字符串
const JWT_SECRET = process.env.JWT_SECRET || 'lost_found_secret_key'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const PUBLIC_HOST = process.env.PUBLIC_HOST || 'chentian.dpdns.org'
// HTTPS 支持：设置 SSL_CERT 和 SSL_KEY 环境变量启用
const USE_HTTPS = !!(process.env.SSL_CERT && process.env.SSL_KEY)
const PUBLIC_PROTO = USE_HTTPS ? 'https' : 'http'
const PUBLIC_BASE = `${PUBLIC_PROTO}://${PUBLIC_HOST}`

const UPLOAD_DIR = path.join(__dirname, 'uploads')
const VIDEO_DIR = path.join(__dirname, 'uploads/videos')
const BACKUP_DIR = path.join(__dirname, 'backups')

// 创建服务器和 WebSocket
let server
if (USE_HTTPS) {
  const https = require('https')
  server = https.createServer({
    cert: fs.readFileSync(process.env.SSL_CERT),
    key: fs.readFileSync(process.env.SSL_KEY)
  }, app)
  // HTTP → HTTPS 重定向
  const redirectServer = http.createServer((req, res) => {
    res.writeHead(301, { Location: `${PUBLIC_BASE}${req.url}` })
    res.end()
  })
  redirectServer.listen(process.env.HTTP_REDIRECT_PORT || 80)
  console.log(`[HTTPS] 已启用 HTTPS，HTTP 重定向监听端口 ${process.env.HTTP_REDIRECT_PORT || 80}`)
} else {
  server = http.createServer(app)
  console.log('[HTTPS] 未配置证书，使用 HTTP 模式')
}

const wss = new WebSocket.Server({ server })

// WebSocket 连接管理
const adminClients = new Set()

// WebSocket 连接处理
wss.on('connection', (ws, req) => {
  console.log('WebSocket 新连接')

  // 验证连接（检查 cookie 中的 token）
  const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=')
    acc[name] = value
    return acc
  }, {})

  if (cookies?.token) {
    try {
      const decoded = jwt.verify(cookies.token, JWT_SECRET)
      pool.query('SELECT * FROM users WHERE id = ?', [decoded.id])
        .then(([rows]) => {
          if (rows.length > 0 && rows[0].isAdmin) {
            // 是管理员，绑定用户信息到 WebSocket 连接
            ws.userId = decoded.id
            ws.studentId = rows[0].studentId
            ws.isAdmin = true
            adminClients.add(ws)
            console.log(`WebSocket 管理员连接: ${rows[0].studentId}`)
            console.log('管理员 WebSocket 连接成功')
            ws.send(JSON.stringify({ type: 'connected', message: '已连接到服务器' }))
          } else {
            ws.close(1008, '无权访问')
          }
        })
        .catch(() => ws.close(1008, '认证失败'))
    } catch (err) {
      ws.close(1008, '认证失败')
    }
  } else {
    ws.close(1008, '需要登录')
  }

  ws.on('close', () => {
    adminClients.delete(ws)
    console.log('WebSocket 连接关闭')
  })

  ws.on('error', (err) => {
    console.error('WebSocket 错误:', err)
    adminClients.delete(ws)
  })
})

// 广播消息给所有管理员
function broadcastToAdmins(message) {
  const messageString = JSON.stringify(message)
  adminClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageString)
      } catch (err) {
        console.error('[WebSocket] 发送消息失败:', err)
        adminClients.delete(client)
      }
    }
  })
}

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true })
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })

// 检查上传目录是否可写
try {
  const testFile = path.join(UPLOAD_DIR, '.write_test')
  fs.writeFileSync(testFile, 'test')
  fs.unlinkSync(testFile)
} catch (e) {
  console.error(`[启动检查] 上传目录不可写: ${UPLOAD_DIR}`, e.message)
}

// 将相对路径/旧URL统一转换为外网完整URL
function getPublicUrl(url) {
  if (!url) return ''
  const publicBase = PUBLIC_BASE
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // 如果已经包含正确的外网地址，直接返回
    if (url.includes(PUBLIC_HOST)) return url
    try {
      const urlObj = new URL(url)
      urlObj.host = PUBLIC_HOST
      return urlObj.toString()
    } catch (e) { return url }
  }
  return publicBase + url
}

// 安全解析 JSON，兼容旧数据中非标准格式（如单 URL 字符串而非数组）
// pool.query() 文本协议会自动解析 MySQL JSON 列为 JS 对象，需兼容
function safeJSONParse(str, fallback = []) {
  // 已经被驱动自动解析为数组/对象，直接返回
  if (Array.isArray(str)) return str
  if (str && typeof str === 'object') return str
  // 空值返回默认值
  if (!str || typeof str !== 'string') return fallback
  try { return JSON.parse(str) } catch (e) {
    if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/')) {
      return [str]
    }
    return fallback
  }
}

// MySQL 连接池 (兼容MySQL 9.7.0)

// 调试：打印环境变量加载情况（已脱敏）
console.log('[配置] MySQL:', process.env.MYSQL_HOST || 'localhost', ':', process.env.MYSQL_PORT || 3306, '/', process.env.MYSQL_DATABASE || 'lost_found')
console.log('[配置] MYSQL_PASSWORD:', process.env.MYSQL_PASSWORD ? '已设置' : '(未设置)')

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'windows10',
  database: process.env.MYSQL_DATABASE || 'lost_found',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  charset: 'utf8mb4',
  ssl: false
})

// MySQL 数据库备份函数
async function backupDatabase() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}.sql`)
    
    console.log(`\n[备份] 开始备份数据库...`)
    
    // 备份所有表
    const tables = ['users', 'items', 'messages', 'versions']
    let sqlContent = `-- 数据库备份: ${new Date().toLocaleString('zh-CN')}\n-- 数据库: lost_found\n\n`
    sqlContent += `SET FOREIGN_KEY_CHECKS=0;\n\n`
    
    for (const table of tables) {
      try {
        // 表结构
        const [createTable] = await pool.query(`SHOW CREATE TABLE ${table}`)
        sqlContent += `-- 表结构: ${table}\n`
        sqlContent += `DROP TABLE IF EXISTS ${table};\n`
        sqlContent += createTable[0]['Create Table'] + ';\n\n'
        
        // 表数据
        const [rows] = await pool.query(`SELECT * FROM ${table}`)
        if (rows.length > 0) {
          sqlContent += `-- 表数据: ${table}\n`
          const columns = Object.keys(rows[0])
          sqlContent += `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n`
          
          const values = rows.map(row => {
            return '(' + columns.map(col => {
              const val = row[col]
              if (val === null || val === undefined) return 'NULL'
              if (typeof val === 'boolean') return val ? '1' : '0'
              if (typeof val === 'object') {
                try {
                  return `'${JSON.stringify(val).replace(/'/g, "\\'")}'`
                } catch {
                  return `'${String(val).replace(/'/g, "\\'")}'`
                }
              }
              return `'${String(val).replace(/'/g, "\\'")}'`
            }).join(', ') + ')'
          })
          
          sqlContent += values.join(',\n') + ';\n\n'
        }
      } catch (e) {
        console.log(`[备份] 跳过表 ${table}: ${e.message}`)
      }
    }
    
    sqlContent += `SET FOREIGN_KEY_CHECKS=1;\n`
    
    fs.writeFileSync(backupFile, sqlContent)
    console.log(`[备份] ✅ 备份成功: ${backupFile}`)
    
    // 保留最近7天的备份，删除旧的
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.sql'))
      .sort()
      .reverse()
    
    if (files.length > 7) {
      const toDelete = files.slice(7)
      for (const f of toDelete) {
        try {
          fs.unlinkSync(path.join(BACKUP_DIR, f))
          console.log(`[备份] 🗑️ 删除旧备份: ${f}`)
        } catch {}
      }
    }
    
    return backupFile
  } catch (e) {
    console.error('[备份] ❌ 备份失败:', e)
    return null
  }
}

// 初始化数据库
async function initDatabase() {
  const dbName = process.env.MYSQL_DATABASE || 'lost_found'
  
  // 1. 先连接 MySQL (不指定数据库) 创建数据库
  try {
    console.log('[initDatabase] 准备创建临时连接池')
    console.log('[initDatabase] MYSQL_PASSWORD:', process.env.MYSQL_PASSWORD ? '已设置' : '未设置')
    
    const tempPool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'windows10',
      charset: 'utf8mb4',
      ssl: false
    })
    
    console.log('[initDatabase] 临时连接池创建成功，尝试执行 CREATE DATABASE...')
    
    await tempPool.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    console.log(`[数据库] 已确保数据库 ${dbName} 存在`)
    await tempPool.end()
  } catch (e) {
    console.log('[数据库] 使用已存在的数据库连接')
  }
  
  // 2. 创建所有表
  console.log('[数据库] 开始检查表结构...')
  
  // 检查 users 表的 id 字段类型是否正确
  try {
    const [columns] = await pool.query(
      "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'",
      [dbName]
    )
    
    if (columns.length > 0 && columns[0].DATA_TYPE !== 'varchar') {
      console.log('[数据库] 检测到 users 表结构不兼容，正在重建...')
      await pool.query('DROP TABLE IF EXISTS users')
      await pool.query('DROP TABLE IF EXISTS items')
      await pool.query('DROP TABLE IF EXISTS messages')
      await pool.query('DROP TABLE IF EXISTS versions')
      console.log('[数据库] 已删除旧表')
    }
  } catch (e) {
    console.log('[数据库] 无法检查表结构，将尝试直接创建')
  }
  
  // 表结构定义
  const tables = {
    users: `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      studentId VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20),
      password VARCHAR(255) NOT NULL,
      avatar VARCHAR(500),
      className VARCHAR(100),
      status VARCHAR(20) DEFAULT 'pending',
      blockedUsers JSON,
      isAdmin BOOLEAN DEFAULT FALSE,
      createdAt INT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    
    items: `CREATE TABLE IF NOT EXISTS items (
      id VARCHAR(36) PRIMARY KEY,
      userId VARCHAR(36) NOT NULL,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      type VARCHAR(20) NOT NULL,
      status VARCHAR(20) DEFAULT 'active',
      images JSON,
      contact VARCHAR(100),
      location VARCHAR(200),
      createdAt INT,
      INDEX idx_userId (userId),
      INDEX idx_status (status),
      INDEX idx_type (type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    
    messages: `CREATE TABLE IF NOT EXISTS messages (
      id VARCHAR(36) PRIMARY KEY,
      senderId VARCHAR(36) NOT NULL,
      receiverId VARCHAR(36) NOT NULL,
      content TEXT,
      type VARCHAR(20) DEFAULT 'text',
      mediaUrl TEXT,
      \`read\` BOOLEAN DEFAULT FALSE,
      createdAt INT,
      INDEX idx_senderId (senderId),
      INDEX idx_receiverId (receiverId),
      INDEX idx_read (\`read\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    
    versions: `CREATE TABLE IF NOT EXISTS versions (
      id VARCHAR(36) PRIMARY KEY,
      version VARCHAR(20) NOT NULL,
      versionCode INT DEFAULT 0,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      apkUrl VARCHAR(500),
      fileSize BIGINT,
      forceUpdate BOOLEAN DEFAULT FALSE,
      createdAt INT,
      INDEX idx_version (version),
      INDEX idx_versionCode (versionCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  }
  
  // 逐个创建表
  for (const [tableName, sql] of Object.entries(tables)) {
    try {
      await pool.query(sql)
      console.log(`[数据库] 表 ${tableName} 已确保存在`)
    } catch (e) {
      console.error(`[数据库] 创建表 ${tableName} 失败:`, e.message)
    }
  }
  
  // 3. 添加 isAdmin 字段（如果不存在）
  try {
    await pool.query('ALTER TABLE users ADD COLUMN isAdmin BOOLEAN DEFAULT FALSE')
    console.log('[数据库] 已添加 isAdmin 字段')
  } catch (e) {
    // 字段已存在，忽略错误
  }
  
  // 3.1 添加 className 字段（如果不存在）
  try {
    await pool.query('ALTER TABLE users ADD COLUMN className VARCHAR(100)')
    console.log('[数据库] 已添加 className 字段')
  } catch (e) {
    // 字段已存在，忽略错误
  }
  
  // 3.2 添加 blockedUsers 字段（如果不存在）
  try {
    await pool.query('ALTER TABLE users ADD COLUMN blockedUsers JSON')
    console.log('[数据库] 已添加 blockedUsers 字段')
  } catch (e) {
    // 字段已存在，忽略错误
  }
  
  // 3.3 添加 avatar 字段（如果不存在）
  try {
    await pool.query('ALTER TABLE users ADD COLUMN avatar VARCHAR(500)')
    console.log('[数据库] 已添加 avatar 字段')
  } catch (e) {
    // 字段已存在，忽略错误
  }
  
  // 3.4 添加 status 字段（如果不存在）
  try {
    await pool.query("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'pending'")
    console.log('[数据库] 已添加 status 字段')
  } catch (e) {
    // 字段已存在，忽略错误
  }
  
  // 3.5 添加 phone 字段（如果不存在）
  try {
    await pool.query('ALTER TABLE users ADD COLUMN phone VARCHAR(20)')
    console.log('[数据库] 已添加 phone 字段')
  } catch (e) {
    // 字段已存在，忽略错误
  }
  
  // 3.6 添加 createdAt 字段（如果不存在）
  try {
    await pool.query('ALTER TABLE users ADD COLUMN createdAt INT')
    console.log('[数据库] 已添加 createdAt 字段')
  } catch (e) {
    // 字段已存在，忽略错误
  }
  
  // 3.7 添加 versions 表的 versionCode 字段（如果不存在）
  try {
    await pool.query('ALTER TABLE versions ADD COLUMN versionCode INT DEFAULT 0')
    console.log('[数据库] 已添加 versionCode 字段')
  } catch (e) {
    // 字段已存在，忽略错误
  }

  // 3.7.1 添加 versions 表的 changelog 字段（兼容 initDatabase 中旧名 description）
  try {
    await pool.query('ALTER TABLE versions ADD COLUMN changelog TEXT')
    console.log('[数据库] 已添加 changelog 字段')
  } catch (e) {
    // 字段已存在，忽略错误
  }

  // 3.7.2 复制 description -> changelog（迁移旧数据）
  try {
    const [result] = await pool.query("UPDATE versions SET changelog = description WHERE changelog IS NULL AND description IS NOT NULL")
    if (result.affectedRows > 0) {
      console.log(`[数据库] 已迁移 ${result.affectedRows} 条版本的 description -> changelog`)
    }
  } catch (e) {
    // description 列不存在则忽略
  }

  // 3.7.3 确保 title 列可空（旧 initDatabase 定义 NOT NULL 但接口未传）
  try {
    await pool.query('ALTER TABLE versions MODIFY COLUMN title VARCHAR(200) NULL')
    console.log('[数据库] versions.title 已设为可空')
  } catch (e) { /* 忽略 */ }
  
  // 3.8 迁移 messages 表：重命名 fromUserId -> senderId（修复旧表列名）
  try {
    await pool.query('ALTER TABLE messages RENAME COLUMN fromUserId TO senderId')
    console.log('[数据库] messages 表已迁移: fromUserId -> senderId')
  } catch (e) { /* 列不存在或已迁移，忽略 */ }
  try {
    await pool.query('ALTER TABLE messages RENAME COLUMN toUserId TO receiverId')
    console.log('[数据库] messages 表已迁移: toUserId -> receiverId')
  } catch (e) { /* 列不存在或已迁移，忽略 */ }
  try {
    await pool.query('ALTER TABLE messages RENAME COLUMN isRead TO `read`')
    console.log('[数据库] messages 表已迁移: isRead -> read')
  } catch (e) { /* 列不存在或已迁移，忽略 */ }

  // 3.9 添加 messages 表缺少的 mediaUrl 列
  try {
    await pool.query('ALTER TABLE messages ADD COLUMN mediaUrl TEXT')
    console.log('[数据库] messages 表已添加 mediaUrl 列')
  } catch (e) { /* 列已存在，忽略 */ }

  // 3.10 添加 items 表缺少的 contact 和 location 列
  try {
    await pool.query('ALTER TABLE items ADD COLUMN contact VARCHAR(100)')
    console.log('[数据库] items 表已添加 contact 列')
  } catch (e) { /* 列已存在，忽略 */ }
  try {
    await pool.query('ALTER TABLE items ADD COLUMN location VARCHAR(200)')
    console.log('[数据库] items 表已添加 location 列')
  } catch (e) { /* 列已存在，忽略 */ }

  // 4. 创建或更新管理员账号
  const adminUserId = process.env.ADMIN_USER || 'admin'
  const [rows] = await pool.query('SELECT * FROM users WHERE studentId = ?', [adminUserId])
  if (rows.length === 0) {
    const adminPass = process.env.ADMIN_PASS || 'admin123'
    const hashedPassword = bcrypt.hashSync(adminPass, 10)
    const adminId = uuidv4()
    await pool.query(
      'INSERT INTO users (id, studentId, name, phone, password, className, status, blockedUsers, isAdmin, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [adminId, adminUserId, '管理员', '13800000000', hashedPassword, '管理员', 'approved', '[]', true, Math.floor(Date.now() / 1000)]
    )
    console.log(`[数据库] 已创建默认管理员账号: ${adminUserId} / ${adminPass}`)
  } else {
    // 确保管理员账号的 isAdmin 为 true
    await pool.query('UPDATE users SET isAdmin = TRUE WHERE studentId = ?', [adminUserId])
  }
  
  console.log('[数据库] 初始化完成')
}

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `img_${uuidv4()}${path.extname(file.originalname)}`)
})

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VIDEO_DIR),
  filename: (req, file, cb) => cb(null, `video_${uuidv4()}${path.extname(file.originalname)}`)
})

const ALLOWED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.heif']

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ALLOWED_IMAGE_EXT.includes(ext)) {
      cb(null, true)
    } else {
      console.warn(`[Upload] 拒绝的图片格式: "${ext}", 原始文件名: ${file.originalname}`)
      cb(new Error('只支持图片格式'), false)
    }
  }
})

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (['.mp4', '.mov', '.avi', '.wmv'].includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('只支持视频格式'), false)
    }
  }
})

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))

// 应用安全中间件
// 全局限流：每分钟200次（外网映射共用IP场景），排除心跳、轮询和管理后台
app.use(rateLimitMiddleware({
  windowMs: 60000,
  max: 200,
  message: '请求过于频繁，请稍后再试',
  skipPaths: ['/api/heartbeat', '/messages/unread', '/admin']
}))
app.use(xssProtection)
app.use(sqlInjectionProtection)

// 管理员接口额外速率限制（每分钟300次，处理批量审核）
app.use('/admin', rateLimitMiddleware({
  windowMs: 60000,
  max: 300,
  message: '管理员操作过于频繁，请稍后再试'
}))

// 静态文件：图片和视频
app.use('/uploads', express.static(UPLOAD_DIR))
app.use('/uploads/videos', express.static(VIDEO_DIR))

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ message: '未授权' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    // 验证用户是否存在且状态正常
    const [rows] = await pool.query(
      'SELECT id, studentId, status FROM users WHERE id = ?',
      [decoded.id]
    )
    if (rows.length === 0) {
      return res.status(401).json({ message: '用户不存在，请重新登录' })
    }
    if (rows[0].status !== 'approved') {
      return res.status(403).json({ message: '账号待审核或已被拒绝，请联系管理员' })
    }
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ message: 'token无效' })
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp * 1000)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

app.get('/', (req, res) => res.redirect('/admin/login'))

app.get('/admin/login', (req, res) => res.render('login', { error: null }))

app.post('/admin/login', async (req, res) => {
  const { studentId, password } = req.body
  const [rows] = await pool.query('SELECT * FROM users WHERE studentId = ?', [studentId])
  const user = rows[0]

  if (!user || !bcrypt.compareSync(password, user.password)) {
    console.log(`[ADMIN LOGIN FAILED] 学号: ${studentId}, IP: ${req.ip}`)
    return res.render('login', { error: '用户名或密码错误' })
  }

  // 检查用户是否是管理员
  if (!user.isAdmin) {
    console.log(`[ADMIN LOGIN FAILED] 非管理员尝试登录: ${studentId}, IP: ${req.ip}`)
    return res.render('login', { error: '请使用管理员账号登录' })
  }

  const token = jwt.sign({ id: user.id, studentId: user.studentId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
  res.cookie('token', token, { httpOnly: true })
  console.log(`[ADMIN LOGIN SUCCESS] 管理员: ${user.name} (${studentId}), IP: ${req.ip}`)
  logAdminAction(user.id, 'ADMIN_LOGIN', { studentId, ip: req.ip })
  res.redirect('/admin/dashboard')
})

app.get('/admin/logout', (req, res) => {
  res.clearCookie('token')
  res.redirect('/admin/login')
})

function authMiddleware(req, res, next) {
  const token = req.cookies.token
  if (!token) return res.redirect('/admin/login')

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    // 验证用户是否存在且是管理员
    pool.query('SELECT * FROM users WHERE id = ?', [decoded.id])
      .then(([rows]) => {
        if (rows.length === 0 || !rows[0].isAdmin) {
          return res.redirect('/admin/login')
        }
        req.user = rows[0]
        next()
      })
      .catch(() => res.redirect('/admin/login'))
  } catch (err) {
    res.redirect('/admin/login')
  }
}

app.get('/admin/dashboard', authMiddleware, async (req, res) => {
  const [[{ totalItems }]] = await pool.query('SELECT COUNT(*) AS totalItems FROM items')
  const [[{ activeItems }]] = await pool.query("SELECT COUNT(*) AS activeItems FROM items WHERE status = 'active'")
  const [[{ solvedItems }]] = await pool.query("SELECT COUNT(*) AS solvedItems FROM items WHERE status = 'solved'")
  const [[{ lostItems }]] = await pool.query("SELECT COUNT(*) AS lostItems FROM items WHERE type = 'lost' AND status = 'active'")
  const [[{ foundItems }]] = await pool.query("SELECT COUNT(*) AS foundItems FROM items WHERE type = 'found' AND status = 'active'")
  const [[{ lostSolved }]] = await pool.query("SELECT COUNT(*) AS lostSolved FROM items WHERE type = 'lost' AND status = 'solved'")
  const [[{ foundSolved }]] = await pool.query("SELECT COUNT(*) AS foundSolved FROM items WHERE type = 'found' AND status = 'solved'")
  const [[{ totalUsers }]] = await pool.query(`SELECT COUNT(*) AS totalUsers FROM users WHERE status = 'approved' AND isAdmin = FALSE`)
  const [[{ pendingUsers }]] = await pool.query("SELECT COUNT(*) AS pendingUsers FROM users WHERE status = 'pending'")

  // 获取服务器时间和问候语
  const now = new Date()
  const hour = now.getHours()
  let greeting = '你好'
  if (hour < 12) greeting = '早上好'
  else if (hour < 18) greeting = '下午好'
  else greeting = '晚上好'

  res.render('dashboard', { 
    totalItems, activeItems, solvedItems, lostItems, foundItems, 
    lostSolved, foundSolved, totalUsers, pendingUsers,
    adminName: req.user.name,
    greeting: greeting,
    serverTime: now.toLocaleString('zh-CN')
  })
})

app.get('/admin/items', authMiddleware, async (req, res) => {
  const { page = 1, type = 'all', status = 'all', keyword = '' } = req.query
  const pageSize = 10
  const offset = (page - 1) * pageSize

  let where = '1=1'
  const params = []
  if (type !== 'all') { where += ' AND i.type = ?'; params.push(type) }
  if (status !== 'all') { where += ' AND i.status = ?'; params.push(status) }
  if (keyword) { where += ' AND (i.title LIKE ? OR i.description LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`) }

  const limit = parseInt(pageSize)
  const offsetVal = parseInt(offset)

  const [rows] = await pool.query(
    `SELECT i.*, u.name AS userName, u.phone AS userPhone FROM items i LEFT JOIN users u ON i.userId = u.id WHERE ${where} ORDER BY i.createdAt DESC LIMIT ${limit} OFFSET ${offsetVal}`,
    params
  )

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM items i WHERE ${where}`, params)
  const totalPages = Math.ceil(total / pageSize)

  const items = rows.map(item => ({ ...item, createdAt: formatTime(item.createdAt), images: safeJSONParse(item.images) }))
  res.render('items', { items, totalPages, currentPage: parseInt(page), type, status, keyword })
})

app.post('/admin/items/delete/:id', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM items WHERE id = ?', [req.params.id])
  res.json({ success: true })
})

// 批量删除物品
app.post('/admin/items/batch-delete', authMiddleware, async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: '请选择要删除的物品' })
  }
  const placeholders = ids.map(() => '?').join(',')
  await pool.query(`DELETE FROM items WHERE id IN (${placeholders})`, ids)
  res.json({ success: true, count: ids.length })
})

app.get('/admin/versions', authMiddleware, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM versions ORDER BY createdAt DESC')
  const versions = rows.map(v => ({ ...v, createdAt: formatTime(v.createdAt) }))
  res.render('versions', { versions })
})

app.get('/admin/users', authMiddleware, async (req, res) => {
  const { page = 1, keyword = '', status = 'all' } = req.query
  const pageSize = 10
  const offset = (page - 1) * pageSize

  // 不排除管理员账号，以便在列表中可以看到并管理
  let where = '1=1'
  const params = []
  if (status !== 'all') { where += ' AND status = ?'; params.push(status) }
  if (keyword) { where += ' AND (studentId LIKE ? OR name LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`) }

  const limit = parseInt(pageSize)
  const offsetVal = parseInt(offset)

  const [rows] = await pool.query(
    `SELECT * FROM users WHERE ${where} ORDER BY isAdmin DESC, createdAt DESC LIMIT ${limit} OFFSET ${offsetVal}`,
    params
  )

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users WHERE ${where}`, params)
  const totalPages = Math.ceil(total / pageSize)

  const users = rows.map(u => ({
    ...u,
    createdAt: formatTime(u.createdAt),
    avatar: getPublicUrl(u.avatar)
  }))
  res.render('users', { users, totalPages, currentPage: parseInt(page), keyword, status, currentAdminId: req.user.id })
})

app.post('/admin/users/approve/:id', authMiddleware, async (req, res) => {
  // 先获取用户信息以便记录日志
  const [rows] = await pool.query('SELECT studentId, name FROM users WHERE id = ?', [req.params.id])
  const user = rows[0]
  await pool.query("UPDATE users SET status = 'approved' WHERE id = ?", [req.params.id])
  console.log(`[ADMIN ACTION] 管理员 ${req.user.name} 已通过用户审核: ${user?.name} (${user?.studentId})`)
  logAdminAction(req.user.id, 'APPROVE_USER', { userId: req.params.id, studentId: user?.studentId, name: user?.name })
  res.json({ success: true })
})

app.post('/admin/users/reject/:id', authMiddleware, async (req, res) => {
  // 先获取用户信息以便记录日志
  const [rows] = await pool.query('SELECT studentId, name FROM users WHERE id = ?', [req.params.id])
  const user = rows[0]
  await pool.query("UPDATE users SET status = 'rejected' WHERE id = ?", [req.params.id])
  console.log(`[ADMIN ACTION] 管理员 ${req.user.name} 已拒绝用户审核: ${user?.name} (${user?.studentId})`)
  logAdminAction(req.user.id, 'REJECT_USER', { userId: req.params.id, studentId: user?.studentId, name: user?.name })
  res.json({ success: true })
})

app.post('/admin/users/delete/:id', authMiddleware, async (req, res) => {
  // 不能删除自己
  if (req.params.id === req.user.id) {
    return res.status(400).json({ success: false, message: '不能删除自己的账号' })
  }
  // 先获取用户信息以便记录日志
  const [rows] = await pool.query('SELECT studentId, name FROM users WHERE id = ?', [req.params.id])
  const user = rows[0]
  await pool.query('DELETE FROM users WHERE id = ?', [req.params.id])
  console.log(`[ADMIN ACTION] 管理员 ${req.user.name} 已删除用户: ${user?.name} (${user?.studentId})`)
  logAdminAction(req.user.id, 'DELETE_USER', { userId: req.params.id, studentId: user?.studentId, name: user?.name })
  res.json({ success: true })
})

// 批量删除用户
app.post('/admin/users/batch-delete', authMiddleware, async (req, res) => {
  const { userIds } = req.body
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ success: false, message: '请选择要删除的用户' })
  }

  // 不能删除自己
  const filteredIds = userIds.filter(id => id !== req.user.id)
  
  if (filteredIds.length === 0) {
    return res.status(400).json({ success: false, message: '不能删除自己的账号' })
  }

  // 获取被删除用户的信息用于日志
  const placeholders = filteredIds.map(() => '?').join(',')
  const [userRows] = await pool.query(`SELECT id, studentId, name FROM users WHERE id IN (${placeholders})`, filteredIds)
  const deletedUsers = userRows.map(u => `${u.name} (${u.studentId})`).join(', ')
  
  await pool.query(`DELETE FROM users WHERE id IN (${placeholders})`, filteredIds)
  
  console.log(`[ADMIN ACTION] 管理员 ${req.user.name} 已批量删除 ${filteredIds.length} 个用户: ${deletedUsers}`)
  logAdminAction(req.user.id, 'BATCH_DELETE_USERS', { userIds: filteredIds, count: filteredIds.length })
  res.json({ success: true, count: filteredIds.length })
})

// 设置/取消管理员
app.post('/admin/users/toggle-admin/:id', authMiddleware, async (req, res) => {
  // 不能修改自己的管理员状态
  if (req.params.id === req.user.id) {
    return res.status(400).json({ success: false, message: '不能修改自己的管理员状态' })
  }
  
  // 先获取当前用户的状态
  const [rows] = await pool.query('SELECT studentId, name, isAdmin FROM users WHERE id = ?', [req.params.id])
  if (rows.length === 0) {
    return res.status(404).json({ success: false, message: '用户不存在' })
  }
  
  const user = rows[0]
  const newStatus = !user.isAdmin
  const action = newStatus ? '设为管理员' : '取消管理员'
  
  await pool.query('UPDATE users SET isAdmin = ? WHERE id = ?', [newStatus, req.params.id])
  console.log(`[ADMIN ACTION] 管理员 ${req.user.name} 已${action}用户: ${user.name} (${user.studentId})`)
  logAdminAction(req.user.id, 'TOGGLE_ADMIN', { userId: req.params.id, studentId: user.studentId, name: user.name, newStatus })
  res.json({ success: true, isAdmin: newStatus })
})

// 管理员创建新用户
app.post('/admin/users/create', authMiddleware, async (req, res) => {
  try {
    const { studentId, name, password, className, phone } = req.body
    
    // 验证必填字段
    if (!studentId || !name || !password) {
      return res.status(400).json({ success: false, message: '学号、姓名和密码为必填项' })
    }
    
    // 检查学号是否已存在
    const [existing] = await pool.query('SELECT id FROM users WHERE studentId = ?', [studentId])
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: '该学号已被注册' })
    }
    
    // 密码哈希处理
    const hashedPassword = bcrypt.hashSync(password, 10)
    const userId = uuidv4()
    const createdAt = Math.floor(Date.now() / 1000)
    
    // 插入新用户（默认状态为 approved）
    await pool.query(
      'INSERT INTO users (id, studentId, name, phone, password, className, status, blockedUsers, isAdmin, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [userId, studentId, name, phone || '', hashedPassword, className || '', 'approved', '[]', false, createdAt]
    )
    
    console.log(`[ADMIN ACTION] 管理员 ${req.user.name} 创建新用户: ${name} (${studentId})`)
    logAdminAction(req.user.id, 'CREATE_USER', { userId, studentId, name })
    
    res.json({ 
      success: true, 
      message: '用户创建成功',
      data: { id: userId, studentId, name, className, phone, status: 'approved' }
    })
  } catch (error) {
    console.error('[ERROR] 创建用户失败:', error)
    res.status(500).json({ success: false, message: '创建用户失败，请稍后重试' })
  }
})

app.post('/auth/register', registerLimit, async (req, res) => {
  const { studentId, name, phone, password, className, avatar } = req.body

  if (!studentId || !name || !phone || !password || !className) {
    return res.status(400).json({ message: '请填写完整信息' })
  }

  const [existing] = await pool.query('SELECT 1 FROM users WHERE studentId = ?', [studentId])
  if (existing.length > 0) {
    return res.status(400).json({ message: '该学号已被注册' })
  }

  const id = uuidv4()
  const hashedPassword = bcrypt.hashSync(password, 10)
  const createdAt = Math.floor(Date.now() / 1000)

  await pool.query(
    'INSERT INTO users (id, studentId, name, phone, password, avatar, className, status, blockedUsers, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, studentId, name, phone, hashedPassword, avatar || '', className, 'pending', '[]', createdAt]
  )

  logUserAction(id, 'USER_REGISTER', { studentId, name })
  res.json({ message: '注册成功，请等待管理员审核' })
})

app.post('/auth/login', loginLimit, async (req, res) => {
  const { studentId, password } = req.body
  const [rows] = await pool.query('SELECT * FROM users WHERE studentId = ?', [studentId])
  const user = rows[0]

  if (!user || !bcrypt.compareSync(password, user.password)) {
    if (req.onLoginFailure) req.onLoginFailure()
    return res.status(400).json({ message: '学号或密码错误' })
  }

  if (user.status !== 'approved') {
    return res.status(400).json({ message: '账号待审核或已被拒绝，请联系管理员' })
  }

  const token = jwt.sign({ id: user.id, studentId: user.studentId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
  const avatarUrl = getPublicUrl(user.avatar)
  
  logUserAction(user.id, 'USER_LOGIN', { studentId })
  res.json({
    token,
    user: {
      id: user.id,
      studentId: user.studentId,
      name: user.name,
      phone: user.phone,
      avatar: avatarUrl,
      className: user.className
    }
  })
})

app.get('/auth/me', authenticateToken, async (req, res) => {
  const [rows] = await pool.query('SELECT id, studentId, name, phone, avatar, className FROM users WHERE id = ?', [req.user.id])
  if (rows.length === 0) return res.status(404).json({ message: '用户不存在' })
  const user = rows[0]
  user.avatar = getPublicUrl(user.avatar)
  res.json({ data: user })
})

// 兼容前端 /user/info 接口
app.get('/user/info', authenticateToken, async (req, res) => {
  const [rows] = await pool.query('SELECT id, studentId, name, phone, avatar, className FROM users WHERE id = ?', [req.user.id])
  if (rows.length === 0) return res.status(404).json({ message: '用户不存在' })
  const user = rows[0]
  user.avatar = getPublicUrl(user.avatar)
  res.json({ data: user })
})

app.put('/user/info', authenticateToken, async (req, res) => {
  const allowedFields = ['name', 'phone', 'avatar', 'className']
  const setClauses = []
  const values = []

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      setClauses.push(`${field} = ?`)
      values.push(req.body[field])
    }
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ success: false, message: '没有要更新的字段' })
  }

  values.push(req.user.id)
  await pool.query(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`, values)
  res.json({ success: true, message: '更新成功' })
})

app.post('/items', authenticateToken, imageUpload.array('images', 5), async (req, res) => {
  const { title, description, type, contact, location, images: imageUrls } = req.body
  
  // 先验证用户是否存在
  const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [req.user.id])
  if (userRows.length === 0) {
    return res.status(401).json({ message: '用户不存在，请重新登录' })
  }
  
  let images = []

  // 优先使用前端传来的图片URL（已上传的情况）
  if (imageUrls && Array.isArray(imageUrls)) {
    images = imageUrls
  }
  // 否则使用multer上传的文件
  else if (req.files && req.files.length > 0) {
    images = req.files.map(f => `${PUBLIC_BASE}/uploads/${f.filename}`)
  }

  if (!title || !type) {
    return res.status(400).json({ message: '请填写标题和类型' })
  }

  const id = uuidv4()
  const createdAt = Math.floor(Date.now() / 1000)

  await pool.query(
    'INSERT INTO items (id, userId, title, description, type, status, images, contact, location, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, req.user.id, title, description || '', type, 'active', JSON.stringify(images), contact || '', location || '', createdAt]
  )

  res.json({ success: true, message: '发布成功' })
})

app.get('/items', async (req, res) => {
  try {
    const { page = 1, type = 'all', keyword = '', timeRange = 'all' } = req.query
    const pageSize = 10
    const offset = (page - 1) * pageSize

    let where = "i.status = 'active'"
    const params = []
    if (type !== 'all') { where += ' AND i.type = ?'; params.push(type) }
    if (keyword) { where += ' AND (i.title LIKE ? OR i.description LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`) }

    // 时间筛选
    const now = Math.floor(Date.now() / 1000)
    if (timeRange === 'day') {
      where += ' AND i.createdAt >= ?'
      params.push(now - 86400) // 24小时
    } else if (timeRange === 'week') {
      where += ' AND i.createdAt >= ?'
      params.push(now - 604800) // 7天
    } else if (timeRange === 'month') {
      where += ' AND i.createdAt >= ?'
      params.push(now - 2592000) // 30天
    }

    const limit = parseInt(pageSize)
    const offsetVal = parseInt(offset)

    const [rows] = await pool.query(
      `SELECT i.*, u.name AS userName, u.phone AS userPhone FROM items i LEFT JOIN users u ON i.userId = u.id WHERE ${where} ORDER BY i.createdAt DESC LIMIT ${limit} OFFSET ${offsetVal}`,
      params
    )

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM items i WHERE ${where}`, params)

    const items = rows.map(item => {
      const images = safeJSONParse(item.images).map(getPublicUrl)
      item.userName = item.userName && item.userName.trim() !== '' ? item.userName : '未知用户'
      return { ...item, images }
    })
    res.json({ data: items, total, page: parseInt(page), pageSize })
  } catch (err) {
    console.error('[API] /items 查询失败:', err.message || err, err.stack)
    console.error('[API] 请求参数:', req.query)
    res.status(500).json({ message: '服务器错误，请稍后重试' })
  }
})

app.get('/items/:id', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT i.*, u.name AS userName, u.phone AS userPhone, u.avatar AS userAvatar, u.className AS userClassName FROM items i LEFT JOIN users u ON i.userId = u.id WHERE i.id = ?',
    [req.params.id]
  )
  if (rows.length === 0) return res.status(404).json({ message: '物品不存在' })

  const item = rows[0]
  item.images = safeJSONParse(item.images).map(getPublicUrl)
  item.userName = item.userName && item.userName.trim() !== '' ? item.userName : '未知用户'
  item.userPhone = item.userPhone || null
  item.userClassName = item.userClassName || null
  item.userAvatar = getPublicUrl(item.userAvatar)
  
  console.log('物品详情 - 发布者信息:', { userName: item.userName, userId: item.userId, userAvatar: item.userAvatar })
  
  res.json({ data: item })
})

app.post('/items/:id/solve', authenticateToken, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM items WHERE id = ?', [req.params.id])
  if (rows.length === 0) return res.status(404).json({ message: '物品不存在' })

  const item = rows[0]
  if (item.userId !== req.user.id) {
    return res.status(403).json({ message: '无权操作' })
  }

  await pool.query("UPDATE items SET status = 'solved' WHERE id = ?", [req.params.id])
  res.json({ success: true, message: '已标记为已解决' })
})

app.put('/items/:id', authenticateToken, imageUpload.array('images', 5), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM items WHERE id = ?', [req.params.id])
  if (rows.length === 0) return res.status(404).json({ message: '物品不存在' })

  const item = rows[0]
  if (item.userId !== req.user.id) {
    return res.status(403).json({ message: '无权操作' })
  }

  const { title, description, type, contact, location } = req.body
  let images = safeJSONParse(item.images)
  
  // 如果有新上传的图片，添加到列表
  if (req.files && req.files.length > 0) {
    const newImages = req.files.map(f => `${PUBLIC_BASE}/uploads/${f.filename}`)
    images = [...images, ...newImages]
  }

  await pool.query(
    'UPDATE items SET title = ?, description = ?, type = ?, contact = ?, location = ?, images = ? WHERE id = ?',
    [title || item.title, description || item.description, type || item.type, contact || item.contact, location || item.location, JSON.stringify(images), req.params.id]
  )

  res.json({ success: true, message: '更新成功' })
})

app.delete('/items/:id', authenticateToken, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM items WHERE id = ?', [req.params.id])
  if (rows.length === 0) return res.status(404).json({ message: '物品不存在' })

  const item = rows[0]
  if (item.userId !== req.user.id) {
    return res.status(403).json({ message: '无权操作' })
  }

  await pool.query('DELETE FROM items WHERE id = ?', [req.params.id])
  res.json({ success: true, message: '删除成功' })
})

app.post('/upload/image', authenticateToken, imageUpload.single('image'), (req, res) => {
  if (!req.file) {
    console.warn('[Upload] 图片上传失败: 未收到文件, Content-Type:', req.headers['content-type'])
    return res.status(400).json({ message: '请上传图片' })
  }
  console.log(`[Upload] 图片上传成功: ${req.file.filename} (${(req.file.size / 1024).toFixed(1)}KB)`)
  res.json({ url: `${PUBLIC_BASE}/uploads/${req.file.filename}` })
})

// 注册用头像上传（无需登录，受注册频率限制保护）
const avatarUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 头像限2MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ALLOWED_IMAGE_EXT.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('只支持图片格式'), false)
    }
  }
})
app.post('/upload/avatar', avatarUpload.single('image'), (req, res) => {
  if (!req.file) {
    console.warn('[Upload] 头像上传失败: 未收到文件, Content-Type:', req.headers['content-type'])
    return res.status(400).json({ message: '请上传图片' })
  }
  console.log(`[Upload] 头像上传成功: ${req.file.filename} (${(req.file.size / 1024).toFixed(1)}KB)`)
  res.json({ url: `${PUBLIC_BASE}/uploads/${req.file.filename}` })
})

app.post('/upload/video', authenticateToken, videoUpload.single('video'), (req, res) => {
  if (!req.file) {
    console.warn('[Upload] 视频上传失败: 未收到文件, Content-Type:', req.headers['content-type'])
    return res.status(400).json({ message: '请上传视频' })
  }
  console.log(`[Upload] 视频上传成功: ${req.file.filename} (${(req.file.size / (1024*1024)).toFixed(1)}MB)`)
  res.json({ url: `${PUBLIC_BASE}/uploads/videos/${req.file.filename}` })
})

app.get('/messages/unread/count', authenticateToken, async (req, res) => {
  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM messages WHERE receiverId = ? AND `read` = FALSE', [req.user.id])
  res.json({ data: { count: rows[0].count } })
})

app.get('/messages/conversation/:userId', authenticateToken, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT m.*, u.name AS senderName, u.avatar AS senderAvatar FROM messages m LEFT JOIN users u ON m.senderId = u.id WHERE (m.senderId = ? AND m.receiverId = ?) OR (m.senderId = ? AND m.receiverId = ?) ORDER BY m.createdAt ASC',
    [req.user.id, req.params.userId, req.params.userId, req.user.id]
  )

  const messages = rows.map(m => ({
    ...m,
    createdAt: m.createdAt * 1000,
    senderName: m.senderName && m.senderName.trim() !== '' ? m.senderName : '未知用户',
    senderAvatar: getPublicUrl(m.senderAvatar)
  }))
  res.json({ data: messages })
})

// 标记对话已读
app.post('/messages/conversation/:userId/read', authenticateToken, async (req, res) => {
  try {
    // 将该用户发送给我且未读的消息标记为已读
    await pool.query(
      'UPDATE messages SET `read` = TRUE WHERE senderId = ? AND receiverId = ? AND `read` = FALSE',
      [req.params.userId, req.user.id]
    )
    res.json({ success: true })
  } catch (err) {
    console.error('标记已读失败:', err)
    res.status(500).json({ message: '服务器错误' })
  }
})

app.post('/messages/send', authenticateToken, async (req, res) => {
  const { userId, content, type = 'text', mediaUrl = '' } = req.body

  if (!userId || (!content && !mediaUrl)) {
    return res.status(400).json({ message: '参数错误' })
  }

  // 获取发送者信息
  const [senderRows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id])
  const [receiverRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId])
  
  if (receiverRows.length === 0) return res.status(404).json({ message: '用户不存在' })

  const receiver = receiverRows[0]
  const blocked = safeJSONParse(receiver.blockedUsers)
  if (blocked.includes(req.user.id)) {
    return res.status(403).json({ message: '对方已将你拉黑，无法发送消息' })
  }

  const id = uuidv4()
  const createdAt = Math.floor(Date.now() / 1000)

  await pool.query(
    'INSERT INTO messages (id, senderId, receiverId, content, type, mediaUrl, `read`, createdAt) VALUES (?,?,?,?,?,?,?,?)',
    [id, req.user.id, userId, content || '', type, mediaUrl, false, createdAt]
  )

  // 广播新消息通知给所有管理员
  if (senderRows.length > 0) {
    const sender = senderRows[0]
    broadcastToAdmins({
      type: 'new_message',
      data: {
        messageId: id,
        senderId: req.user.id,
        senderName: sender.name || sender.studentId || '未知用户',
        receiverId: userId,
        receiverName: receiver.name || receiver.studentId || '未知用户',
        content: content || '',
        type: type,
        createdAt: new Date(createdAt * 1000).toLocaleString('zh-CN')
      }
    })
  }

  res.json({ success: true, message: { id, senderId: req.user.id, receiverId: userId, content: content || '', type, mediaUrl, read: false, createdAt: createdAt * 1000 } })
})

app.post('/messages/:id/recall', authenticateToken, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM messages WHERE id = ?', [req.params.id])
  if (rows.length === 0) return res.status(404).json({ message: '消息不存在' })

  const msg = rows[0]
  if (msg.senderId !== req.user.id) {
    return res.status(403).json({ message: '无权撤回他人消息' })
  }

  if (msg.type === 'recalled') {
    return res.json({ success: true, message: '已撤回' })
  }

  const now = Math.floor(Date.now() / 1000)
  if (now - msg.createdAt > 120) {
    return res.status(403).json({ message: '超过2分钟，无法撤回' })
  }

  await pool.query("UPDATE messages SET type = 'recalled', content = '', mediaUrl = '' WHERE id = ?", [req.params.id])
  res.json({ success: true, message: '撤回成功' })
})

app.post('/user/block', authenticateToken, async (req, res) => {
  const { userId } = req.body
  if (!userId) return res.status(400).json({ message: '参数错误' })

  const [rows] = await pool.query('SELECT blockedUsers FROM users WHERE id = ?', [req.user.id])
  if (rows.length === 0) return res.status(404).json({ message: '用户不存在' })

  let blocked = safeJSONParse(rows[0]?.blockedUsers)
  if (!blocked.includes(userId)) {
    blocked.push(userId)
    await pool.query('UPDATE users SET blockedUsers = ? WHERE id = ?', [JSON.stringify(blocked), req.user.id])
    
    // 拉黑后删除所有与该用户的对话消息
    await pool.query(
      'DELETE FROM messages WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)',
      [req.user.id, userId, userId, req.user.id]
    )
  }

  res.json({ success: true })
})

app.get('/user/blocked', authenticateToken, async (req, res) => {
  const [rows] = await pool.query('SELECT blockedUsers FROM users WHERE id = ?', [req.user.id])
  const blockedIds = safeJSONParse(rows[0]?.blockedUsers)
  
  if (blockedIds.length === 0) {
    return res.json({ data: [] })
  }
  
  // 获取被拉黑用户的详细信息
  const placeholders = blockedIds.map(() => '?').join(',')
  const [users] = await pool.query(
    `SELECT id, name, avatar FROM users WHERE id IN (${placeholders})`,
    blockedIds
  )
  
  const blockedUsers = users.map(user => ({
    id: user.id,
    name: user.name && user.name.trim() !== '' ? user.name : '未知用户',
    avatar: getPublicUrl(user.avatar)
  }))
  
  res.json({ data: blockedUsers })
})

app.post('/user/unblock', authenticateToken, async (req, res) => {
  const { userId } = req.body
  if (!userId) return res.status(400).json({ message: '参数错误' })

  const [rows] = await pool.query('SELECT blockedUsers FROM users WHERE id = ?', [req.user.id])
  if (rows.length === 0) return res.status(404).json({ message: '用户不存在' })

  let blocked = safeJSONParse(rows[0]?.blockedUsers)
  blocked = blocked.filter(id => id !== userId)
  await pool.query('UPDATE users SET blockedUsers = ? WHERE id = ?', [JSON.stringify(blocked), req.user.id])

  res.json({ success: true, message: '解除拉黑成功' })
})

app.get('/user/search', authenticateToken, async (req, res) => {
  const { keyword } = req.query
  if (!keyword) return res.json({ data: [] })

  const [rows] = await pool.query(
    "SELECT id, name, avatar, className FROM users WHERE status = 'approved' AND id != ? AND (name LIKE ? OR studentId LIKE ?)",
    [req.user.id, `%${keyword}%`, `%${keyword}%`]
  )

  res.json({ data: rows })
})

// 用户统计
app.get('/user/stats', authenticateToken, async (req, res) => {
  const [[{ lostActive }]] = await pool.query(
    "SELECT COUNT(*) AS lostActive FROM items WHERE userId = ? AND type = 'lost' AND status = 'active'",
    [req.user.id]
  )
  const [[{ foundActive }]] = await pool.query(
    "SELECT COUNT(*) AS foundActive FROM items WHERE userId = ? AND type = 'found' AND status = 'active'",
    [req.user.id]
  )
  const [[{ solved }]] = await pool.query(
    "SELECT COUNT(*) AS solved FROM items WHERE userId = ? AND status = 'solved'",
    [req.user.id]
  )
  const [[{ total }]] = await pool.query(
    "SELECT COUNT(*) AS total FROM items WHERE userId = ?",
    [req.user.id]
  )
  
  // 返回前端期望的字段名
  res.json({ 
    data: { 
      lost: lostActive, 
      lostActive,
      found: foundActive, 
      foundActive,
      solved, 
      total 
    } 
  })
})

// 全局统计
app.get('/stats', async (req, res) => {
  const [[{ totalItems }]] = await pool.query("SELECT COUNT(*) AS totalItems FROM items")
  const [[{ activeItems }]] = await pool.query("SELECT COUNT(*) AS activeItems FROM items WHERE status = 'active'")
  const [[{ solvedItems }]] = await pool.query("SELECT COUNT(*) AS solvedItems FROM items WHERE status = 'solved'")
  res.json({ data: { totalItems, activeItems, solvedItems } })
})

// 用户发布的物品
app.get('/user/items', authenticateToken, async (req, res) => {
  const { page = 1, type = 'all', status = 'all' } = req.query
  const pageSize = 10
  const offset = (page - 1) * pageSize

  let where = 'userId = ?'
  const params = [req.user.id]
  if (type !== 'all') { where += ' AND type = ?'; params.push(type) }
  if (status !== 'all') { where += ' AND status = ?'; params.push(status) }

  const limitVal = parseInt(pageSize)
  const offsetVal = parseInt(offset)

  const [rows] = await pool.query(
    `SELECT * FROM items WHERE ${where} ORDER BY createdAt DESC LIMIT ${limitVal} OFFSET ${offsetVal}`,
    params
  )

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM items WHERE ${where}`, params)
  const items = rows.map(item => ({ ...item, images: safeJSONParse(item.images).map(getPublicUrl) }))
  res.json({ data: items, total, page: parseInt(page), pageSize })
})

// 消息列表（最近联系人）
app.get('/messages', authenticateToken, async (req, res) => {
  // 获取与当前用户有对话的所有用户
  const [rows] = await pool.query(
    `SELECT 
       CASE 
         WHEN m.senderId = ? THEN m.receiverId 
         ELSE m.senderId 
       END AS userId,
       u.name AS userName,
       u.avatar AS userAvatar,
       MAX(m.createdAt) AS lastTime,
       SUM(CASE WHEN m.receiverId = ? AND m.read = FALSE THEN 1 ELSE 0 END) AS unread,
       (
         SELECT m2.content 
         FROM messages m2 
         WHERE (m2.senderId = ? AND m2.receiverId = userId) OR (m2.senderId = userId AND m2.receiverId = ?)
         ORDER BY m2.createdAt DESC 
         LIMIT 1
       ) AS lastMessage
     FROM messages m
     LEFT JOIN users u ON (
       CASE 
         WHEN m.senderId = ? THEN m.receiverId 
         ELSE m.senderId 
       END
     ) = u.id
     WHERE m.senderId = ? OR m.receiverId = ?
     GROUP BY userId, u.name, u.avatar
     ORDER BY lastTime DESC`,
    [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
  )
  
  const conversations = rows.map(row => ({
    userId: row.userId,
    userName: row.userName && row.userName.trim() !== '' ? row.userName : '未知用户',
    userAvatar: getPublicUrl(row.userAvatar),
    lastTime: row.lastTime * 1000,
    unread: row.unread || 0,
    lastMessage: row.lastMessage || ''
  }))
  
  res.json({ data: conversations })
})

// ─── 版本管理 API ───

const APK_DIR = path.join(__dirname, 'uploads/apk')
if (!fs.existsSync(APK_DIR)) fs.mkdirSync(APK_DIR, { recursive: true })

const apkUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, APK_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.apk'
      cb(null, uuidv4() + ext)
    }
  })
})

app.post('/admin/version/publish', authMiddleware, apkUpload.single('apk'), async (req, res) => {

  const { version, versionCode, changelog, forceUpdate } = req.body
  if (!version || !versionCode) {
    return res.status(400).json({ message: '版本号和版本码必填' })
  }

  let apkUrl = ''
  if (req.file) {
    apkUrl = `/uploads/apk/${req.file.filename}`
  }

  const id = uuidv4()
  const createdAt = Math.floor(Date.now() / 1000)

  await pool.query(
    'INSERT INTO versions (id, version, versionCode, title, changelog, apkUrl, forceUpdate, createdAt) VALUES (?,?,?,?,?,?,?,?)',
    [id, version, parseInt(versionCode), version, changelog || '', apkUrl, forceUpdate === 'true' || forceUpdate === true, createdAt]
  )

  res.json({ success: true, data: { id, version, versionCode: parseInt(versionCode), changelog: changelog || '', apkUrl, forceUpdate: forceUpdate === 'true' || forceUpdate === true, createdAt } })
})

app.get('/version/latest', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM versions ORDER BY versionCode DESC LIMIT 1')
  res.json({ data: rows[0] || null })
})

app.get('/version/list', async (req, res) => {
  const { page = 1, pageSize = 20 } = req.query
  const start = (page - 1) * pageSize
  const limitVal = parseInt(pageSize)
  const startVal = parseInt(start)
  const [rows] = await pool.query(`SELECT * FROM versions ORDER BY versionCode DESC LIMIT ${limitVal} OFFSET ${startVal}`)
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM versions')
  res.json({ data: rows, total })
})

app.delete('/admin/version/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM versions WHERE id = ?', [req.params.id])
    console.log(`[ADMIN] 版本已删除: ${req.params.id}`)
    res.json({ success: true })
  } catch (err) {
    console.error('[ADMIN] 删除版本失败:', err.message || err)
    res.status(500).json({ success: false, message: '删除失败，请重试' })
  }
})

// ==================== 数据库备份管理 ====================

// 手动触发备份
app.post('/admin/backup', authMiddleware, async (req, res) => {
  try {
    const backupFile = await backupDatabase()
    if (backupFile) {
      res.json({ success: true, message: '备份成功', file: path.basename(backupFile) })
    } else {
      res.status(500).json({ success: false, message: '备份失败' })
    }
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// 获取备份列表
app.get('/admin/backups', authMiddleware, async (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.sql'))
      .sort()
      .reverse()
      .map(f => {
        const filePath = path.join(BACKUP_DIR, f)
        const stat = fs.statSync(filePath)
        return {
          name: f,
          size: (stat.size / 1024).toFixed(2) + ' KB',
          date: new Date(stat.mtime).toLocaleString('zh-CN')
        }
      })
    res.json({ success: true, backups: files })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// 下载备份文件
app.get('/admin/backups/:filename', authMiddleware, async (req, res) => {
  try {
    const raw = req.params.filename
    // 防止路径遍历：只取文件名，拒绝含目录字符的输入
    const filename = path.basename(raw)
    if (raw !== filename || !filename.startsWith('backup_') || !filename.endsWith('.sql')) {
      return res.status(400).json({ success: false, message: '无效的文件名' })
    }
    const filePath = path.join(BACKUP_DIR, filename)
    if (fs.existsSync(filePath)) {
      res.download(filePath)
    } else {
      res.status(404).json({ success: false, message: '文件不存在' })
    }
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ==================== 随机加密下载链接 ====================

// 临时存储下载token (key: token, value: { apkUrl, expiresAt, versionId })
const downloadTokens = new Map()

// 生成随机token
function generateToken() {
  const randomStr = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  const timestamp = Date.now().toString(36)
  return timestamp + randomStr
}

// 获取加密的下载地址（临时token）
app.get('/version/:id/download-url', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM versions WHERE id = ?', [req.params.id])
    if (rows.length === 0) {
      return res.status(404).json({ message: '版本不存在' })
    }

    const version = rows[0]
    if (!version.apkUrl) {
      return res.status(400).json({ message: '该版本没有安装包' })
    }

    // 生成随机token，有效期15分钟
    const token = generateToken()
    const expiresAt = Date.now() + 15 * 60 * 1000 // 15分钟后过期

    downloadTokens.set(token, {
      apkUrl: version.apkUrl,
      expiresAt,
      versionId: version.id,
      version: version.version
    })

    // 清理过期的token
    const now = Date.now()
    for (const [key, value] of downloadTokens.entries()) {
      if (value.expiresAt < now) {
        downloadTokens.delete(key)
      }
    }

    res.json({ data: { url: token } })
  } catch (e) {
    console.error('生成下载链接失败:', e)
    res.status(500).json({ message: '服务器错误' })
  }
})

// 通过token下载APK
app.get('/download/encrypted/:token', async (req, res) => {
  const token = req.params.token
  const tokenData = downloadTokens.get(token)

  if (!tokenData) {
    return res.status(404).json({ message: '下载链接无效或已过期，请重新获取' })
  }

  if (Date.now() > tokenData.expiresAt) {
    downloadTokens.delete(token)
    return res.status(404).json({ message: '下载链接已过期，请重新获取' })
  }

  // 下载文件（token 在有效期内可重复使用，防止下载失败后无法重试）
  const filePath = path.join(__dirname, tokenData.apkUrl)
  res.download(filePath, `campus-lostfound-v${tokenData.version}.apk`)
})

// 静态文件：APK 下载
app.use('/uploads/apk', express.static(APK_DIR))

// 下载官网
app.get('/download', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/download.html'))
})

// 心跳检测 API（不需要token认证，允许未登录状态检测）
app.get('/api/heartbeat', (req, res) => {
  res.json({ 
    success: true, 
    timestamp: Date.now(),
    message: 'Server is alive',
    serverTime: new Date().toISOString()
  })
})

// 全局错误处理（捕获 async handler 和 multer 的错误）
app.use((err, req, res, next) => {
  console.error('[Express 错误]', err.message || err)
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: '文件大小超出限制' })
    }
    return res.status(400).json({ message: `上传错误: ${err.message}` })
  }
  if (err.message === '只支持图片格式') {
    return res.status(400).json({ message: '不支持的图片格式，请选择 JPG/PNG/GIF/WebP' })
  }
  if (err.message === '只支持视频格式') {
    return res.status(400).json({ message: '不支持的视频格式，请选择 MP4/MOV/AVI/WMV' })
  }
  res.status(500).json({ message: '服务器内部错误' })
})

function getLocalIP() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return '127.0.0.1'
}

const localIP = getLocalIP()

// ==================== 进程保活和错误处理 ====================

// 捕获未捕获的异常
process.on('uncaughtException', (err) => {
  console.error('[系统错误] 未捕获的异常:', err.message || err, err.stack)
})

// 捕获未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  // 尝试获取完整错误信息
  const msg = reason?.message || reason?.sqlMessage || reason?.code || JSON.stringify(reason)
  console.error('[系统错误] 未处理的 Promise 拒绝:', msg)
  if (reason?.stack) {
    console.error('[系统错误] 调用堆栈:', reason.stack)
  } else {
    // 没有 stack 时，打印完整错误对象和生成新堆栈
    console.error('[系统错误] 完整错误对象:', reason)
    console.error('[系统错误] 错误类型:', typeof reason, reason?.constructor?.name)
    try { console.error('[系统错误] 当前堆栈:', new Error('追踪未处理拒绝位置').stack) } catch (_) {}
  }
})

// 优雅退出
function gracefulExit() {
  console.log('[系统] 正在关闭...')
  clearInterval(flushTimer)
  flushLogs()
  console.log('[日志] 日志缓冲区已刷盘')
  process.exit(0)
}

process.on('SIGTERM', () => {
  console.log('[系统] 收到 SIGTERM 信号')
  gracefulExit()
})

process.on('SIGINT', () => {
  console.log('[系统] 收到 SIGINT 信号')
  gracefulExit()
})

// 启动
;(async () => {
  try {
    await initDatabase()

    // 立即备份一次
    await backupDatabase()

    // 设置24小时自动备份
    const BACKUP_INTERVAL = 24 * 60 * 60 * 1000 // 24小时
    setInterval(backupDatabase, BACKUP_INTERVAL)
    console.log(`[备份] ⏰ 已设置自动备份，每24小时执行一次`)

    // 调试：显示环境变量是否加载成功（不暴露敏感信息）
    const adminUser = process.env.ADMIN_USER
    const adminPass = process.env.ADMIN_PASS
    const jwtSecret = process.env.JWT_SECRET
    console.log('环境变量配置:', {
      ADMIN_USER: adminUser ? '***已设置***' : '(未设置)',
      ADMIN_PASS: adminPass ? '***已设置***' : '(未设置)',
      JWT_SECRET: jwtSecret ? '***已设置(长度:' + jwtSecret.length + ')***' : '(未设置，使用默认值)'
    })

    server.listen(port, '0.0.0.0', () => {
      console.log(`服务器运行在 http://localhost:${port}`)
      console.log(`局域网访问: http://${localIP}:${port}`)
      console.log(`外网映射: ${PUBLIC_BASE} (端口映射)`)
      console.log(`Web管理后台: ${PUBLIC_BASE}/admin/login`)
      console.log(`WebSocket 服务已启动`)
    })
  } catch (e) {
    console.error('[启动失败]', e.message || e, e.stack)
    process.exit(1)
  }
})()

const express = require('express')
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

const app = express()
const port = 5000

const JWT_SECRET = 'lost_found_secret_key'
const UPLOAD_DIR = path.join(__dirname, 'uploads')
const VIDEO_DIR = path.join(__dirname, 'uploads/videos')

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true })

// 处理头像URL，返回完整URL
function getFullAvatarUrl(avatar) {
  if (!avatar) return ''
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar
  }
  return avatar // 保持原样，前端会处理
}

// MySQL 连接池
const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: process.env.MYSQL_PASSWORD || 'windows10',
  database: 'lost_found',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true
})

// 初始化管理员账号
async function initDatabase() {
  const adminUserId = process.env.ADMIN_USER || 'admin'
  const [rows] = await pool.execute('SELECT 1 FROM users WHERE studentId = ?', [adminUserId])
  if (rows.length === 0) {
    const adminPass = process.env.ADMIN_PASS || 'admin123'
    const hashedPassword = bcrypt.hashSync(adminPass, 10)
    await pool.execute(
      'INSERT INTO users (id, studentId, name, phone, password, className, status, blockedUsers, createdAt) VALUES (?,?,?,?,?,?,?,?,?)',
      [adminUserId, adminUserId, '管理员', '13800000000', hashedPassword, '管理员', 'approved', '[]', Math.floor(Date.now() / 1000)]
    )
  }
}

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `img_${uuidv4()}${path.extname(file.originalname)}`)
})

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VIDEO_DIR),
  filename: (req, file, cb) => cb(null, `video_${uuidv4()}${path.extname(file.originalname)}`)
})

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
      cb(null, true)
    } else {
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

// 静态文件：图片和视频
app.use('/uploads', express.static(UPLOAD_DIR))
app.use('/uploads/videos', express.static(VIDEO_DIR))

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ message: '未授权' })

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ message: 'token无效' })
    req.user = user
    next()
  })
}

function formatTime(timestamp) {
  const date = new Date(timestamp * 1000)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

app.get('/', (req, res) => res.redirect('/admin/login'))

app.get('/admin/login', (req, res) => res.render('login', { error: null }))

app.post('/admin/login', async (req, res) => {
  const { studentId, password } = req.body
  const [rows] = await pool.execute('SELECT * FROM users WHERE studentId = ?', [studentId])
  const user = rows[0]

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.render('login', { error: '用户名或密码错误' })
  }

  // 从环境变量读取管理员ID，支持自定义管理员账号
  const adminUserId = process.env.ADMIN_USER || 'admin'
  if (user.id !== adminUserId) {
    return res.render('login', { error: '请使用管理员账号登录' })
  }

  const token = jwt.sign({ id: user.id, studentId: user.studentId }, JWT_SECRET)
  res.cookie('token', token, { httpOnly: true })
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
    const user = jwt.verify(token, JWT_SECRET)
    // 从环境变量读取管理员ID，支持自定义管理员账号
    const adminUserId = process.env.ADMIN_USER || 'admin'
    if (user.id !== adminUserId) return res.redirect('/admin/login')
    req.user = user
    next()
  } catch (err) {
    res.redirect('/admin/login')
  }
}

app.get('/admin/dashboard', authMiddleware, async (req, res) => {
  const [[{ totalItems }]] = await pool.execute('SELECT COUNT(*) AS totalItems FROM items')
  const [[{ activeItems }]] = await pool.execute("SELECT COUNT(*) AS activeItems FROM items WHERE status = 'active'")
  const [[{ solvedItems }]] = await pool.execute("SELECT COUNT(*) AS solvedItems FROM items WHERE status = 'solved'")
  const [[{ lostItems }]] = await pool.execute("SELECT COUNT(*) AS lostItems FROM items WHERE type = 'lost' AND status = 'active'")
  const [[{ foundItems }]] = await pool.execute("SELECT COUNT(*) AS foundItems FROM items WHERE type = 'found' AND status = 'active'")
  const [[{ lostSolved }]] = await pool.execute("SELECT COUNT(*) AS lostSolved FROM items WHERE type = 'lost' AND status = 'solved'")
  const [[{ foundSolved }]] = await pool.execute("SELECT COUNT(*) AS foundSolved FROM items WHERE type = 'found' AND status = 'solved'")
  // 从环境变量读取管理员ID，排除管理员账号
  const adminUserId = process.env.ADMIN_USER || 'admin'
  const [[{ totalUsers }]] = await pool.execute(`SELECT COUNT(*) AS totalUsers FROM users WHERE status = 'approved' AND studentId != ?`, [adminUserId])
  const [[{ pendingUsers }]] = await pool.execute("SELECT COUNT(*) AS pendingUsers FROM users WHERE status = 'pending'")

  res.render('dashboard', { totalItems, activeItems, solvedItems, lostItems, foundItems, lostSolved, foundSolved, totalUsers, pendingUsers })
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

  const [rows] = await pool.execute(
    `SELECT i.*, u.name AS userName, u.phone AS userPhone FROM items i LEFT JOIN users u ON i.userId = u.id WHERE ${where} ORDER BY i.createdAt DESC LIMIT ${limit} OFFSET ${offsetVal}`,
    params
  )

  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM items i WHERE ${where}`, params)
  const totalPages = Math.ceil(total / pageSize)

  const items = rows.map(item => ({ ...item, createdAt: formatTime(item.createdAt), images: JSON.parse(item.images || '[]') }))
  res.render('items', { items, totalPages, currentPage: parseInt(page), type, status, keyword })
})

app.post('/admin/items/delete/:id', authMiddleware, async (req, res) => {
  await pool.execute('DELETE FROM items WHERE id = ?', [req.params.id])
  res.json({ success: true })
})

app.get('/admin/versions', authMiddleware, async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM versions ORDER BY createdAt DESC')
  const versions = rows.map(v => ({ ...v, createdAt: formatTime(v.createdAt) }))
  res.render('versions', { versions })
})

app.get('/admin/users', authMiddleware, async (req, res) => {
  const { page = 1, keyword = '', status = 'all' } = req.query
  const pageSize = 10
  const offset = (page - 1) * pageSize

  // 从环境变量读取管理员ID，排除管理员账号
  const adminUserId = process.env.ADMIN_USER || 'admin'
  let where = `studentId != '${adminUserId}'`
  const params = []
  if (status !== 'all') { where += ' AND status = ?'; params.push(status) }
  if (keyword) { where += ' AND (studentId LIKE ? OR name LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`) }

  const limit = parseInt(pageSize)
  const offsetVal = parseInt(offset)

  const [rows] = await pool.execute(
    `SELECT * FROM users WHERE ${where} ORDER BY createdAt DESC LIMIT ${limit} OFFSET ${offsetVal}`,
    params
  )

  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM users WHERE ${where}`, params)
  const totalPages = Math.ceil(total / pageSize)

  const users = rows.map(u => {
    let avatarUrl = u.avatar
    // 统一转换为外网端口URL
    const publicHost = '183.66.27.20:41412'
    if (avatarUrl) {
      // 如果是旧的内网端口5000，替换为外网端口
      if (avatarUrl.includes(':5000')) {
        avatarUrl = avatarUrl.replace(':5000', ':41412').replace('localhost', '183.66.27.20').replace('172.16.30.55', '183.66.27.20')
      }
      // 如果是相对路径，添加完整URL
      else if (!avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://')) {
        avatarUrl = `http://${publicHost}${avatarUrl}`
      }
      // 如果已经是外网URL，直接返回
      else if (!avatarUrl.includes('183.66.27.20:41412')) {
        try {
          const urlObj = new URL(avatarUrl)
          urlObj.host = publicHost
          avatarUrl = urlObj.toString()
        } catch (e) {
          // 保持原样
        }
      }
    }
    return { ...u, createdAt: formatTime(u.createdAt), avatar: avatarUrl }
  })
  res.render('users', { users, totalPages, currentPage: parseInt(page), keyword, status })
})

app.post('/admin/users/approve/:id', authMiddleware, async (req, res) => {
  await pool.execute("UPDATE users SET status = 'approved' WHERE id = ?", [req.params.id])
  res.json({ success: true })
})

app.post('/admin/users/reject/:id', authMiddleware, async (req, res) => {
  await pool.execute("UPDATE users SET status = 'rejected' WHERE id = ?", [req.params.id])
  res.json({ success: true })
})

app.post('/admin/users/delete/:id', authMiddleware, async (req, res) => {
  await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id])
  res.json({ success: true })
})

app.post('/auth/register', async (req, res) => {
  const { studentId, name, phone, password, className, avatar } = req.body

  if (!studentId || !name || !phone || !password || !className) {
    return res.status(400).json({ message: '请填写完整信息' })
  }

  const [existing] = await pool.execute('SELECT 1 FROM users WHERE studentId = ?', [studentId])
  if (existing.length > 0) {
    return res.status(400).json({ message: '该学号已被注册' })
  }

  const id = uuidv4()
  const hashedPassword = bcrypt.hashSync(password, 10)
  const createdAt = Math.floor(Date.now() / 1000)

  await pool.execute(
    'INSERT INTO users (id, studentId, name, phone, password, avatar, className, status, blockedUsers, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, studentId, name, phone, hashedPassword, avatar || '', className, 'pending', '[]', createdAt]
  )

  res.json({ message: '注册成功，请等待管理员审核' })
})

app.post('/auth/login', async (req, res) => {
  const { studentId, password } = req.body
  const [rows] = await pool.execute('SELECT * FROM users WHERE studentId = ?', [studentId])
  const user = rows[0]

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(400).json({ message: '学号或密码错误' })
  }

  if (user.status !== 'approved') {
    return res.status(400).json({ message: '账号待审核或已被拒绝，请联系管理员' })
  }

  const token = jwt.sign({ id: user.id, studentId: user.studentId }, JWT_SECRET)
  // 统一转换为外网端口URL
  const publicHost = '183.66.27.20:41412'
  let avatarUrl = user.avatar
  if (avatarUrl) {
    if (avatarUrl.includes(':5000')) {
      avatarUrl = avatarUrl.replace(':5000', ':41412').replace('localhost', '183.66.27.20').replace('172.16.30.55', '183.66.27.20')
    } else if (!avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://')) {
      avatarUrl = `http://${publicHost}${avatarUrl}`
    } else if (!avatarUrl.includes('183.66.27.20:41412')) {
      try {
        const urlObj = new URL(avatarUrl)
        urlObj.host = publicHost
        avatarUrl = urlObj.toString()
      } catch (e) {}
    }
  }
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
  const [rows] = await pool.execute('SELECT id, studentId, name, phone, avatar, className FROM users WHERE id = ?', [req.user.id])
  if (rows.length === 0) return res.status(404).json({ message: '用户不存在' })
  const user = rows[0]
  // 统一转换为外网端口URL
  const publicHost = '183.66.27.20:41412'
  if (user.avatar) {
    if (user.avatar.includes(':5000')) {
      user.avatar = user.avatar.replace(':5000', ':41412').replace('localhost', '183.66.27.20').replace('172.16.30.55', '183.66.27.20')
    } else if (!user.avatar.startsWith('http://') && !user.avatar.startsWith('https://')) {
      user.avatar = `http://${publicHost}${user.avatar}`
    } else if (!user.avatar.includes('183.66.27.20:41412')) {
      try {
        const urlObj = new URL(user.avatar)
        urlObj.host = publicHost
        user.avatar = urlObj.toString()
      } catch (e) {}
    }
  }
  res.json({ data: user })
})

// 兼容前端 /user/info 接口
app.get('/user/info', authenticateToken, async (req, res) => {
  const [rows] = await pool.execute('SELECT id, studentId, name, phone, avatar, className FROM users WHERE id = ?', [req.user.id])
  if (rows.length === 0) return res.status(404).json({ message: '用户不存在' })
  const user = rows[0]
  // 统一转换为外网端口URL
  const publicHost = '183.66.27.20:41412'
  if (user.avatar) {
    if (user.avatar.includes(':5000')) {
      user.avatar = user.avatar.replace(':5000', ':41412').replace('localhost', '183.66.27.20').replace('172.16.30.55', '183.66.27.20')
    } else if (!user.avatar.startsWith('http://') && !user.avatar.startsWith('https://')) {
      user.avatar = `http://${publicHost}${user.avatar}`
    } else if (!user.avatar.includes('183.66.27.20:41412')) {
      try {
        const urlObj = new URL(user.avatar)
        urlObj.host = publicHost
        user.avatar = urlObj.toString()
      } catch (e) {}
    }
  }
  res.json({ data: user })
})

app.put('/user/info', authenticateToken, async (req, res) => {
  const { name, phone, avatar, className } = req.body
  await pool.execute(
    'UPDATE users SET name = ?, phone = ?, avatar = ?, className = ? WHERE id = ?',
    [name || '', phone || '', avatar || '', className || '', req.user.id]
  )
  res.json({ success: true, message: '更新成功' })
})

app.post('/items', authenticateToken, imageUpload.array('images', 5), async (req, res) => {
  const { title, description, type, contact, location, images: imageUrls } = req.body
  
  // 使用外网端口生成完整URL
  const publicHost = '183.66.27.20:41412'
  let images = []
  
  // 优先使用前端传来的图片URL（已上传的情况）
  if (imageUrls && Array.isArray(imageUrls)) {
    images = imageUrls
  } 
  // 否则使用multer上传的文件
  else if (req.files && req.files.length > 0) {
    images = req.files.map(f => `http://${publicHost}/uploads/${f.filename}`)
  }

  if (!title || !type) {
    return res.status(400).json({ message: '请填写标题和类型' })
  }

  const id = uuidv4()
  const createdAt = Math.floor(Date.now() / 1000)

  await pool.execute(
    'INSERT INTO items (id, userId, title, description, type, status, images, contact, location, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, req.user.id, title, description || '', type, 'active', JSON.stringify(images), contact || '', location || '', createdAt]
  )

  res.json({ success: true, message: '发布成功' })
})

app.get('/items', async (req, res) => {
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

  const [rows] = await pool.execute(
    `SELECT i.*, u.name AS userName, u.phone AS userPhone FROM items i LEFT JOIN users u ON i.userId = u.id WHERE ${where} ORDER BY i.createdAt DESC LIMIT ${limit} OFFSET ${offsetVal}`,
    params
  )

  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM items i WHERE ${where}`, params)

  const items = rows.map(item => {
    let images = JSON.parse(item.images || '[]')
    // 统一转换为外网端口URL
    const publicHost = '183.66.27.20:41412'
    images = images.map(img => {
      if (!img) return img
      // 如果是旧的内网端口5000，替换为外网端口
      if (img.includes(':5000')) {
        return img.replace(':5000', ':41412').replace('localhost', '183.66.27.20').replace('172.16.30.55', '183.66.27.20')
      }
      // 如果是相对路径，添加完整URL
      if (!img.startsWith('http://') && !img.startsWith('https://')) {
        return `http://${publicHost}${img}`
      }
      // 如果已经是外网URL，直接返回
      if (img.includes('183.66.27.20:41412')) {
        return img
      }
      // 其他http/https URL，也替换为主机地址
      try {
        const urlObj = new URL(img)
        urlObj.host = publicHost
        return urlObj.toString()
      } catch (e) {
        return img
      }
    })
    console.log('物品ID:', item.id, '图片URL:', images)
    // 处理用户名空值
    item.userName = item.userName && item.userName.trim() !== '' ? item.userName : '校园用户'
    return { ...item, images }
  })
  res.json({ data: items, total, page: parseInt(page), pageSize })
})

app.get('/items/:id', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT i.*, u.name AS userName, u.phone AS userPhone, u.avatar AS userAvatar, u.className AS userClassName FROM items i LEFT JOIN users u ON i.userId = u.id WHERE i.id = ?',
    [req.params.id]
  )
  if (rows.length === 0) return res.status(404).json({ message: '物品不存在' })

  const item = rows[0]
  console.log('物品详情 - 发布者信息:', { userName: item.userName, userId: item.userId, userAvatar: item.userAvatar })
  
  let images = JSON.parse(item.images || '[]')
  // 统一转换为外网端口URL
  const publicHost = '183.66.27.20:41412'
  images = images.map(img => {
    if (!img) return img
    // 如果是旧的内网端口5000，替换为外网端口
    if (img.includes(':5000')) {
      return img.replace(':5000', ':41412').replace('localhost', '183.66.27.20').replace('172.16.30.55', '183.66.27.20')
    }
    // 如果是相对路径，添加完整URL
    if (!img.startsWith('http://') && !img.startsWith('https://')) {
      return `http://${publicHost}${img}`
    }
    // 如果已经是外网URL，直接返回
    if (img.includes('183.66.27.20:41412')) {
      return img
    }
    // 其他http/https URL，也替换为主机地址
    try {
      const urlObj = new URL(img)
      urlObj.host = publicHost
      return urlObj.toString()
    } catch (e) {
      return img
    }
  })
  item.images = images
  
  // 处理用户信息 - 空字符串转为null
  item.userName = item.userName && item.userName.trim() !== '' ? item.userName : '校园用户'
  item.userPhone = item.userPhone || null
  item.userClassName = item.userClassName || null
  
  // 处理用户头像URL
  if (item.userAvatar && !item.userAvatar.startsWith('http://') && !item.userAvatar.startsWith('https://')) {
    item.userAvatar = `http://${publicHost}${item.userAvatar}`
  }
  
  console.log('物品详情 - 发布者信息:', { userName: item.userName, userId: item.userId, userAvatar: item.userAvatar })
  
  res.json({ data: item })
})

app.post('/items/:id/solve', authenticateToken, async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM items WHERE id = ?', [req.params.id])
  if (rows.length === 0) return res.status(404).json({ message: '物品不存在' })

  const item = rows[0]
  if (item.userId !== req.user.id) {
    return res.status(403).json({ message: '无权操作' })
  }

  await pool.execute("UPDATE items SET status = 'solved' WHERE id = ?", [req.params.id])
  res.json({ success: true, message: '已标记为已解决' })
})

app.put('/items/:id', authenticateToken, imageUpload.array('images', 5), async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM items WHERE id = ?', [req.params.id])
  if (rows.length === 0) return res.status(404).json({ message: '物品不存在' })

  const item = rows[0]
  if (item.userId !== req.user.id) {
    return res.status(403).json({ message: '无权操作' })
  }

  const { title, description, type, contact, location } = req.body
  let images = JSON.parse(item.images || '[]')
  
  // 如果有新上传的图片，添加到列表（使用外网端口）
  if (req.files && req.files.length > 0) {
    const publicHost = '183.66.27.20:41412'
    const newImages = req.files.map(f => `http://${publicHost}/uploads/${f.filename}`)
    images = [...images, ...newImages]
  }

  await pool.execute(
    'UPDATE items SET title = ?, description = ?, type = ?, contact = ?, location = ?, images = ? WHERE id = ?',
    [title || item.title, description || item.description, type || item.type, contact || item.contact, location || item.location, JSON.stringify(images), req.params.id]
  )

  res.json({ success: true, message: '更新成功' })
})

app.delete('/items/:id', authenticateToken, async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM items WHERE id = ?', [req.params.id])
  if (rows.length === 0) return res.status(404).json({ message: '物品不存在' })

  const item = rows[0]
  if (item.userId !== req.user.id) {
    return res.status(403).json({ message: '无权操作' })
  }

  await pool.execute('DELETE FROM items WHERE id = ?', [req.params.id])
  res.json({ success: true, message: '删除成功' })
})

app.post('/upload/image', authenticateToken, imageUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请上传图片' })
  // 使用外网端口返回完整URL
  const publicHost = '183.66.27.20:41412'
  const fullUrl = `http://${publicHost}/uploads/${req.file.filename}`
  res.json({ url: fullUrl })
})

app.post('/upload/video', authenticateToken, videoUpload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请上传视频' })
  // 使用外网端口返回完整URL
  const publicHost = '183.66.27.20:41412'
  const fullUrl = `http://${publicHost}/uploads/videos/${req.file.filename}`
  res.json({ url: fullUrl })
})

app.get('/messages/unread/count', authenticateToken, async (req, res) => {
  const [rows] = await pool.execute('SELECT COUNT(*) AS count FROM messages WHERE receiverId = ? AND `read` = FALSE', [req.user.id])
  res.json({ data: { count: rows[0].count } })
})

app.get('/messages/conversation/:userId', authenticateToken, async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT m.*, u.name AS senderName, u.avatar AS senderAvatar FROM messages m LEFT JOIN users u ON m.senderId = u.id WHERE (m.senderId = ? AND m.receiverId = ?) OR (m.senderId = ? AND m.receiverId = ?) ORDER BY m.createdAt ASC',
    [req.user.id, req.params.userId, req.params.userId, req.user.id]
  )

  const publicHost = '183.66.27.20:41412'
  const messages = rows.map(m => {
    // 转换时间戳为毫秒
    const createdAt = m.createdAt * 1000
    
    // 处理头像URL
    let senderAvatar = m.senderAvatar
    if (senderAvatar && !senderAvatar.startsWith('http://') && !senderAvatar.startsWith('https://')) {
      senderAvatar = `http://${publicHost}${senderAvatar}`
    }
    
    return { 
      ...m, 
      createdAt,
      senderName: m.senderName && m.senderName.trim() !== '' ? m.senderName : '校园用户',
      senderAvatar: senderAvatar || ''
    }
  })
  res.json({ data: messages })
})

// 标记对话已读
app.post('/messages/conversation/:userId/read', authenticateToken, async (req, res) => {
  try {
    // 将该用户发送给我且未读的消息标记为已读
    await pool.execute(
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

  const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId])
  if (users.length === 0) return res.status(404).json({ message: '用户不存在' })

  const receiver = users[0]
  const blocked = JSON.parse(receiver.blockedUsers || '[]')
  if (blocked.includes(req.user.id)) {
    return res.status(403).json({ message: '对方已将你拉黑，无法发送消息' })
  }

  const id = uuidv4()
  const createdAt = Math.floor(Date.now() / 1000)

  await pool.execute(
    'INSERT INTO messages (id, senderId, receiverId, content, type, mediaUrl, `read`, createdAt) VALUES (?,?,?,?,?,?,?,?)',
    [id, req.user.id, userId, content || '', type, mediaUrl, false, createdAt]
  )

  res.json({ success: true, message: { id, senderId: req.user.id, receiverId: userId, content: content || '', type, mediaUrl, read: false, createdAt: createdAt * 1000 } })
})

app.post('/messages/:id/recall', authenticateToken, async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM messages WHERE id = ?', [req.params.id])
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

  await pool.execute("UPDATE messages SET type = 'recalled', content = '', mediaUrl = '' WHERE id = ?", [req.params.id])
  res.json({ success: true, message: '撤回成功' })
})

app.post('/user/block', authenticateToken, async (req, res) => {
  const { userId } = req.body
  if (!userId) return res.status(400).json({ message: '参数错误' })

  const [rows] = await pool.execute('SELECT blockedUsers FROM users WHERE id = ?', [req.user.id])
  if (rows.length === 0) return res.status(404).json({ message: '用户不存在' })

  let blocked = JSON.parse(rows[0].blockedUsers || '[]')
  if (!blocked.includes(userId)) {
    blocked.push(userId)
    await pool.execute('UPDATE users SET blockedUsers = ? WHERE id = ?', [JSON.stringify(blocked), req.user.id])
    
    // 拉黑后删除所有与该用户的对话消息
    await pool.execute(
      'DELETE FROM messages WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)',
      [req.user.id, userId, userId, req.user.id]
    )
  }

  res.json({ success: true })
})

app.get('/user/blocked', authenticateToken, async (req, res) => {
  const [rows] = await pool.execute('SELECT blockedUsers FROM users WHERE id = ?', [req.user.id])
  const blockedIds = JSON.parse(rows[0]?.blockedUsers || '[]')
  
  if (blockedIds.length === 0) {
    return res.json({ data: [] })
  }
  
  // 获取被拉黑用户的详细信息
  const placeholders = blockedIds.map(() => '?').join(',')
  const [users] = await pool.execute(
    `SELECT id, name, avatar FROM users WHERE id IN (${placeholders})`,
    blockedIds
  )
  
  const publicHost = '183.66.27.20:41412'
  const blockedUsers = users.map(user => {
    let avatar = user.avatar
    if (avatar && !avatar.startsWith('http://') && !avatar.startsWith('https://')) {
      avatar = `http://${publicHost}${avatar}`
    }
    return {
      id: user.id,
      name: user.name && user.name.trim() !== '' ? user.name : '校园用户',
      avatar: avatar || ''
    }
  })
  
  res.json({ data: blockedUsers })
})

app.post('/user/unblock', authenticateToken, async (req, res) => {
  const { userId } = req.body
  if (!userId) return res.status(400).json({ message: '参数错误' })

  const [rows] = await pool.execute('SELECT blockedUsers FROM users WHERE id = ?', [req.user.id])
  if (rows.length === 0) return res.status(404).json({ message: '用户不存在' })

  let blocked = JSON.parse(rows[0].blockedUsers || '[]')
  blocked = blocked.filter(id => id !== userId)
  await pool.execute('UPDATE users SET blockedUsers = ? WHERE id = ?', [JSON.stringify(blocked), req.user.id])

  res.json({ success: true, message: '解除拉黑成功' })
})

app.get('/user/search', authenticateToken, async (req, res) => {
  const { keyword } = req.query
  if (!keyword) return res.json({ data: [] })

  const [rows] = await pool.execute(
    "SELECT id, name, avatar, className FROM users WHERE status = 'approved' AND id != ? AND (name LIKE ? OR studentId LIKE ?)",
    [req.user.id, `%${keyword}%`, `%${keyword}%`]
  )

  res.json({ data: rows })
})

// 用户统计
app.get('/user/stats', authenticateToken, async (req, res) => {
  const [[{ totalItems }]] = await pool.execute(
    "SELECT COUNT(*) AS totalItems FROM items WHERE userId = ?",
    [req.user.id]
  )
  const [[{ solvedItems }]] = await pool.execute(
    "SELECT COUNT(*) AS solvedItems FROM items WHERE userId = ? AND status = 'solved'",
    [req.user.id]
  )
  res.json({ data: { totalItems, solvedItems } })
})

// 全局统计
app.get('/stats', async (req, res) => {
  const [[{ totalItems }]] = await pool.execute("SELECT COUNT(*) AS totalItems FROM items")
  const [[{ activeItems }]] = await pool.execute("SELECT COUNT(*) AS activeItems FROM items WHERE status = 'active'")
  const [[{ solvedItems }]] = await pool.execute("SELECT COUNT(*) AS solvedItems FROM items WHERE status = 'solved'")
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

  const [rows] = await pool.execute(
    `SELECT * FROM items WHERE ${where} ORDER BY createdAt DESC LIMIT ${limitVal} OFFSET ${offsetVal}`,
    params
  )

  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM items WHERE ${where}`, params)
  const items = rows.map(item => ({ ...item, images: JSON.parse(item.images || '[]') }))
  res.json({ data: items, total, page: parseInt(page), pageSize })
})

// 消息列表（最近联系人）
app.get('/messages', authenticateToken, async (req, res) => {
  // 获取与当前用户有对话的所有用户
  const [rows] = await pool.execute(
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
  
  const publicHost = '183.66.27.20:41412'
  const conversations = rows.map(row => {
    // 处理头像URL
    let userAvatar = row.userAvatar
    if (userAvatar && !userAvatar.startsWith('http://') && !userAvatar.startsWith('https://')) {
      userAvatar = `http://${publicHost}${userAvatar}`
    }
    
    return {
      userId: row.userId,
      userName: row.userName && row.userName.trim() !== '' ? row.userName : '校园用户',
      userAvatar: userAvatar || '',
      lastTime: row.lastTime * 1000, // 转换为毫秒
      unread: row.unread || 0,
      lastMessage: row.lastMessage || ''
    }
  })
  
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

app.post('/admin/version/publish', authenticateToken, apkUpload.single('apk'), async (req, res) => {
  if (req.user.id !== 'admin') {
    return res.status(403).json({ message: '无权操作' })
  }

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

  await pool.execute(
    'INSERT INTO versions (id, version, versionCode, changelog, apkUrl, forceUpdate, createdAt) VALUES (?,?,?,?,?,?,?)',
    [id, version, parseInt(versionCode), changelog || '', apkUrl, forceUpdate === 'true' || forceUpdate === true, createdAt]
  )

  res.json({ success: true, data: { id, version, versionCode: parseInt(versionCode), changelog: changelog || '', apkUrl, forceUpdate: forceUpdate === 'true' || forceUpdate === true, createdAt } })
})

app.get('/version/latest', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM versions ORDER BY versionCode DESC LIMIT 1')
  res.json({ data: rows[0] || null })
})

app.get('/version/list', async (req, res) => {
  const { page = 1, pageSize = 20 } = req.query
  const start = (page - 1) * pageSize
  const limitVal = parseInt(pageSize)
  const startVal = parseInt(start)
  const [rows] = await pool.execute(`SELECT * FROM versions ORDER BY versionCode DESC LIMIT ${limitVal} OFFSET ${startVal}`)
  const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM versions')
  res.json({ data: rows, total })
})

app.delete('/admin/version/:id', authenticateToken, async (req, res) => {
  if (req.user.id !== 'admin') {
    return res.status(403).json({ message: '无权操作' })
  }
  await pool.execute('DELETE FROM versions WHERE id = ?', [req.params.id])
  res.json({ success: true })
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

// 启动
;(async () => {
  await initDatabase()
  // 调试：显示环境变量是否加载成功（不暴露敏感信息）
  const adminUser = process.env.ADMIN_USER
  const adminPass = process.env.ADMIN_PASS
  console.log('环境变量配置:', {
    ADMIN_USER: adminUser ? '***已设置***' : '(未设置)',
    ADMIN_PASS: adminPass ? '***已设置***' : '(未设置)'
  })
  
  app.listen(port, '0.0.0.0', () => {
    console.log(`服务器运行在 http://localhost:${port}`)
    console.log(`局域网访问: http://${localIP}:${port}`)
    console.log(`外网映射: http://183.66.27.20:41412 (端口映射)`)
    console.log(`Web管理后台: http://183.66.27.20:41412/admin/login`)
  })
})()

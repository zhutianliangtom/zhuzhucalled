# 🎓 校园失物招领系统

<div align="center">

![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS%20%7C%20H5-blue)
![Vue](https://img.shields.io/badge/vue-3.3-brightgreen)
![UniApp](https://img.shields.io/badge/uniapp-3.0-orange)
![Node.js](https://img.shields.io/badge/node-%3E%3D16.0-green)
![MySQL](https://img.shields.io/badge/mysql-9.7-blue)
![License](https://img.shields.io/badge/license-MIT-yellow)

**一个基于 UniApp + Vue3 + Node.js + MySQL 的校园失物招领移动应用**

[功能特性](#-功能特性) • [技术栈](#-技术栈) • [快速开始](#-快速开始) • [项目结构](#-项目结构) • [API文档](#-api文档) • [部署指南](#-部署指南)

</div>

---

## 📱 项目简介

校园失物招领系统是一个专为高校设计的移动应用，帮助学生快速发布和查找丢失物品。系统支持文字、图片、视频等多种媒体形式，提供实时消息通知、用户认证、黑名单管理等完整功能。

### ✨ 核心亮点

- 🚀 **跨平台支持**：一套代码编译到 Android、iOS、H5、微信小程序
- 💬 **实时聊天**：支持文字、图片、视频消息，已读未读状态
- 🔒 **安全可靠**：JWT 认证、用户审核机制、黑名单管理
- 📸 **多媒体支持**：图片上传、视频录制与播放、封面自动生成
- 🌙 **深色模式**：全局深色主题，护眼舒适
- 📡 **离线检测**：心跳检测机制，断网自动提示
- 🔄 **版本更新**：App 内检测新版本，强制/可选更新

---

## 🎯 功能特性

### 用户系统
- ✅ 学生身份注册与审核
- ✅ JWT Token 认证
- ✅ 个人资料编辑（头像、昵称、班级）
- ✅ 密码加密存储（bcrypt）

### 失物招领
- ✅ 发布寻物启事 / 失物招领
- ✅ 多图上传（最多5张）
- ✅ 视频录制与上传
- ✅ 分类筛选（全部/寻物/招领）
- ✅ 时间筛选（今天/本周/本月）
- ✅ 关键词搜索
- ✅ 标记为已解决
- ✅ 收藏功能

### 消息系统
- ✅ 实时聊天（WebSocket 轮询）
- ✅ 文字消息
- ✅ 图片消息（点击预览）
- ✅ 视频消息（缩略图+播放）
- ✅ 消息撤回（2分钟内）
- ✅ 已读未读状态
- ✅ 未读数角标实时更新
- ✅ 退出聊天自动清除角标

### 社交功能
- ✅ 拉黑用户
- ✅ 取消拉黑
- ✅ 黑名单管理页面
- ✅ 防止互相拉黑

### 系统功能
- ✅ 心跳检测（15秒间隔）
- ✅ 断网提示条
- ✅ 网络恢复提示
- ✅ App 版本检测与更新
- ✅ Android 原生角标
- ✅ 本地推送通知

---

## 🛠️ 技术栈

### 前端
| 技术 | 版本 | 说明 |
|------|------|------|
| **UniApp** | 3.0 | 跨平台框架 |
| **Vue.js** | 3.3 | 渐进式 JavaScript 框架 |
| **Vite** | 5.0 | 下一代前端构建工具 |
| **TypeScript** | 5.3 | JavaScript 超集 |
| **SCSS** | 1.70 | CSS 预处理器 |
| **uni-ui** | - | UniApp UI 组件库 |

### 后端
| 技术 | 版本 | 说明 |
|------|------|------|
| **Node.js** | >=16.0 | JavaScript 运行时 |
| **Express** | 4.x | Web 应用框架 |
| **MySQL** | 9.7 | 关系型数据库 |
| **mysql2** | 3.x | MySQL 客户端 |
| **JWT** | 9.x | JSON Web Token |
| **bcryptjs** | 2.x | 密码加密 |
| **multer** | 1.x | 文件上传中间件 |
| **uuid** | 9.x | 唯一ID生成 |
| **EJS** | 3.x | 模板引擎 |

### 开发工具
- **HBuilderX** - UniApp 官方 IDE
- **VS Code** - 代码编辑器
- **Postman** - API 测试
- **Navicat** - 数据库管理

---

## 📦 快速开始

### 前置要求

- Node.js >= 16.0
- MySQL >= 8.0
- HBuilderX（推荐）或 VS Code
- Git

### 安装步骤

#### 1. 克隆项目

```bash
git clone https://github.com/zhutianliangtom/zhuzhucalled.git
cd zhuzhucalled
```

#### 2. 安装前端依赖

```bash
npm install
```

#### 3. 安装后端依赖

```bash
cd backend
npm install
```

#### 4. 配置数据库

```bash
# 登录 MySQL
mysql -u root -p

# 执行初始化脚本
source database.sql
```

或者使用命令行：

```bash
mysql -u root -p < database.sql
```

#### 5. 配置环境变量

在 `backend` 目录下创建 `.env` 文件：

```env
# 管理员账号
ADMIN_USER=admin
ADMIN_PASS=admin123

# MySQL 密码
MYSQL_PASSWORD=your_mysql_password

# JWT 密钥（可选，默认使用硬编码）
JWT_SECRET=your_jwt_secret_key
```

#### 6. 启动后端服务

```bash
cd backend
node server.js
```

成功启动后显示：
```
服务器运行在 http://localhost:5000
局域网访问: http://192.168.x.x:5000
外网映射: http://183.66.27.20:41412 (端口映射)
Web管理后台: http://183.66.27.20:41412/admin/login
```

#### 7. 启动前端开发

**方式一：使用 HBuilderX（推荐）**
1. 用 HBuilderX 打开项目目录
2. 点击"运行" -> "运行到浏览器" 或 "运行到手机或模拟器"

**方式二：使用命令行**

```bash
# 运行到 H5
npm run dev:h5

# 运行到微信小程序
npm run dev:mp-weixin
```

---

## 📁 项目结构

```
campus-lostfound/
├── backend/                    # 后端服务
│   ├── node_modules/          # Node 依赖
│   ├── uploads/               # 上传文件存储
│   │   ├── videos/            # 视频文件
│   │   └── *.jpg/png         # 图片文件
│   ├── views/                 # EJS 模板
│   │   ├── dashboard.ejs      # 管理后台首页
│   │   ├── items.ejs          # 物品管理
│   │   ├── users.ejs          # 用户管理
│   │   ├── versions.ejs       # 版本管理
│   │   ├── login.ejs          # 登录页面
│   │   └── download.html      # 下载页面
│   ├── server.js              # 主服务文件（5000端口）
│   ├── package.json           # 后端依赖
│   └── .env                   # 环境变量（需手动创建）
│
├── pages/                     # 前端页面
│   ├── auth/                  # 认证页面
│   │   ├── login.vue          # 登录
│   │   └── register.vue       # 注册
│   ├── index/                 # 首页
│   │   └── index.vue          # 物品列表
│   ├── item/                  # 物品相关
│   │   ├── detail.vue         # 物品详情
│   │   └── publish.vue        # 发布物品
│   ├── message/               # 消息相关
│   │   ├── index.vue          # 消息列表
│   │   ├── chat.vue           # 聊天页面
│   │   └── video-player.vue   # 视频播放器
│   └── user/                  # 用户中心
│       ├── index.vue          # 个人中心
│       ├── edit.vue           # 编辑资料
│       ├── settings.vue       # 设置
│       ├── my-items.vue       # 我的发布
│       ├── my-collection.vue  # 我的收藏
│       └── blocked-users.vue  # 黑名单管理
│
├── components/                # 公共组件
│   └── OfflineBanner.vue      # 断网提示组件
│
├── utils/                     # 工具函数
│   ├── api.js                 # API 封装（含心跳检测）
│   ├── format.js              # 格式化工具
│   ├── storage.js             # 本地存储
│   └── mock.js                # Mock 数据
│
├── static/                    # 静态资源
│   ├── icon/                  # 应用图标
│   ├── tabbar/                # 底部导航
│   └── logo.png               # Logo
│
├── uni_modules/               # UniApp 插件
├── unpackage/                 # 编译输出
├── App.vue                    # 应用入口
├── main.js                    # 主文件
├── manifest.json              # 应用配置
├── pages.json                 # 页面路由配置
├── database.sql               # 数据库初始化脚本
├── package.json               # 前端依赖
└── README.md                  # 项目说明
```

---

## 📡 API 文档

### 基础信息

- **Base URL**: `http://183.66.27.20:41412`
- **认证方式**: Bearer Token（JWT）
- **请求头**: `Authorization: Bearer <token>`

### 认证接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/auth/register` | 用户注册 | ❌ |
| POST | `/auth/login` | 用户登录 | ❌ |
| GET | `/auth/me` | 获取当前用户信息 | ✅ |

### 用户接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/user/info` | 获取用户信息 | ✅ |
| PUT | `/user/info` | 更新用户信息 | ✅ |
| GET | `/user/stats` | 获取用户统计数据 | ✅ |
| GET | `/user/items` | 获取用户发布的物品 | ✅ |
| GET | `/user/blocked` | 获取黑名单列表 | ✅ |
| POST | `/user/block` | 拉黑用户 | ✅ |
| POST | `/user/unblock` | 取消拉黑 | ✅ |
| GET | `/user/search` | 搜索用户 | ✅ |

### 物品接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/items` | 获取物品列表 | ❌ |
| GET | `/items/:id` | 获取物品详情 | ❌ |
| POST | `/items` | 发布物品 | ✅ |
| POST | `/items/:id/solve` | 标记为已解决 | ✅ |

### 消息接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/messages` | 获取对话列表 | ✅ |
| GET | `/messages/unread/count` | 获取未读总数 | ✅ |
| GET | `/messages/conversation/:userId` | 获取对话消息 | ✅ |
| POST | `/messages/conversation/:userId/read` | 标记对话已读 | ✅ |
| POST | `/messages/send` | 发送消息 | ✅ |
| POST | `/messages/:id/recall` | 撤回消息 | ✅ |

### 文件上传

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/upload/image` | 上传图片 | ✅ |
| POST | `/upload/video` | 上传视频 | ✅ |

### 版本管理

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/version/latest` | 获取最新版本 | ❌ |
| GET | `/version/list` | 获取版本列表 | ❌ |
| DELETE | `/admin/version/:id` | 删除版本 | ✅ Admin |

### 系统接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/heartbeat` | 心跳检测 | ❌ |
| GET | `/download` | 下载页面 | ❌ |

---

## 🗄️ 数据库设计

### 主要表结构

#### users（用户表）
```sql
- id: VARCHAR(255) PRIMARY KEY
- studentId: VARCHAR(50) UNIQUE
- name: VARCHAR(100)
- phone: VARCHAR(20)
- password: VARCHAR(255) -- bcrypt 加密
- avatar: TEXT
- className: VARCHAR(100)
- status: ENUM('pending', 'approved', 'rejected')
- blockedUsers: TEXT -- JSON 数组
- createdAt: BIGINT
```

#### items（物品表）
```sql
- id: VARCHAR(255) PRIMARY KEY
- userId: VARCHAR(255) FOREIGN KEY
- title: VARCHAR(255)
- description: TEXT
- type: ENUM('lost', 'found')
- status: ENUM('active', 'solved')
- images: TEXT -- JSON 数组
- contact: VARCHAR(100)
- location: VARCHAR(255)
- createdAt: BIGINT
```

#### messages（消息表）
```sql
- id: VARCHAR(255) PRIMARY KEY
- senderId: VARCHAR(255)
- receiverId: VARCHAR(255)
- content: TEXT
- type: ENUM('text', 'image', 'video', 'recalled')
- mediaUrl: TEXT
- read: BOOLEAN
- createdAt: BIGINT
```

#### versions（版本表）
```sql
- id: VARCHAR(255) PRIMARY KEY
- version: VARCHAR(20)
- versionCode: INT
- changelog: TEXT
- downloadUrl: TEXT
- forceUpdate: BOOLEAN
- createdAt: BIGINT
```

详细建表语句请查看 [database.sql](database.sql)

---

## 🚀 部署指南

### 生产环境部署

#### 1. 后端部署

**使用 PM2（推荐）**

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
cd backend
pm2 start server.js --name "lostfound-api"

# 开机自启
pm2 startup
pm2 save
```

**配置 Nginx 反向代理**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态文件
    location /uploads/ {
        alias /path/to/backend/uploads/;
        expires 30d;
    }
}
```

#### 2. 前端打包

**H5 版本**

```bash
npm run build:h5
```

生成的文件在 `unpackage/dist/build/h5/` 目录，部署到 Nginx 或其他 Web 服务器。

**Android APK**

1. 在 HBuilderX 中点击"发行" -> "原生App-云打包"
2. 选择 Android 平台
3. 填写应用信息
4. 等待打包完成，下载 APK

**微信小程序**

```bash
npm run build:mp-weixin
```

在微信开发者工具中导入 `unpackage/dist/build/mp-weixin/` 目录。

#### 3. 数据库备份

```bash
# 备份数据库
mysqldump -u root -p lost_found > backup_$(date +%Y%m%d).sql

# 恢复数据库
mysql -u root -p lost_found < backup_20240101.sql
```

---

## 🔧 常见问题

### 1. 后端启动失败

**问题**: `Error: Cannot find module 'express'`

**解决**: 
```bash
cd backend
npm install
```

### 2. 数据库连接失败

**问题**: `Access denied for user 'root'@'localhost'`

**解决**: 
- 检查 `.env` 文件中的 `MYSQL_PASSWORD` 是否正确
- 确认 MySQL 服务已启动
- 检查数据库 `lost_found` 是否已创建

### 3. 前端无法连接后端

**问题**: `Failed to connect to /183.66.27.20:41412`

**解决**: 
- 确认后端服务已启动
- 检查防火墙是否开放 5000 端口
- 如果使用外网映射，确认端口映射配置正确
- 检查 `utils/api.js` 中的 `baseUrl` 是否正确

### 4. 图片/视频无法显示

**问题**: 上传的文件无法访问

**解决**: 
- 确认 `backend/uploads` 目录存在且有写权限
- 检查后端返回的 URL 是否正确
- 确认前端 `getFullImageUrl()` 方法拼接的 URL 正确

### 5. 心跳检测一直失败

**问题**: 控制台不断显示"心跳检测失败"

**解决**: 
- 检查网络连接
- 确认后端 `/api/heartbeat` 接口可访问
- 检查是否有 CORS 问题

---

## 📝 开发规范

### Git 提交规范

```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 重构代码
test: 测试相关
chore: 构建过程或辅助工具的变动
```

示例：
```bash
git commit -m "feat: 添加黑名单管理功能"
git commit -m "fix: 修复消息已读未读状态更新问题"
```

### 代码风格

- 使用 2 空格缩进
- 变量名使用 camelCase
- 组件名使用 PascalCase
- 常量使用 UPPER_SNAKE_CASE
- 注释使用中文

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: add some feature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

## 👨‍💻 作者

**校园失物招领团队**

- GitHub: [@yourusername](https://github.com/yourusername)
- 邮箱: your-email@example.com

---

## 🙏 致谢

感谢以下开源项目：

- [UniApp](https://uniapp.dcloud.net.cn/) - 跨平台框架
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Express](https://expressjs.com/) - Node.js Web 框架
- [MySQL](https://www.mysql.com/) - 关系型数据库

---

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 📧 Email: 13239027385@163.com
- 💬 Issues: [GitHub Issues](https://github.com/zhutianliangtom/zhuzhucalled/issues)

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！**

Made with ❤️ by Campus LostFound Team

</div>

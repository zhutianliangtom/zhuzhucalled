# 后端日志代码生产环境安全检查

## Why
新添加的日志记录功能在 server.js、logs.ejs 中引入了多个可能导致生产环境崩溃或安全问题的代码缺陷，需要在部署前修复。

## What Changes
- 修复 logBuffer 内存泄漏（未限制最大大小，高流量下会无限增长）
- 修复 logBuffer 键名不匹配问题（getLogFileName 返回文件名，但 buffer 使用完整 key）
- 修复 cleanBuffer 清理逻辑缺陷（已刷盘的缓冲区 key 未清理导致内存泄漏）
- 修复 WebSocket 推送时 adminClients 包含非订阅客户端的潜在问题
- 修复 WebSocket URL 解析在 HTTPS 模式下 host 可能不包含端口的问题
- 修复请求日志中间件中 token 重复验证的性能问题（每个请求都验证一次 token，而 authenticateToken 也会验证）
- 修复 logs.ejs 中 WebSocket 连接在无 token 时静默失败
- 修复日志下载接口在目录不存在时的潜在错误

## Impact
- Affected specs: none (new feature code review)
- Affected code: server.js, backend/views/logs.ejs

## MODIFIED Requirements

### Requirement: HTTP 请求日志中间件
**Current**: 每次请求都解析和验证 JWT token 以获取用户信息
**Issue**: 与 `authenticateToken` 中间件重复验证，增加不必要的性能开销。当 token 无效但请求路径不需要认证时（如 `/items` 公开接口），会误把无效 token 用户标记为 `user:xxx`。

**Fix**: 使用 `req.user`（如果 `authenticateToken` 已经执行过），否则降级为 `anonymous`。不要手动重复验证 token。

### Requirement: 日志缓冲区管理
**Current**: `logBuffer` 是一个无限制的 JS 对象，每次写入都追加字符串
**Issue 1**: 在高流量场景下（例如每分钟 200+ 请求），日志缓冲区会持续增长，导致内存泄漏
**Issue 2**: `cleanBuffer` 函数的清理逻辑有缺陷 —— 它只在 `fileName !== today && logBuffer[fileName].length === 0` 时删除 key，但旧 key 刷盘后 length 已经是 0，这个条件是对的，但 `flushLogs` 和 `cleanBuffer` 之间有竞态条件

**Fix**: 添加缓冲区大小上限（例如每个文件最多保留 50000 行），超过上限后保留最近 N 行，丢弃最旧的行。

### Requirement: WebSocket 日志推送
**Current**: `log()` 函数遍历 `adminClients` Set，检查 `isAdminLogSubscriber` 标志后推送日志行
**Issue**: 如果管理员 WebSocket 连接断开但尚未被清理（`close` 事件延迟触发），对 `client.readyState` 的检查可能仍然为 `OPEN` 但实际已断开，`send` 可能抛出异常

**Fix**: 包裹 `send` 调用在 try-catch 中，失败时从 `adminClients` 移除该客户端。

### Requirement: 日志文件读取
**Current**: `fs.readFileSync` 和 `fs.readdirSync` 同步读取文件目录
**Issue**: 在高并发场景下（多个管理员同时访问 `/admin/logs`），同步读取大日志文件会阻塞事件循环
**Issue**: `fs.readdirSync` 在 `LOG_DIR` 不存在时抛出异常（虽然启动时会创建，但如果目录被手动删除则可能失败）

**Fix**: 对 `fs.existsSync(LOG_DIR)` 做前置检查。考虑将 `readFileSync` 改为 `readFile`（异步）。

### Requirement: logs.ejs WebSocket 连接
**Current**: 尝试从 cookie 中解析 token，如果找不到 token，`wsUrl` 中 token 为 `undefined`
**Issue**: WebSocket 连接会因为缺少 token 而被服务器关闭，但前端只记录了 "连接失败"，没有明确提示用户"未登录"

**Fix**: 在构建 `wsUrl` 前检查 token 是否存在，如果不存在则直接提示用户并返回，避免无效连接。

### Requirement: 请求日志中间件中的 res.end 包装
**Current**: 每个请求都包装 `res.end` 方法
**Issue**: 如果 `res.end` 被框架内部多次调用或者有其他中间件也包装了 `res.end`，可能导致重复日志或异常

**Fix**: 添加一个标志位 `res._logWrapped` 防止重复包装。

## REMOVED Requirements
无。

# Tasks

- [x] Task 1: 修复 logBuffer 内存泄漏 — 添加大小限制
  - [x] 1.1 在 log() 函数中添加行号计数器，限制每个日期文件最大行数（50000行）
  - [x] 1.2 超过限制时丢弃最旧的行，保留最近 N 行
  - [x] 1.3 验证：代码审查确认修改正确

- [x] Task 2: 修复 cleanBuffer 清理逻辑和刷盘竞态
  - [x] 2.1 确保 flushLogs 和 cleanBuffer 按正确顺序执行（当前已经正确）
  - [x] 2.2 添加 LOG_DIR 不存在时的防护（在 cleanBuffer 和 flushLogs 中检查）
  - [x] 2.3 验证：代码审查确认修改正确

- [x] Task 3: 修复 WebSocket 日志推送异常处理
  - [x] 3.1 在 log() 函数的 send 调用外包 try-catch
  - [x] 3.2 发送失败时从 adminClients 移除该客户端
  - [x] 3.3 验证：代码审查确认修改正确

- [x] Task 4: 修复请求日志中间件 token 验证问题
  - [x] 4.1 移除手动 jwt.verify 调用，改为依赖 req.user（由 authenticateToken 设置）
  - [x] 4.2 如果 req.user 不存在，标记为 anonymous
  - [x] 4.3 验证：代码审查确认修改正确

- [x] Task 5: 修复 res.end 重复包装
  - [x] 5.1 添加 res._logWrapped 标志检查
  - [x] 5.2 验证：代码审查确认修改正确

- [x] Task 6: 修复日志 API 目录不存在时的错误
  - [x] 6.1 在 /admin/logs API 路由中添加 LOG_DIR 存在性检查
  - [x] 6.2 在 /admin/logs/dates 路由中添加 LOG_DIR 存在性检查
  - [x] 6.3 验证：代码审查确认修改正确

- [x] Task 7: 修复 logs.ejs WebSocket 无 token 处理
  - [x] 7.1 在 connectWebSocket 中添加 token 为空时的检查
  - [x] 7.2 token 为空时提示用户并提前返回
  - [x] 7.3 验证：代码审查确认修改正确

- [x] Task 8: 验证日志颜色 ANSI 代码在文件写入中不会导致问题
  - [x] 8.1 确认 logLine（写入缓冲区和文件的）不含 ANSI 颜色代码
  - [x] 8.2 确认 colorLine（仅控制台输出）含颜色代码
  - [x] 8.3 验证：确认 logLine 格式为 `[${timestamp}] [${levelStr}] ${message}\n` 无 ANSI 代码

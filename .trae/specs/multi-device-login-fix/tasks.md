# Tasks: 多设备登录顶号功能修复

## 任务清单

- [x] Task 1: 修复后端登录接口，添加会话记录
  - 在 `backend/server.js` 的 `/auth/login` 接口中
  - 在生成 token 后调用 `addSession(user.id, token, deviceId)`
  - 确保登录成功后正确记录活跃会话

- [x] Task 2: 优化前端登录页面，取消处理逻辑
  - 在 `pages/auth/login.vue` 中
  - 用户点击"取消"时清空密码
  - 保持用户在登录页，不自动跳转

- [x] Task 3: 测试验证功能完整性
  - 模拟两个设备登录场景
  - 验证顶号提示是否正确显示
  - 验证旧设备是否被强制下线
  - 验证心跳检测是否正常工作

## 任务依赖
- Task 2 依赖 Task 1（需先修复后端才能测试）
- Task 3 依赖 Task 1 和 Task 2

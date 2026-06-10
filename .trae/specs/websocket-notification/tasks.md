# WebSocket 可靠消息通知 - 实现计划

## [x] Task 1: 创建 WebSocket 工具类
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 创建 utils/websocket.js 封装 WebSocket 连接管理
  - 实现连接、断开、重连逻辑
  - 实现消息监听和分发
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic` TR-1.1: WebSocket 连接成功后触发 connected 事件
  - `programmatic` TR-1.2: 连接断开后自动重连（最多重试5次）
  - `programmatic` TR-1.3: 消息接收延迟 < 3秒

## [x] Task 2: 集成 WebSocket 到 App.vue
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 在 App.vue 中初始化 WebSocket 连接
  - 处理消息接收事件
  - 触发系统通知
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4
- **Test Requirements**:
  - `programmatic` TR-2.1: 应用启动时自动连接 WebSocket
  - `human-judgment` TR-2.2: 收到消息时触发系统通知

## [x] Task 3: 实现消息去重机制
- **Priority**: P1
- **Depends On**: Task 1, Task 2
- **Description**: 
  - 记录最近一次通知时间
  - 实现 10 秒冷却时间
  - 避免重复通知
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-3.1: 同一用户 10 秒内只推送一次通知
  - `programmatic` TR-3.2: 不同用户的消息不互相影响

## [x] Task 4: 修复通知兼容性问题
- **Priority**: P1
- **Depends On**: Task 2
- **Description**: 
  - 确保 Android 通知渠道正确创建
  - 修复 PendingIntent 兼容性问题
  - 支持 Android 8.0+ 系统
- **Acceptance Criteria Addressed**: AC-3, AC-4
- **Test Requirements**:
  - `human-judgment` TR-4.1: 在 Android 8.0+ 设备上通知正常显示
  - `human-judgment` TR-4.2: 点击通知能跳转到聊天页面

## [x] Task 5: 测试与验证
- **Priority**: P2
- **Depends On**: 所有任务
- **Description**: 
  - 测试 WebSocket 连接稳定性
  - 测试消息通知功能
  - 验证通知点击跳转
- **Acceptance Criteria Addressed**: 所有 AC
- **Test Requirements**:
  - `human-judgment` TR-5.1: 前台、后台、锁屏状态下通知正常
  - `human-judgment` TR-5.2: 通知点击正确跳转到对应聊天页面
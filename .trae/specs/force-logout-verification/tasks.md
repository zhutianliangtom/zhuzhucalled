# 顶号登录强制下线验证 - 实施计划

## [x] 任务1: 验证后端WebSocket认证黑名单检查
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 验证后端WebSocket连接时检查token是否在黑名单中
  - 验证被拉黑的token无法建立WebSocket连接
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: 使用已拉黑的token连接WebSocket应被拒绝（code=1008）
  - `programmatic` TR-1.2: 服务器日志应记录"Token已被拉黑，拒绝连接"
- **Notes**: 需要准备一个已被拉黑的token

## [x] 任务2: 验证后端顶号时断开WebSocket连接
- **Priority**: P0
- **Depends On**: 任务1
- **Description**: 
  - 验证顶号登录时后端主动断开原设备WebSocket连接
  - 验证关闭码为1008
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-2.1: 顶号登录成功后，原设备WebSocket连接应被断开
  - `programmatic` TR-2.2: 断开时的关闭码应为1008
- **Notes**: 需要模拟两个设备登录同一账号

## [x] 任务3: 验证前端WebSocket检测强制下线
- **Priority**: P0
- **Depends On**: 任务2
- **Description**: 
  - 验证前端WebSocket收到1008关闭码时触发强制下线事件
  - 验证停止自动重连
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic` TR-3.1: WebSocket关闭码为1008时应触发'force-logout'事件
  - `programmatic` TR-3.2: 触发强制下线后shouldReconnect应为false
- **Notes**: 需要模拟WebSocket连接被断开

## [x] 任务4: 验证App.vue处理强制下线事件
- **Priority**: P0
- **Depends On**: 任务3
- **Description**: 
  - 验证App.vue正确监听'force-logout'事件
  - 验证调用handleForceLogout方法
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4
- **Test Requirements**:
  - `programmatic` TR-4.1: 触发'force-logout'事件时应调用api.handleForceLogout()
  - `programmatic` TR-4.2: 应调用websocket.disconnect()停止连接
- **Notes**: 需要验证全局事件监听器

## [x] 任务5: 验证前端清除用户数据
- **Priority**: P0
- **Depends On**: 任务4
- **Description**: 
  - 验证handleForceLogout清除localStorage中的token和user
  - 验证停止心跳检测
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-5.1: 执行handleForceLogout后storage.getToken()应为null
  - `programmatic` TR-5.2: 执行handleForceLogout后storage.getUser()应为null
- **Notes**: 需要验证localStorage操作

## [x] 任务6: 验证页面自动跳转登录页
- **Priority**: P0
- **Depends On**: 任务5
- **Description**: 
  - 验证强制下线后自动跳转到登录页面
  - 验证显示友好的提示信息
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-6.1: 执行handleForceLogout后应调用uni.reLaunch跳转到登录页
  - `human-judgment` TR-6.2: 用户应看到"您的账号已在其他设备登录"提示
- **Notes**: 需要验证页面跳转逻辑
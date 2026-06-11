# 旧版本App强制下线功能 - 实施计划

## [x] 任务1: 增强后端心跳接口的错误信息
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 确保心跳接口返回401时，错误信息明确包含"其他设备"关键词
  - 这样前端能通过关键词匹配触发强制下线
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: 使用黑名单token调用心跳接口，应返回401
  - `programmatic` TR-1.2: 响应message应包含"其他设备"关键词
- **Notes**: 检查server.js中authenticateToken中间件

## [x] 任务2: 增强前端心跳失败处理
- **Priority**: P0
- **Depends On**: 任务1
- **Description**: 
  - 在api.js的checkHeartbeat()中，检测401错误并触发强制下线
  - 确保所有版本的App都能处理心跳失败
- **Acceptance Criteria Addressed**: AC-2, AC-3
- **Test Requirements**:
  - `programmatic` TR-2.1: 心跳返回401且message包含"其他设备"时，应调用handleForceLogout()
  - `programmatic` TR-2.2: 不应继续增加heartbeatFailCount（避免触发离线横幅）
- **Notes**: 需要兼容新旧版本App的代码

## [x] 任务3: 确保前端401响应处理逻辑完整
- **Priority**: P0
- **Depends On**: 任务2
- **Description**: 
  - 验证api.js的request()方法正确处理401响应
  - 确保message匹配逻辑覆盖所有可能的错误信息格式
- **Acceptance Criteria Addressed**: AC-2, AC-3
- **Test Requirements**:
  - `programmatic` TR-3.1: 401响应message包含"其他设备登录"或"其他设备"时，触发强制下线
  - `programmatic` TR-3.2: 应清除token和用户数据
  - `programmatic` TR-3.3: 应跳转到登录页
- **Notes**: 检查api.js的handleForceLogout()方法

## [ ] 任务4: 添加版本检测（可选）
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 在强制下线提示中，对旧版本App显示"请更新App"建议
  - 通过User-Agent或版本号判断
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgment` TR-4.1: 提示信息友好且清晰
  - `programmatic` TR-4.2: 能正确识别App版本
- **Notes**: 此任务为可选，优先级较低

## [x] 任务5: 测试验证
- **Priority**: P0
- **Depends On**: 任务1, 任务2, 任务3
- **Description**: 
  - 模拟旧版本App被顶号的情况
  - 验证所有强制下线路径都能正常工作
- **Acceptance Criteria Addressed**: AC-3, AC-4
- **Test Requirements**:
  - `programmatic` TR-5.1: 顶号后，心跳接口应立即返回401
  - `programmatic` TR-5.2: 前端应在1-2个心跳周期内被强制下线
  - `human-judgment` TR-5.3: 用户体验流畅，无明显卡顿
- **Notes**: 需要两个设备测试

# 旧版本App强制下线功能 - 产品需求文档

## Overview
- **Summary**: 解决旧版本App用户在被顶号登录后无法强制退出的问题
- **Purpose**: 确保所有版本的App（包括旧版本）在被顶号后都能强制下线，保障账号安全
- **Target Users**: 所有使用校园失物招领App的用户，特别是未更新到最新版本的旧版本用户

## Goals
- 确保旧版本App在被顶号后能自动退出登录
- 通过心跳接口检测token有效性，实现跨版本强制下线
- 提供友好的用户提示，引导用户更新App

## Non-Goals (Out of Scope)
- 不强制用户更新App（可选更新）
- 不修改已打包的旧版本App代码
- 不验证特定旧版本的代码实现

## Background & Context
当前问题：
1. 用户A使用旧版本App登录
2. 用户B在新设备顶号登录用户A的账号
3. 后端已正确将旧token加入黑名单并断开WebSocket
4. 但旧版本App没有最新的强制下线代码（websocket.js、App.vue的force-logout监听等）
5. 导致旧版本App仍然保持登录状态

根本原因：
- 旧版本App的`websocket.js`没有检测1008关闭码的逻辑
- 旧版本App的`App.vue`没有监听`force-logout`全局事件
- 旧版本App的心跳检测可能没有正确处理401响应

## Functional Requirements
- **FR-1**: 心跳接口必须检测token是否在黑名单中（已实现）
- **FR-2**: 前端必须处理心跳失败的401响应
- **FR-3**: 旧版本App在收到401响应后应清除用户数据
- **FR-4**: 旧版本App在收到401响应后应跳转到登录页

## Non-Functional Requirements
- **NFR-1**: 强制下线响应时间应在心跳间隔内（15-30秒）
- **NFR-2**: 用户体验友好，显示清晰的提示信息
- **NFR-3**: 不影响正常网络波动的处理

## Constraints
- **Technical**: 必须兼容所有已发布的App版本
- **Technical**: 不能破坏现有功能
- **Dependencies**: 需要后端`authenticateToken`中间件正常工作

## Assumptions
- 所有版本的App都会定期发送心跳请求
- 心跳请求携带有效的JWT token
- 后端能正确检测黑名单中的token

## Acceptance Criteria

### AC-1: 心跳接口检测黑名单Token
- **Given**: 用户的token已被加入黑名单（被顶号）
- **When**: 旧版本App发送心跳请求
- **Then**: 服务器返回401状态码，message包含"其他设备"
- **Verification**: `programmatic`

### AC-2: 前端处理心跳401响应
- **Given**: 心跳请求返回401状态码
- **When**: 前端收到响应
- **Then**: 触发强制登出处理（清除数据、跳转登录页）
- **Verification**: `programmatic`

### AC-3: 旧版本App强制下线
- **Given**: 旧版本App的心跳请求被拒绝（401）
- **When**: 前端处理401响应
- **Then**: 清除用户数据并跳转到登录页
- **Verification**: `programmatic`

### AC-4: 用户看到友好提示
- **Given**: 收到强制下线通知
- **When**: 执行强制下线处理
- **Then**: 显示"您的账号已在其他设备登录"提示
- **Verification**: `human-judgment`

## Open Questions
- [ ] 是否需要区分新旧版本App，对旧版本显示"请更新App"提示？
- [ ] 心跳频率是否足够快以及时检测顶号？

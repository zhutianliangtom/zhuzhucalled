# 顶号登录强制下线功能 - 测试验证规范

## Overview
- **Summary**: 验证当用户在新设备登录同一账号时，原设备能够被强制下线并跳转到登录页面
- **Purpose**: 确保账号安全，防止同一账号在多个设备同时登录
- **Target Users**: 所有使用校园失物招领App的用户

## Goals
- 验证顶号登录后原设备能正常收到强制下线通知
- 验证原设备能自动清除用户数据并跳转到登录页
- 验证WebSocket连接能正确检测强制下线

## Non-Goals (Out of Scope)
- 不验证服务器端的token黑名单机制（已实现）
- 不验证登录页面UI设计
- 不验证普通登录流程

## Background & Context
当前系统已实现以下机制：
1. 后端 `/auth/login/force` 接口清除用户所有旧会话并加入黑名单
2. 后端WebSocket认证时检查token黑名单
3. 前端WebSocket检测到1008关闭码时触发强制下线
4. 前端HTTP请求收到401时触发强制下线

## Functional Requirements
- **FR-1**: 当设备B顶号登录设备A的账号时，设备A应收到强制下线通知
- **FR-2**: 设备A收到强制下线通知后应清除用户数据
- **FR-3**: 设备A清除数据后应自动跳转到登录页面

## Non-Functional Requirements
- **NFR-1**: 强制下线响应时间应在1秒内
- **NFR-2**: 用户体验友好，显示清晰的提示信息

## Constraints
- **Technical**: 基于uniapp框架，支持Android平台
- **Dependencies**: 需要后端服务器正常运行

## Assumptions
- 用户已在设备A登录并保持在线
- 设备B使用相同账号密码登录
- 网络连接正常

## Acceptance Criteria

### AC-1: 原设备WebSocket被断开后触发强制下线
- **Given**: 用户在设备A登录成功，WebSocket连接正常
- **When**: 用户在设备B使用同一账号顶号登录
- **Then**: 设备A的WebSocket连接被服务器断开，收到关闭码1008
- **Verification**: `programmatic`

### AC-2: 原设备显示强制下线提示
- **Given**: 设备A的WebSocket连接被断开（code=1008）
- **When**: 系统检测到强制下线事件
- **Then**: 显示"您的账号已在其他设备登录"提示
- **Verification**: `human-judgment`

### AC-3: 原设备自动清除用户数据
- **Given**: 收到强制下线通知
- **When**: 执行强制下线处理
- **Then**: localStorage中的token和user信息被清除
- **Verification**: `programmatic`

### AC-4: 原设备自动跳转到登录页
- **Given**: 用户数据已清除
- **When**: 强制下线处理完成
- **Then**: 页面自动跳转到登录页面
- **Verification**: `programmatic`

## Open Questions
- [ ] 暂无
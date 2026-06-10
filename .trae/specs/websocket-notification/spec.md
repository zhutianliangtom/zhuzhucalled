# WebSocket 可靠消息通知 - 产品需求文档

## Overview
- **Summary**: 确保 UniApp Android 应用的 WebSocket 功能可靠，能够及时推送消息通知给用户，包括前台、后台、锁屏等各种状态。
- **Purpose**: 解决当前消息推送不可靠的问题，提升用户体验，确保用户不会错过重要消息。
- **Target Users**: 校园失物招领 App 的所有用户

## Goals
- 确保 WebSocket 连接稳定可靠
- 实现消息的实时推送
- 支持前台、后台、锁屏状态下的消息通知
- 实现通知点击跳转功能
- 防止消息重复推送

## Non-Goals (Out of Scope)
- 第三方推送服务集成（如 Firebase Cloud Messaging）
- iOS 平台推送优化
- 消息离线存储（已存在）

## Background & Context
当前应用使用 HTTP 轮询方式获取新消息，存在以下问题：
1. 轮询间隔固定，实时性不足
2. 后台保活能力有限
3. 通知推送存在兼容性问题

## Functional Requirements
- **FR-1**: 建立稳定的 WebSocket 连接
- **FR-2**: 实现消息实时接收和分发
- **FR-3**: 显示系统原生通知（前台/后台）
- **FR-4**: 通知点击跳转到对应聊天页面
- **FR-5**: 消息去重机制

## Non-Functional Requirements
- **NFR-1**: 消息延迟 < 3秒
- **NFR-2**: WebSocket 重连时间 < 5秒
- **NFR-3**: 支持 Android 8.0+ 系统
- **NFR-4**: 通知渠道配置正确

## Constraints
- **Technical**: UniApp APP-PLUS 平台，Android 原生通知 API
- **Business**: 保持现有架构不变
- **Dependencies**: plus.android API

## Assumptions
- 服务器端已支持 WebSocket 协议
- 用户已授予通知权限

## Acceptance Criteria

### AC-1: WebSocket 连接建立
- **Given**: 应用已启动且用户已登录
- **When**: 网络连接正常
- **Then**: WebSocket 连接成功建立
- **Verification**: `programmatic`
- **Notes**: 连接失败时自动重试

### AC-2: 消息实时接收
- **Given**: WebSocket 连接已建立
- **When**: 服务器推送新消息
- **Then**: 客户端在 3 秒内接收到消息
- **Verification**: `programmatic`

### AC-3: 前台消息通知
- **Given**: 应用处于前台
- **When**: 收到新消息
- **Then**: 显示系统弹窗通知
- **Verification**: `human-judgment`

### AC-4: 后台消息通知
- **Given**: 应用处于后台或锁屏状态
- **When**: 收到新消息
- **Then**: 显示系统通知，点击可跳转
- **Verification**: `human-judgment`

### AC-5: 通知去重
- **Given**: 同一用户短时间内发送多条消息
- **When**: 收到多条消息
- **Then**: 10秒内只推送一次通知
- **Verification**: `programmatic`

## Open Questions
- [ ] 服务器端 WebSocket 实现是否就绪？
- [ ] 是否需要处理网络切换场景？
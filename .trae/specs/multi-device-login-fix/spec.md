# 多设备登录顶号功能修复规范

## Why
当前实现的多设备登录限制功能未生效，原因是后端普通登录接口未正确记录会话，导致 `hasOtherDevice` 检测逻辑无法正常工作。

## What Changes
- 后端登录接口添加会话记录
- 优化用户体验流程

## Impact
- Affected specs: 无
- Affected code: 
  - `backend/server.js` - 修复登录接口
  - `pages/auth/login.vue` - 优化取消处理

## ADDED Requirements
无

## MODIFIED Requirements
### Requirement: 普通登录会话记录
普通登录成功时，系统 SHALL 调用 `addSession` 记录活跃会话。

#### Scenario: 单设备首次登录
- **WHEN** 用户在第一台设备输入正确账号密码并登录
- **THEN** 系统记录该用户会话，返回 `hasOtherDevice: false`

#### Scenario: 多设备登录检测
- **WHEN** 用户在第二台设备输入相同账号密码并登录
- **THEN** 系统检测到已有活跃会话，返回 `hasOtherDevice: true`，前端显示顶号确认提示

### Requirement: 登录会话清理
登录成功后旧会话应根据策略处理。

#### Scenario: 普通登录
- **WHEN** 用户普通登录成功（无其他设备登录）
- **THEN** 创建新会话，旧会话保留（同一设备重复登录场景）

#### Scenario: 强制登录
- **WHEN** 用户确认顶号登录
- **THEN** 清除该用户所有旧会话并加入黑名单，创建新会话

## REMOVED Requirements
无

## 核心问题分析

### 问题1：会话未记录
```javascript
// 当前代码（错误）
app.post('/auth/login', ..., async (req, res) => {
  // ... 验证逻辑
  const token = jwt.sign(...)
  res.json({ token, hasOtherDevice: ... })  // ❌ 没有调用 addSession
})
```

### 问题2：hasOtherDevice 永远为 false
```javascript
// 因为会话列表为空，所以永远检测不到其他设备
const hasOtherDevice = getActiveSessionCount(user.id) > 0  // ❌ 永远是 false
```

## 修复方案

### 1. 后端修复
在登录接口中添加会话记录：
```javascript
const token = jwt.sign(...)
addSession(user.id, token, deviceId)  // ✅ 添加这行
res.json({ token, hasOtherDevice, ... })
```

### 2. 前端优化
当用户取消顶号确认时，清空密码并停留在登录页：
```javascript
showForceLoginConfirm(res) {
  uni.showModal({
    // ...
    success: (modalRes) => {
      if (modalRes.confirm) {
        // 顶号登录
      } else {
        // 取消：清空密码，保持在登录页
        this.form.password = ''
      }
    }
  })
}
```

### 3. 心跳检测强化
确保心跳检测能够及时发现被顶号：
- 已有实现：authenticateToken 中检查黑名单
- 已有实现：心跳接口更新活跃时间
- 已有实现：前端 handleForceLogout 自动退出

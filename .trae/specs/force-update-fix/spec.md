# 强制更新逻辑修复

## Why
前端 App.vue 和 settings.vue 的版本更新检查逻辑缺少必要的校验：
- 后端返回 null 或异常数据时前端静默失败
- 网络请求失败时无任何提示
- forceUpdate 字段类型未校验

后端版本发布接口缺少校验：
- 不校验 versionCode 是否递增
- 不校验版本号格式
- 导致 admin 可以发布无效版本，强制更新按钮形同虚设

## What Changes
- 后端 `/admin/version/publish` 增加 versionCode 递增校验和版本号格式校验
- 后端 `/version/latest` 返回数据增加字段校验和默认值处理
- 前端 App.vue checkUpdate() 增加响应数据校验、错误提示
- 前端 settings.vue checkUpdate() 增加响应数据校验、错误提示
- 前端统一版本比较和更新提示逻辑

## Impact
- Affected specs: none
- Affected code:
  - backend/server.js (版本发布接口、版本查询接口)
  - App.vue (checkUpdate 方法)
  - pages/user/settings.vue (checkUpdate 方法)
  - utils/api.js (无修改)

## MODIFIED Requirements

### Requirement: 后端版本发布接口校验
后端 `/admin/version/publish` 接口 SHALL 校验以下内容：
- version 字段格式必须匹配正则 `^\d+\.\d+\.\d+$`
- versionCode 字段必须为正整数
- versionCode 必须大于数据库中已有最大 versionCode（不允许回退）
- 若校验失败，返回 400 错误及具体原因

#### Scenario: versionCode 未递增
- **WHEN** admin 提交 versionCode 小于等于已有最大 versionCode
- **THEN** 返回 400，message: "版本码必须大于最新版本码 XXX"

#### Scenario: 版本号格式错误
- **WHEN** admin 提交 version 不符合 X.Y.Z 格式
- **THEN** 返回 400，message: "版本号格式不正确，请使用 X.Y.Z 格式"

#### Scenario: 校验通过
- **WHEN** 所有校验通过
- **THEN** 正常发布版本，返回 200

### Requirement: 后端版本查询接口返回
后端 `/version/latest` 接口 SHALL 保证返回数据结构完整：
- 若无版本记录，返回 `{ data: null }`
- 若有版本记录，`forceUpdate` 字段必须为布尔类型（默认 false）
- `versionCode` 必须为正整数

#### Scenario: 数据库无版本记录
- **WHEN** 调用 GET /version/latest
- **THEN** 返回 `{ data: null }`

#### Scenario: 数据库有版本记录
- **WHEN** 调用 GET /version/latest
- **THEN** 返回完整版本信息，forceUpdate 为布尔值

## ADDED Requirements

### Requirement: 前端版本更新检查错误处理
前端 App.vue 和 settings.vue 的 checkUpdate() 方法 SHALL：
- 网络请求失败时显示错误提示 toast
- 后端返回 null（无版本记录）时显示"暂无版本更新信息"
- 返回数据缺少必要字段时显示错误提示
- 成功检查无更新时显示"当前已是最新版本"

#### Scenario: 网络请求失败
- **WHEN** api.getLatestVersion() 抛出异常
- **THEN** 显示 toast "检查更新失败，请检查网络"

#### Scenario: 后端无版本记录
- **WHEN** res.data 为 null
- **THEN** 显示 toast "暂无版本更新信息"

#### Scenario: 有更新且非强制
- **WHEN** latest.versionCode > currentCode 且 latest.forceUpdate 为 false
- **THEN** 显示更新弹窗，有"立即更新"和"稍后再说"按钮

#### Scenario: 有更新且强制
- **WHEN** latest.versionCode > currentCode 且 latest.forceUpdate 为 true
- **THEN** 显示更新弹窗，无"稍后再说"按钮，取消则调用 `plus.runtime.quit()` 退出 App
- **THEN** 设置 `forceQuitHandled = true` 标记，本次启动不再重复弹窗

### Requirement: 强制更新阻塞机制
前端 App.vue 的 checkUpdate() 方法 SHALL 实现强制更新阻塞：
- 移除 `hasShownUpdateNotification` 一次性跳过标记
- 每次启动和回到前台都检查版本更新
- 强制更新时用户不点击"立即更新"就退出 App
- 退出后再次启动 App 会重复上述流程，直到用户安装新版本
- 非强制更新时用户可以跳过，正常进入 App

#### Scenario: 强制更新用户不更新
- **WHEN** 后端 forceUpdate 为 true 且用户当前版本不是最新
- **THEN** 每次启动 App 都弹出更新弹窗（无取消按钮）
- **THEN** 用户不点击"立即更新"则 App 退出
- **THEN** 用户再次打开 App 重复上述流程

#### Scenario: 非强制更新用户跳过
- **WHEN** 后端 forceUpdate 为 false 且用户当前版本不是最新
- **THEN** 显示更新弹窗，有"立即更新"和"稍后再说"按钮
- **THEN** 用户点击"稍后再说"后正常进入 App

#### Scenario: 已是最新版本
- **WHEN** latest.versionCode <= currentCode
- **THEN** 显示 toast "当前已是最新版本"

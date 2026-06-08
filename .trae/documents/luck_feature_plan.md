# 今日人品功能实现计划

## 需求分析

根据用户需求，需要在三个位置添加「查看今日人品」功能：

1. **管理后台** (`dashboard.ejs`) - 数据概览页面添加人品显示
2. **官网下载页面** (`download.html`) - 每个IP每天只能查看一次
3. **Android App设置页面** (`pages/user/settings.vue`) - 每个账号每天只能查看一次

功能特点：
- 算法：随机生成 0-100 的整数
- 附带锐评话语
- UI简约设计

## 实现方案

### 1. 后端API接口

在 `backend/server.js` 中添加：
- `/luck/today` - 获取今日人品（公共接口，基于IP限制）
- `/luck/today/user` - 获取今日人品（需登录，基于用户ID限制）

使用内存缓存实现每日限制，无需数据库存储。

### 2. 管理后台修改

修改 `backend/views/dashboard.ejs`：
- 在数据概览页面添加人品显示卡片
- 直接调用公共接口（管理后台不限制次数）

### 3. 官网下载页面修改

修改 `backend/views/download.html`：
- 添加人品显示区域
- 调用 `/luck/today` 接口
- 显示人品数值和锐评

### 4. App设置页面修改

修改 `pages/user/settings.vue`：
- 添加"今日人品"菜单项
- 点击后调用 `/luck/today/user` 接口
- 弹窗显示人品结果

## 文件修改清单

| 文件路径 | 修改内容 |
|---------|---------|
| `backend/server.js` | 添加人品API接口和缓存逻辑 |
| `backend/views/dashboard.ejs` | 添加人品显示卡片 |
| `backend/views/download.html` | 添加人品显示区域 |
| `pages/user/settings.vue` | 添加人品菜单和弹窗 |
| `utils/api.js` | 添加人品API调用方法 |

## 锐评话语设计

根据人品值范围设计不同评语：

| 分数范围 | 评语 |
|---------|------|
| 0-20 | 非酋附体，建议今天宅家 |
| 21-40 | 运气平平，出门小心 |
| 41-60 | 普普通通，一切正常 |
| 61-80 | 运气不错，可以一试 |
| 81-95 | 欧皇降临，大吉大利 |
| 96-100 | 天选之子，快去买彩票 |

## 缓存策略

- 使用内存对象存储每日记录
- Key格式：`luck_YYYYMMDD_<ip/userId>`
- 每天自动清理过期记录

## 执行步骤

1. 先修改后端 `server.js` 添加API接口
2. 修改 `utils/api.js` 添加客户端调用方法
3. 修改管理后台 `dashboard.ejs`
4. 修改官网 `download.html`
5. 修改App设置页面 `settings.vue`

## 风险评估

- 内存缓存可能在服务器重启后丢失，但每日限制在重启后重新计算，影响较小
- 需要注意IP获取的准确性，特别是代理场景
-- ================================================
-- 校园失物招领系统 - 数据库初始化脚本
-- 适用于 MySQL 8.0+ / 9.7.0 商业版
-- 
-- 使用方法:
-- Windows: source C:\Users\zhuzhu\Desktop\zhuzhucalled\database.sql;
-- Linux/Mac: source /path/to/database.sql;
-- 或者: mysql -u root -p < database.sql
-- ================================================

-- 删除旧数据库（可选，谨慎使用）
-- DROP DATABASE IF EXISTS lost_found;

-- 创建数据库
CREATE DATABASE IF NOT EXISTS lost_found 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE lost_found;

-- ================================================
-- 1. 用户表 (users)
-- 存储学生用户信息，包含身份认证和黑名单功能
-- ================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY COMMENT '用户唯一ID (UUID)',
    studentId VARCHAR(50) UNIQUE NOT NULL COMMENT '学号',
    name VARCHAR(100) NOT NULL COMMENT '姓名/昵称',
    phone VARCHAR(20) NOT NULL COMMENT '手机号',
    password VARCHAR(255) NOT NULL COMMENT '密码 (bcrypt加密)',
    avatar TEXT COMMENT '头像URL',
    className VARCHAR(100) NOT NULL COMMENT '班级',
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT '审核状态',
    blockedUsers TEXT COMMENT '拉黑的用户ID列表 (JSON数组)',
    createdAt BIGINT NOT NULL COMMENT '创建时间戳 (秒)',
    INDEX idx_studentId (studentId),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ================================================
-- 2. 物品表 (items)
-- 存储失物招领信息，支持寻物和招领两种类型
-- ================================================
CREATE TABLE IF NOT EXISTS items (
    id VARCHAR(255) PRIMARY KEY COMMENT '物品唯一ID (UUID)',
    userId VARCHAR(255) NOT NULL COMMENT '发布者ID',
    title VARCHAR(255) NOT NULL COMMENT '标题',
    description TEXT COMMENT '详细描述',
    type ENUM('lost', 'found') NOT NULL COMMENT '类型: lost-寻物, found-招领',
    status ENUM('active', 'solved') DEFAULT 'active' COMMENT '状态: active-进行中, solved-已解决',
    images TEXT COMMENT '图片URL列表 (JSON数组)',
    contact VARCHAR(100) COMMENT '联系方式',
    location VARCHAR(255) COMMENT '地点',
    createdAt BIGINT NOT NULL COMMENT '发布时间戳 (秒)',
    INDEX idx_userId (userId),
    INDEX idx_status (status),
    INDEX idx_type (type),
    INDEX idx_createdAt (createdAt),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='物品表';

-- ================================================
-- 3. 消息表 (messages)
-- 存储用户间的聊天记录，支持文字、图片、视频
-- ================================================
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(255) PRIMARY KEY COMMENT '消息唯一ID (UUID)',
    senderId VARCHAR(255) NOT NULL COMMENT '发送者ID',
    receiverId VARCHAR(255) NOT NULL COMMENT '接收者ID',
    content TEXT COMMENT '消息内容',
    type ENUM('text', 'image', 'video', 'recalled') DEFAULT 'text' COMMENT '消息类型',
    mediaUrl TEXT COMMENT '媒体文件URL (图片/视频)',
    `read` BOOLEAN DEFAULT FALSE COMMENT '是否已读',
    createdAt BIGINT NOT NULL COMMENT '发送时间戳 (秒)',
    INDEX idx_senderId (senderId),
    INDEX idx_receiverId (receiverId),
    INDEX idx_createdAt (createdAt),
    INDEX idx_read (`read`),
    FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息表';

-- ================================================
-- 4. 版本表 (versions)
-- 存储App版本信息，用于版本检测和更新
-- ================================================
CREATE TABLE IF NOT EXISTS versions (
    id VARCHAR(255) PRIMARY KEY COMMENT '版本记录ID (UUID)',
    version VARCHAR(50) NOT NULL COMMENT '版本号 (如: 1.0.0)',
    versionCode INT NOT NULL COMMENT '版本代码 (递增整数)',
    changelog TEXT COMMENT '更新日志',
    apkUrl TEXT COMMENT 'APK下载链接',
    forceUpdate BOOLEAN DEFAULT FALSE COMMENT '是否强制更新',
    createdAt BIGINT NOT NULL COMMENT '发布时间戳 (秒)',
    INDEX idx_versionCode (versionCode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='版本表';

-- ================================================
-- 数据库初始化完成！
-- ================================================
SELECT '✅ 数据库初始化完成！' AS message;
SELECT '📊 已创建的表:' AS info;
SHOW TABLES;

-- ================================================
-- 📝 使用说明：
-- 
-- 1️⃣ 执行此SQL脚本后，启动后端服务会自动初始化管理员账号
--    管理员账号: admin / admin123
-- 
-- 2️⃣ 首次登录后请及时修改管理员密码
-- 
-- 3️⃣ 普通用户注册后需要管理员审核才能登录
-- 
-- 4️⃣ 数据备份命令:
--    mysqldump -u root -p lost_found > backup_$(date +%Y%m%d).sql
-- 
-- 5️⃣ 数据恢复命令:
--    mysql -u root -p lost_found < backup_20240101.sql
-- 
-- 6️⃣ 如需重置数据库，取消注释第11行的 DROP DATABASE 语句
--    ⚠️ 警告：这将删除所有数据！
-- ================================================

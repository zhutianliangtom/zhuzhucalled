-- ================================================
-- 校园失物招领系统 - 数据库初始化脚本
-- 适用于 MySQL 9.7.0 商业版
-- 使用方法: source C:\Users\zhuzhu\Desktop\zhuzhucalled\database.sql;
-- ================================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS lost_found CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE lost_found;

-- ================================================
-- 1. 用户表
-- ================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    studentId VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar TEXT,
    className VARCHAR(100) NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    blockedUsers TEXT,
    createdAt BIGINT NOT NULL,
    INDEX idx_studentId (studentId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================================================
-- 2. 物品表（失物招领）
-- ================================================
CREATE TABLE IF NOT EXISTS items (
    id VARCHAR(255) PRIMARY KEY,
    userId VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type ENUM('lost', 'found') NOT NULL,
    status ENUM('active', 'solved') DEFAULT 'active',
    images TEXT,
    contact VARCHAR(100),
    location VARCHAR(255),
    createdAt BIGINT NOT NULL,
    INDEX idx_userId (userId),
    INDEX idx_status (status),
    INDEX idx_type (type),
    INDEX idx_createdAt (createdAt),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================================================
-- 3. 消息表
-- ================================================
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(255) PRIMARY KEY,
    senderId VARCHAR(255) NOT NULL,
    receiverId VARCHAR(255) NOT NULL,
    content TEXT,
    type ENUM('text', 'image', 'video', 'recalled') DEFAULT 'text',
    mediaUrl TEXT,
    `read` BOOLEAN DEFAULT FALSE,
    createdAt BIGINT NOT NULL,
    INDEX idx_senderId (senderId),
    INDEX idx_receiverId (receiverId),
    INDEX idx_createdAt (createdAt),
    FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================================================
-- 4. 版本表
-- ================================================
CREATE TABLE IF NOT EXISTS versions (
    id VARCHAR(255) PRIMARY KEY,
    version VARCHAR(50) NOT NULL,
    versionCode INT NOT NULL,
    changelog TEXT,
    apkUrl TEXT,
    forceUpdate BOOLEAN DEFAULT FALSE,
    createdAt BIGINT NOT NULL,
    INDEX idx_versionCode (versionCode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================================================
-- 完成提示
-- ================================================
SELECT '数据库初始化完成！' AS message;
SHOW TABLES;

-- ================================================
-- 使用说明：
-- 1. 执行此SQL后，需要运行后端服务来初始化管理员账号
-- 2. 管理员账号: admin / admin123
-- 3. 首次登录后请及时修改密码
-- ================================================

-- ================================================
-- 数据库检查与诊断脚本
-- ================================================

USE lost_found;

-- 1. 检查所有表
SELECT '=== 所有表 ===' AS info;
SHOW TABLES;

-- 2. 检查用户表数据
SELECT '=== 用户表数据 ===' AS info;
SELECT id, studentId, name, phone, className, status, isAdmin, createdAt 
FROM users 
ORDER BY createdAt DESC;

-- 3. 检查物品表数据
SELECT '=== 物品表数据 ===' AS info;
SELECT COUNT(*) AS total_items, 
       SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_items,
       SUM(CASE WHEN status = 'solved' THEN 1 ELSE 0 END) AS solved_items
FROM items;

-- 4. 检查消息表数据
SELECT '=== 消息表数据 ===' AS info;
SELECT COUNT(*) AS total_messages FROM messages;

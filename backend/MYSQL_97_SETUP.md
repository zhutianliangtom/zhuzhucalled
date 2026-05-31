# MySQL 9.7.0 配置指南

## 下载地址
- **官方下载**: https://dev.mysql.com/downloads/mysql/
- **选择版本**: MySQL Community Server 9.7.0
- **系统**: Windows (x86, 64-bit), ZIP Archive

## 安装步骤

### 1. 解压文件
将 `mysql-9.7.0-winx64.zip` 解压到指定目录，例如：
```
C:\mysql97
```

### 2. 创建配置文件
在 `C:\mysql97` 目录下创建 `my.ini`：
```ini
[mysqld]
# 端口
port=3306
# MySQL安装目录
basedir=C:/mysql97
# 数据目录
datadir=C:/mysql97/data
# 字符集
character-set-server=utf8mb4
# 默认引擎
default-storage-engine=INNODB
# 最大连接数
max_connections=200
# 服务端时区
default-time-zone='+08:00'

[mysql]
# 客户端字符集
default-character-set=utf8mb4

[client]
# 客户端端口
port=3306
# 客户端字符集
default-character-set=utf8mb4
```

### 3. 初始化数据库
以管理员身份打开命令提示符（CMD），进入bin目录：
```cmd
cd C:\mysql97\bin
mysqld --initialize-insecure --console
```
这会创建data目录，并且root用户无密码。

### 4. 安装为Windows服务
```cmd
mysqld --install MySQL97
```

### 5. 启动服务
```cmd
net start MySQL97
```

### 6. 设置root密码
```cmd
mysql -u root
```
进入MySQL命令行后执行：
```sql
-- 设置密码为你想要的密码
ALTER USER 'root'@'localhost' IDENTIFIED BY '你的密码';
-- 刷新权限
FLUSH PRIVILEGES;
-- 退出
EXIT;
```

## 配置后端连接

### 更新 .env 文件
编辑 `backend/.env`：
```env
# MySQL 配置
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=你设置的密码
MYSQL_DATABASE=lost_found

# 管理员账号
ADMIN_USER=admin
ADMIN_PASS=admin123
```

### 启动后端
```cmd
cd C:\Users\zhuzhu\Desktop\zhuzhucalled\backend
node server.js
```

## 验证连接

### 测试MySQL连接
```cmd
mysql -u root -p
```
输入密码后看到：
```
Welcome to the MySQL monitor.  Commands end with ; or \g.
Your MySQL connection id is 8
Server version: 9.7.0 MySQL Community Server
```

### 查看数据库
```sql
SHOW DATABASES;
-- 应该能看到 lost_found 数据库
USE lost_found;
SHOW TABLES;
-- 应该能看到 users, items, messages, versions
```

## 常见问题

### Q: 提示 "Can't connect to MySQL server on 'localhost'"
A: 检查MySQL服务是否已启动：
```cmd
net start MySQL97
```

### Q: 提示 "Access denied for user 'root'@'localhost'"
A: 检查 .env 中的密码是否正确

### Q: 如何停止/重启MySQL服务
```cmd
net stop MySQL97
net start MySQL97
```

### Q: 如何删除MySQL服务（如不需要）
```cmd
mysqld --remove MySQL97
```

## 备份与恢复

### 手动备份
```cmd
cd C:\mysql97\bin
mysqldump -u root -p lost_found > backup.sql
```

### 恢复备份
```cmd
mysql -u root -p lost_found < backup.sql
```

## 性能优化建议（生产环境）

在 `my.ini` 中可添加：
```ini
[mysqld]
# 缓冲区设置
key_buffer_size=256M
tmp_table_size=64M
read_buffer_size=1M
read_rnd_buffer_size=4M

# 查询缓存（MySQL 8.0+已移除，忽略）
# query_cache_size=0

# 慢查询日志
slow_query_log=1
slow_query_log_file=C:/mysql97/log/slow-query.log
long_query_time=2
```

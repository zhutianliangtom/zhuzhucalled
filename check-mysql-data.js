
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// MySQL 连接配置
const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '', // 请在此处填入您的 MySQL 密码
  database: 'lost_found',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true
});

async function checkData() {
  console.log('开始检查 MySQL 数据...\n');
  
  try {
    // 1. 检查所有表
    console.log('=== 1. 检查所有表 ===');
    const [tables] = await pool.execute('SHOW TABLES');
    console.log('数据库中的表：', tables.map(t => Object.values(t)[0]));
    
    // 2. 检查用户表
    console.log('\n=== 2. 检查用户表 ===');
    const [users] = await pool.execute('SELECT * FROM users');
    console.log(`用户总数：${users.length}`);
    console.log('用户列表：');
    users.forEach(u => {
      console.log(`  - ID: ${u.id}, 学号: ${u.studentId}, 姓名: ${u.name}, 状态: ${u.status}, isAdmin: ${u.isAdmin}`);
    });
    
    // 3. 检查物品表
    console.log('\n=== 3. 检查物品表 ===');
    const [items] = await pool.execute('SELECT * FROM items');
    console.log(`物品总数：${items.length}`);
    
    // 4. 检查消息表
    console.log('\n=== 4. 检查消息表 ===');
    const [messages] = await pool.execute('SELECT * FROM messages');
    console.log(`消息总数：${messages.length}`);
    
    // 5. 导出当前数据为 JSON 备份
    console.log('\n=== 5. 导出当前数据 ===');
    const backup = {
      exportTime: new Date().toISOString(),
      users,
      items,
      messages
    };
    
    const backupFile = path.join(__dirname, 'mysql-backup-' + Date.now() + '.json');
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`数据已备份到：${backupFile}`);
    
    if (users.length === 1 && users[0].studentId === 'admin') {
      console.log('\n⚠️  警告：看起来只有管理员账号，其他用户数据可能丢失了！');
    }
    
  } catch (error) {
    console.error('检查数据时出错：', error);
  } finally {
    await pool.end();
  }
}

checkData();

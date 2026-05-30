
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'lost_found',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true
});

async function checkAndBackup() {
  console.log('========== 数据库检查 ==========');
  try {
    // 检查当前数据
    const [users] = await pool.execute('SELECT * FROM users ORDER BY createdAt DESC');
    const [items] = await pool.execute('SELECT * FROM items ORDER BY createdAt DESC');
    const [messages] = await pool.execute('SELECT * FROM messages ORDER BY createdAt DESC');
    
    console.log(`用户数量: ${users.length}`);
    console.log(`物品数量: ${items.length}`);
    console.log(`消息数量: ${messages.length}`);
    
    console.log('\n用户列表:');
    users.forEach(u => {
      console.log(`- ${u.id} | ${u.studentId} | ${u.name} | isAdmin: ${u.isAdmin}`);
    });
    
    // 备份当前数据
    const backupData = {
      backupTime: new Date().toISOString(),
      users,
      items,
      messages
    };
    
    const backupFile = path.join(__dirname, `backup_${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`\n当前数据已备份至: ${backupFile}`);
    
    // 检查是否有二进制日志
    const [binlogs] = await pool.execute('SHOW BINARY LOGS');
    console.log('\n二进制日志:');
    binlogs.forEach(log => {
      console.log(`- ${log.Log_name} (${log.File_size} bytes)`);
    });
    
  } catch (e) {
    console.error('错误:', e);
  } finally {
    await pool.end();
  }
}

checkAndBackup();

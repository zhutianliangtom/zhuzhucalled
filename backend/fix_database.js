
const mysql = require('mysql2/promise');

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

async function fixDatabase() {
  console.log('========== 修复数据库 ==========');
  try {
    // 1. 添加 isAdmin 字段
    console.log('\n1. 尝试添加 isAdmin 字段...');
    try {
      await pool.execute('ALTER TABLE users ADD COLUMN isAdmin BOOLEAN DEFAULT FALSE');
      console.log('   ✅ isAdmin 字段添加成功！');
    } catch (e) {
      console.log('   ℹ️ isAdmin 字段已存在，跳过');
    }
    
    // 2. 把管理员的 isAdmin 设为 true
    console.log('\n2. 设置管理员权限...');
    await pool.execute("UPDATE users SET isAdmin = TRUE WHERE studentId = 'admin'");
    console.log('   ✅ 管理员权限已设置！');
    
    // 3. 检查现在的用户
    console.log('\n3. 检查所有用户...');
    const [users] = await pool.execute('SELECT * FROM users ORDER BY createdAt DESC');
    console.log(`   用户数量: ${users.length}`);
    users.forEach(u => {
      console.log(`   - ${u.id} | ${u.studentId} | ${u.name} | isAdmin: ${u.isAdmin} | status: ${u.status}`);
    });
    
    console.log('\n✅ 数据库修复完成！');
    
  } catch (e) {
    console.error('❌ 错误:', e);
  } finally {
    await pool.end();
  }
}

fixDatabase();

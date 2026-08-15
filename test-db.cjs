const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  connectionTimeoutMillis: 5000,
});

async function checkConnection() {
  console.log('🔄 กำลังทดสอบเชื่อมต่อฐานข้อมูล PostgreSQL...');
  try {
    await client.connect();
    console.log('✅ เชื่อมต่อฐานข้อมูล PostgreSQL สำเร็จ!');

    const info = await client.query('SELECT current_database(), current_user, version();');
    console.log('📍 Database:', info.rows[0].current_database);
    console.log('👤 User:', info.rows[0].current_user);

    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log(`📦 พบตารางในระบบทั้งหมด (${tables.rows.length} ตาราง)`);
    console.log('ตารางตัวอย่าง:', tables.rows.slice(0, 10).map(r => r.table_name).join(', ') + ' ...');
    
    await client.end();
  } catch (err) {
    console.error('❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้:', err.message);
    process.exit(1);
  }
}

checkConnection();

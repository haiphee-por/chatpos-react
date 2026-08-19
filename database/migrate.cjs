const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const migrationsDir = path.join(__dirname, 'migrations');
const configuredDatabaseName = (() => {
  if (process.env.PGDATABASE) return process.env.PGDATABASE;
  try {
    return decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.replace(/^\//, '')) || 'chatpos';
  } catch {
    return 'chatpos';
  }
})();
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort();

const client = new Client({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  connectionTimeoutMillis: 5000,
});

async function migrate() {
  console.log(`Applying ${migrationFiles.length} migration(s) to ${configuredDatabaseName}...`);
  await client.connect();

  try {
    for (const migrationFile of migrationFiles) {
      const migrationPath = path.join(migrationsDir, migrationFile);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      console.log(`- ${migrationFile}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.end();
  }

  console.log('Database migrations completed.');
}

migrate().catch((error) => {
  console.error('Database migration failed:', error.message);
  process.exitCode = 1;
});

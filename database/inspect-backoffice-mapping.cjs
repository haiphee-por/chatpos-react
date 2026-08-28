const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
if (process.env.NODE_ENV === 'production' || process.env.LOAD_PRODUCTION_ENV === '1') {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.production'), override: true });
}

const targetStoreCode = process.env.INSPECT_STORE_CODE || 'SDEMO000001';

const client = new Client({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  connectionTimeoutMillis: 5000,
});

(async () => {
  await client.connect();
  try {
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'Store' ORDER BY ordinal_position`
    );
    console.log('=== Store columns ===');
    console.log(cols.rows.map((r) => r.column_name).join(', '));

    const storeRes = await client.query(
      `SELECT * FROM "Store" LIMIT 5`
    );
    console.log('=== LOCAL STORE candidates ===');
    console.log(JSON.stringify(storeRes.rows, null, 2));

    const mapRes = await client.query(
      'SELECT "storeId", environment, "backofficeBaseUrl", "backofficeStoreId", "keyId", status, "validFrom", "expiresAt" FROM backoffice_store_credentials WHERE environment = $1',
      [process.env.AGENT_PD_CREDENTIAL_ENVIRONMENT || 'production']
    );
    console.log('=== EXISTING MAPPINGS ===');
    console.log(JSON.stringify(mapRes.rows, null, 2));
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

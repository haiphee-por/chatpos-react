require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.production', override: true });
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query(`
    SELECT id, reference, "clientReference", "idempotencyKey", amount, status,
           "paymentMetadataJson", "createdAt", "updatedAt"
    FROM "Transaction"
    ORDER BY "createdAt" DESC
    LIMIT 8
  `);
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });

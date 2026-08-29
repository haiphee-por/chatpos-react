const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.production'), override: true });

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const users = (await client.query(
      `SELECT id, email, name, role, phone FROM "User"
       WHERE email ILIKE '%aithai%' OR email ILIKE '%online%marketing%' OR name ILIKE '%online%marketing%'`
    )).rows;
    console.log('user matches:', JSON.stringify(users, null, 2));

    const stores = (await client.query(
      `SELECT s.id, s.name, s.phone, s."userId", u.email
       FROM "Store" s JOIN "User" u ON u.id = s."userId"
       WHERE s.name ILIKE '%online%marketing%' OR u.email ILIKE '%aithai%'`
    )).rows;
    console.log('store matches:', JSON.stringify(stores, null, 2));

    const allDemoAndMerchant = (await client.query(
      `SELECT id, email, role FROM "User" WHERE email ILIKE '%chatpos%' OR email ILIKE '%merchant%' ORDER BY email`
    )).rows;
    console.log('chatpos/merchant users:', JSON.stringify(allDemoAndMerchant, null, 2));
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

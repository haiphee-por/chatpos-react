const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.production'), override: true });

const storeId = process.env.MAP_LOCAL_STORE_ID || '30000000-0000-4000-8000-000000000001';
const backofficeStoreId = process.env.MAP_BACKOFFICE_STORE_ID || '9bc8e063-2502-4e3f-81a9-541e644620a6';
const environment = process.env.MAP_ENVIRONMENT || 'production';

const client = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await client.connect();
  try {
    const result = await client.query(
      `UPDATE backoffice_store_credentials
       SET "backofficeStoreId" = $1,
           "updatedAt" = NOW()
       WHERE "storeId" = $2 AND environment = $3
       RETURNING "storeId", "backofficeStoreId", "keyId", status, "validFrom", "expiresAt"`,
      [backofficeStoreId, storeId, environment]
    );
    console.log(JSON.stringify(result.rows, null, 2));
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

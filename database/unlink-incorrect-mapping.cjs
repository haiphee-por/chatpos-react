const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.production'), override: true });

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      `UPDATE backoffice_store_credentials
       SET "backofficeStoreId" = NULL,
           "updatedAt" = NOW()
       WHERE "storeId" = $1 AND environment = 'production'
         AND "backofficeStoreId" = '9bc8e063-2502-4e3f-81a9-541e644620a6'
       RETURNING "storeId", "backofficeStoreId", "keyId", status`,
      ['30000000-0000-4000-8000-000000000001']
    );
    console.log('unlinked rows:', JSON.stringify(result.rows, null, 2));
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

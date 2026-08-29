const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.production'), override: true });

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const events = (await client.query(
      `SELECT "eventId", "eventType", status, "receivedAt", "errorCode",
              "payloadJson"->>'storeId' AS "envelopeStoreId",
              "payloadJson"->'data'->'store'->>'name' AS "storeName",
              "payloadJson"->'data'->'store'->>'ownerName' AS "ownerName"
       FROM integration_webhook_events
       WHERE "eventType" = 'store.data.synced'
       ORDER BY "receivedAt" DESC LIMIT 5`
    )).rows;
    console.log('store.data.synced events:', JSON.stringify(events, null, 2));

    const mapping = (await client.query(
      `SELECT "storeId", "backofficeStoreId", environment, status FROM backoffice_store_credentials`
    )).rows;
    console.log('all mappings:', JSON.stringify(mapping, null, 2));
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.production'), override: true });

const client = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await client.connect();
  try {
    const cred = await client.query(
      `SELECT "storeId", "backofficeStoreId", "keyId", status, "callbackSecretRef",
              ("callbackSecretEncrypted" IS NOT NULL) AS "hasEncryptedSecret",
              "callbackSecretPreviousRef",
              "bearerSecretRef", "signingSecretRef"
       FROM backoffice_store_credentials
       WHERE "storeId" = $1 AND environment = $2`,
      ['30000000-0000-4000-8000-000000000001', 'production']
    );
    console.log('=== credential row ===');
    console.log(JSON.stringify(cred.rows, null, 2));

    const events = await client.query(
      `SELECT "eventId", "eventType", status, "receivedAt", "processedAt", "errorCode"
       FROM integration_webhook_events
       WHERE "eventId" = $1
       ORDER BY "receivedAt" DESC
       LIMIT 5`,
      ['bfe352d9-471f-4a98-bf5b-92f5f29ea780']
    );
    console.log('=== received event ===');
    console.log(JSON.stringify(events.rows, null, 2));

    console.log('=== env keys present ===');
    console.log(JSON.stringify({
      CHATPOS_BACKOFFICE_CALLBACK_SECRET: !!process.env.CHATPOS_BACKOFFICE_CALLBACK_SECRET,
      CHATPOS_BACKOFFICE_BEARER_SECRET: !!process.env.CHATPOS_BACKOFFICE_BEARER_SECRET,
      CHATPOS_BACKOFFICE_SIGNING_SECRET: !!process.env.CHATPOS_BACKOFFICE_SIGNING_SECRET,
      CHATPOS_CALLBACK_SECRET_ENCRYPTION_KEY: !!process.env.CHATPOS_CALLBACK_SECRET_ENCRYPTION_KEY,
    }, null, 2));
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

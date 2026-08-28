const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.production'), override: true });

const {
  decryptCallbackSecret,
} = require('../src/lib/server/integration/storeBackofficeCredentials.cjs');

const client = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await client.connect();
  try {
    const row = (await client.query(
      `SELECT "callbackSecretEncrypted" FROM backoffice_store_credentials
       WHERE "storeId" = $1 AND environment = $2`,
      ['30000000-0000-4000-8000-000000000001', 'production']
    )).rows[0];
    if (!row || !row.callbackSecretEncrypted) {
      console.log('No encrypted secret stored');
      return;
    }
    const encryptionKey = process.env.CHATPOS_CALLBACK_SECRET_ENCRYPTION_KEY || process.env.SESSION_SECRET;
    const secret = decryptCallbackSecret(row.callbackSecretEncrypted, encryptionKey);
    console.log('Decrypt succeeded:', typeof secret === 'string' && secret.length > 0);
    console.log('Secret length:', secret ? secret.length : 0);
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

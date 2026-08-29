const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.production'), override: true });

const {
  decryptCallbackSecret,
} = require('../src/lib/server/integration/storeBackofficeCredentials.cjs');

const targetUrl = process.env.SMOKE_TARGET_URL || 'https://merchant.chatpos.biz/api/webhooks/chatpos';
const backofficeStoreId = process.env.SMOKE_BACKOFFICE_STORE_ID || '9bc8e063-2502-4e3f-81a9-541e644620a6';
const localStoreId = process.env.SMOKE_LOCAL_STORE_ID || '30000000-0000-4000-8000-000000000001';

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const row = (await client.query(
    `SELECT "callbackSecretEncrypted" FROM backoffice_store_credentials
     WHERE "storeId" = $1 AND environment = 'production'`,
    [localStoreId]
  )).rows[0];
  await client.end();
  if (!row?.callbackSecretEncrypted) throw new Error('No encrypted callback secret stored');
  const encryptionKey = process.env.CHATPOS_CALLBACK_SECRET_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  const callbackSecret = decryptCallbackSecret(row.callbackSecretEncrypted, encryptionKey);
  if (!callbackSecret) throw new Error('Failed to decrypt callback secret');

  const eventId = process.env.SMOKE_EVENT_ID || `smoke-${Date.now()}`;
  const eventType = 'store.data.synced';
  const occurredAt = new Date().toISOString();
  const body = {
    eventId,
    eventType,
    schemaVersion: 1,
    storeId: backofficeStoreId,
    occurredAt,
    data: {
      store: {
        id: backofficeStoreId,
        name: 'ONLINE MARKETING TECHNOLOGY CO., LTD.',
        ownerName: 'ONLINE MARKETING TECHNOLOGY CO., LTD.',
        contactEmail: 'aithaiecom@gmail.com',
        contactPhone: '06947927370',
        address: null,
        province: null,
        district: null,
        businessCategory: null,
        businessMode: null,
        isActive: true,
        isOnboarded: false,
        tier: 'FREE',
        profileVersion: 1,
        updatedAt: occurredAt,
      },
      kyc: null,
    },
  };
  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `v1=${crypto.createHmac('sha256', callbackSecret).update(`${timestamp}.${rawBody}`).digest('hex')}`;

  console.log('POST', targetUrl);
  console.log('event:', eventId, eventType);
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-ChatPOS-Event-Id': eventId,
      'X-ChatPOS-Event-Type': eventType,
      'X-ChatPOS-Timestamp': timestamp,
      'X-ChatPOS-Signature': signature,
    },
    body: rawBody,
  });
  console.log('status:', response.status);
  console.log('body:  ', await response.text());
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

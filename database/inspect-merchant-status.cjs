const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.production'), override: true });

const email = process.env.INSPECT_EMAIL || 'merchant@chatpos.com';

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const user = (await client.query(`SELECT id, email, name, role FROM "User" WHERE email = $1`, [email])).rows[0];
    console.log('=== user ===');
    console.log(JSON.stringify(user, null, 2));
    if (!user) return;

    const stores = (await client.query(
      `SELECT id, name, "storeType", "currentAgentId", "currentPdId", "isActive", "isOnboarded", "profileVersion", "updatedAt"
       FROM "Store" WHERE "userId" = $1`,
      [user.id]
    )).rows;
    console.log('=== stores ===');
    console.log(JSON.stringify(stores, null, 2));

    for (const store of stores) {
      console.log(`\n--- store ${store.id} (${store.name}) ---`);

      const cases = (await client.query(
        `SELECT id, case_number, status, "backofficeCaseId", "verificationId", "lastBackofficeEventOccurredAt", "lastBackofficeEventId", "updatedAt"
         FROM merchant_kyc_cases WHERE "storeId" = $1 ORDER BY "updatedAt" DESC`,
        [store.id]
      )).rows;
      console.log('kyc cases:', JSON.stringify(cases, null, 2));

      const verifications = (await client.query(
        `SELECT id, status, "approvalLevel", "updatedAt"
         FROM "KycVerification" WHERE "storeId" = $1 ORDER BY "updatedAt" DESC LIMIT 3`,
        [store.id]
      )).rows;
      console.log('kyc verifications:', JSON.stringify(verifications, null, 2));

      const assignments = (await client.query(
        `SELECT id, "assignmentRequestId", status, "agentId", "pdId", "createdAt", "updatedAt"
         FROM agent_assignments WHERE "storeId" = $1 ORDER BY "updatedAt" DESC LIMIT 5`,
        [store.id]
      )).rows;
      console.log('assignments:', JSON.stringify(assignments, null, 2));

      const events = (await client.query(
        `SELECT "eventId", "eventType", status, "receivedAt", "processedAt", "errorCode"
         FROM integration_webhook_events
         WHERE "payloadJson"->>'storeId' IN ($1, $2)
         ORDER BY "receivedAt" DESC LIMIT 10`,
        [store.id, '9bc8e063-2502-4e3f-81a9-541e644620a6']
      )).rows;
      console.log('recent webhook events:', JSON.stringify(events, null, 2));
    }
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

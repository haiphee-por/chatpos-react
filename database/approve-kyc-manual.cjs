const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.production'), override: true });

const storeId = process.env.STORE_ID || '30000000-0000-4000-8000-000000000001';

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    const kycCase = (await client.query(
      `SELECT id, "verificationId" FROM merchant_kyc_cases
       WHERE "storeId" = $1 ORDER BY "updatedAt" DESC LIMIT 1 FOR UPDATE`,
      [storeId]
    )).rows[0];
    if (!kycCase) throw new Error('No KYC case for store');

    await client.query(
      `UPDATE merchant_kyc_cases
       SET status = 'KYC_APPROVED', "updatedAt" = NOW()
       WHERE id = $1`,
      [kycCase.id]
    );
    if (kycCase.verificationId) {
      await client.query(
        `UPDATE "KycVerification"
         SET status = 'approved',
             "approvalLevel" = 'approved',
             "reviewedAt" = COALESCE("reviewedAt", NOW()),
             "updatedAt" = NOW()
         WHERE id = $1`,
        [kycCase.verificationId]
      );
    }
    await client.query(
      `UPDATE "Store" SET "isOnboarded" = true, "updatedAt" = NOW() WHERE id = $1`,
      [storeId]
    );
    await client.query(
      `INSERT INTO audit_logs
        ("actorId", "actorRole", action, "targetType", "targetId", "afterJson", "createdAt")
       VALUES ('manual-bypass', 'system', 'KYC_APPROVED_MANUAL_BYPASS', 'kyc_case', $1,
               '{"reason":"demo unblock","status":"KYC_APPROVED"}'::jsonb, NOW())`,
      [kycCase.id]
    );
    await client.query('COMMIT');

    const after = await client.query(
      `SELECT c.id, c.status AS "caseStatus", v.status AS "verificationStatus", v."approvalLevel"
       FROM merchant_kyc_cases c LEFT JOIN "KycVerification" v ON v.id = c."verificationId"
       WHERE c.id = $1`,
      [kycCase.id]
    );
    console.log('approved:', JSON.stringify(after.rows[0], null, 2));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

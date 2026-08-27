const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const CASE_NUMBER = 'KYC-DEMO-0001';
const RESET_REASON = 'Reset demo case to draft before Backoffice submission testing';
const REQUEST_ID = `manual-demo-reset-${CASE_NUMBER.toLowerCase()}`;

const client = new Client({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  connectionTimeoutMillis: 5000,
});

async function resetDemoKyc() {
  await client.connect();

  try {
    await client.query('BEGIN');

    const caseResult = await client.query(
      `SELECT id, "storeId", "verificationId", status
       FROM merchant_kyc_cases
       WHERE case_number = $1
       FOR UPDATE`,
      [CASE_NUMBER]
    );
    if (caseResult.rowCount !== 1) {
      throw new Error(`${CASE_NUMBER} must resolve to exactly one KYC case`);
    }

    const kycCase = caseResult.rows[0];
    if (!kycCase.verificationId) {
      throw new Error(`${CASE_NUMBER} has no linked KycVerification record`);
    }

    const verificationResult = await client.query(
      `SELECT id, status, "approvalLevel", "reviewedAt", "reviewNotes"
       FROM "KycVerification"
       WHERE id = $1
       FOR UPDATE`,
      [kycCase.verificationId]
    );
    if (verificationResult.rowCount !== 1) {
      throw new Error(`${CASE_NUMBER} has no matching KycVerification record`);
    }

    const verification = verificationResult.rows[0];
    await client.query(
      `UPDATE "KycVerification"
       SET status = 'pending',
           "approvalLevel" = 'pending',
           "reviewedAt" = NULL,
           "reviewNotes" = $1,
           "updatedAt" = NOW()
       WHERE id = $2`,
      [RESET_REASON, verification.id]
    );
    await client.query(
      `UPDATE merchant_kyc_cases
        SET status = 'draft', "updatedAt" = NOW()
       WHERE id = $1`,
      [kycCase.id]
    );
    await client.query(
      `INSERT INTO audit_logs
        ("actorId", "actorRole", action, "targetType", "targetId", reason, "beforeJson", "afterJson", "requestId")
       VALUES ('test-operator', 'admin', 'KYC_DEMO_CASE_RESET_FOR_TEST', 'kyc_case', $1, $2, $3::jsonb, $4::jsonb, $5)`,
      [
        kycCase.id,
        RESET_REASON,
        JSON.stringify({
          caseStatus: kycCase.status,
          verificationStatus: verification.status,
          approvalLevel: verification.approvalLevel,
        }),
        JSON.stringify({
          caseStatus: 'draft',
          verificationStatus: 'pending',
          approvalLevel: 'pending',
        }),
        REQUEST_ID,
      ]
    );

    const result = await client.query(
      `SELECT c.case_number,
              c.status AS case_status,
              k.status AS verification_status,
              k."approvalLevel",
              (SELECT COUNT(*) FROM kyc_document_versions v WHERE v."caseId" = c.id) AS document_versions,
              (SELECT COUNT(*) FROM kyc_decisions d WHERE d."caseId" = c.id) AS decision_count
       FROM merchant_kyc_cases c
       JOIN "KycVerification" k ON k.id = c."verificationId"
       WHERE c.id = $1`,
      [kycCase.id]
    );

    await client.query('COMMIT');
    console.log(JSON.stringify({ before: { caseStatus: kycCase.status, verificationStatus: verification.status, approvalLevel: verification.approvalLevel }, after: result.rows[0] }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

resetDemoKyc().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
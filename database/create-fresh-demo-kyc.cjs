const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const STORE_ID = '30000000-0000-4000-8000-000000000001';
const SOURCE_CASE_NUMBER = 'KYC-DEMO-0001';
const FRESH_CASE_NUMBER = 'KYC-DEMO-0001-RETEST-01';
const REQUEST_ID = `create-${FRESH_CASE_NUMBER.toLowerCase()}`;
const REASON = 'Created a fresh demo case for end-to-end document upload and Backoffice review testing';

const client = new Client({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  connectionTimeoutMillis: 5000,
});

async function createFreshDemoKyc() {
  await client.connect();
  try {
    await client.query('BEGIN');

    const existingResult = await client.query(
      `SELECT c.id, c."verificationId", c.case_number, c.status
       FROM merchant_kyc_cases c
       WHERE c.case_number = $1 AND c."storeId" = $2
       FOR UPDATE`,
      [FRESH_CASE_NUMBER, STORE_ID]
    );
    if (existingResult.rowCount > 0) {
      await client.query('COMMIT');
      console.log(JSON.stringify({ reused: true, case: existingResult.rows[0] }, null, 2));
      return;
    }

    const sourceResult = await client.query(
      `SELECT c.id AS source_case_id, c."verificationId", c."assignedAgentId", c."assignedPdId",
              k."userId", k."businessName", k."firstName", k."lastName", k.phone,
              k."taxId", k."bankName", k."bankAccountNumber", k."bankAccountName",
              k."currentAddress", k."businessAddress", k."businessType", k."applicantType", k."kycSize"
       FROM merchant_kyc_cases c
       JOIN "KycVerification" k ON k.id = c."verificationId"
       WHERE c.case_number = $1 AND c."storeId" = $2
       FOR UPDATE OF c, k`,
      [SOURCE_CASE_NUMBER, STORE_ID]
    );
    if (sourceResult.rowCount !== 1) {
      throw new Error(`${SOURCE_CASE_NUMBER} was not found for the target Store`);
    }

    const source = sourceResult.rows[0];
    const verificationResult = await client.query(
      `INSERT INTO "KycVerification"
        ("userId", "storeId", "businessName", "firstName", "lastName", phone,
         "taxId", "bankName", "bankAccountNumber", "bankAccountName", "currentAddress",
         "businessAddress", "businessType", status, "currentStep", "applicantType",
         "approvalLevel", "kycSize", "agreementAccepted", "reviewNotes", "submittedAt",
         "reviewedAt", "submissionSnapshotJson", "submissionProfileVersion", "createdAt", "updatedAt")
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', 1, $14,
         'pending', $15, false, NULL, NULL, NULL, NULL, 0, NOW(), NOW())
       RETURNING id`,
      [
        source.userId,
        STORE_ID,
        source.businessName,
        source.firstName,
        source.lastName,
        source.phone,
        source.taxId,
        source.bankName,
        source.bankAccountNumber,
        source.bankAccountName,
        source.currentAddress,
        source.businessAddress,
        source.businessType,
        source.applicantType,
        source.kycSize,
      ]
    );
    const verificationId = verificationResult.rows[0].id;
    const caseResult = await client.query(
      `INSERT INTO merchant_kyc_cases
        ("storeId", "verificationId", case_number, status, "assignedAgentId", "assignedPdId", "submissionVersion", "submissionProfileVersion")
       VALUES ($1, $2, $3, 'draft', NULL, NULL, 1, 0)
       RETURNING id, "storeId", "verificationId", case_number, status, "submissionVersion"`,
      [STORE_ID, verificationId, FRESH_CASE_NUMBER]
    );
    const freshCase = caseResult.rows[0];

    await client.query(
      `INSERT INTO audit_logs
        ("actorId", "actorRole", action, "targetType", "targetId", reason, "beforeJson", "afterJson", "requestId")
       VALUES ('test-operator', 'admin', 'KYC_DEMO_FRESH_CASE_CREATED', 'kyc_case', $1, $2, $3::jsonb, $4::jsonb, $5)`,
      [
        freshCase.id,
        REASON,
        JSON.stringify({ sourceCaseNumber: SOURCE_CASE_NUMBER, sourceCaseId: source.source_case_id }),
        JSON.stringify({ caseNumber: FRESH_CASE_NUMBER, caseStatus: 'draft', verificationStatus: 'pending' }),
        REQUEST_ID,
      ]
    );

    await client.query('COMMIT');
    console.log(JSON.stringify({ reused: false, case: freshCase, sourceCase: { id: source.source_case_id, caseNumber: SOURCE_CASE_NUMBER } }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

createFreshDemoKyc().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
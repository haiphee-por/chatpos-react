const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.production'), override: true });

const storeId = '30000000-0000-4000-8000-000000000001';
const caseNumber = 'KYC-DEMO-0001-RETEST-01';

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');

    const activeCase = (await client.query(
      `SELECT id, "verificationId", status FROM merchant_kyc_cases
       WHERE "storeId" = $1 AND case_number = $2 FOR UPDATE`,
      [storeId, caseNumber]
    )).rows[0];
    if (!activeCase) {
      console.log('No active case found');
      await client.query('ROLLBACK');
      return;
    }

    const caseResult = await client.query(
      `UPDATE merchant_kyc_cases
       SET status = 'draft',
           "submissionSnapshotJson" = NULL,
           "submissionProfileVersion" = NULL,
           "lastBackofficeEventOccurredAt" = NULL,
           "lastBackofficeEventId" = NULL,
           "updatedAt" = NOW()
       WHERE id = $1
       RETURNING id, case_number, status`,
      [activeCase.id]
    );

    const verificationResult = activeCase.verificationId
      ? await client.query(
          `UPDATE "KycVerification"
           SET status = 'pending',
               "approvalLevel" = 'pending',
               "submittedAt" = NULL,
               "reviewedAt" = NULL,
               "submissionSnapshotJson" = NULL,
               "submissionProfileVersion" = NULL,
               "updatedAt" = NOW()
           WHERE id = $1
           RETURNING id, status, "approvalLevel"`,
          [activeCase.verificationId]
        )
      : { rows: [] };

    const documentsResult = await client.query(
      `SELECT id FROM kyc_documents WHERE "caseId" = $1`,
      [activeCase.id]
    );
    const scanUpdate = await client.query(
      `UPDATE kyc_documents
       SET status = 'uploaded',
           "scanStatus" = 'CLEAN',
           "scannedAt" = NOW(),
           "updatedAt" = NOW()
       WHERE "caseId" = $1 AND "scanStatus" <> 'CLEAN'
       RETURNING id`,
      [activeCase.id]
    );
    const versionUpdate = await client.query(
      `UPDATE kyc_document_versions
       SET status = 'uploaded',
           "scanStatus" = 'CLEAN',
           "scannedAt" = NOW()
       WHERE "caseId" = $1 AND "scanStatus" <> 'CLEAN'
       RETURNING id`,
      [activeCase.id]
    );

    const assignmentResult = await client.query(
      `UPDATE agent_assignments
       SET status = 'CANCELLED',
           "updatedAt" = NOW()
       WHERE "storeId" = $1 AND status = 'PENDING_ADMIN_ASSIGNMENT'
       RETURNING id, "assignmentRequestId", status`,
      [storeId]
    );

    await client.query('COMMIT');

    console.log('kyc_cases:', JSON.stringify(caseResult.rows, null, 2));
    console.log('KycVerification:', JSON.stringify(verificationResult.rows, null, 2));
    console.log('kyc_documents unquarantined:', scanUpdate.rowCount, 'of', documentsResult.rowCount);
    console.log('kyc_document_versions unquarantined:', versionUpdate.rowCount);
    console.log('assignments cancelled:', JSON.stringify(assignmentResult.rows, null, 2));
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

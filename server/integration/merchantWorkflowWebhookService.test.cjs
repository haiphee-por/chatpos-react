const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { processMerchantWorkflowCallback } = require('./merchantWorkflowWebhookService.cjs');

const secret = 'callback-secret';
const nowSeconds = 1700000000;
const localStoreId = '550e8400-e29b-41d4-a716-446655440000';

function signedHeaders(rawBody, eventId) {
  const timestamp = String(nowSeconds);
  return {
    'x-chatpos-event-id': eventId,
    'x-chatpos-event-type': 'kyc.case.status.changed',
    'x-chatpos-timestamp': timestamp,
    'x-chatpos-signature': `v1=${crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex')}`,
  };
}

test('syncs a Backoffice KYC decision to the local case through assignment mapping', async () => {
  const queries = [];
  const client = {
    async query(sql, parameters = []) {
      queries.push({ sql, parameters });
      if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql.trim())) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT "bodyDigest", status FROM integration_webhook_events')) return { rows: [], rowCount: 0 };
      if (sql.includes('"backofficeCaseId" = $2 OR id::text = $2')) return { rows: [], rowCount: 0 };
      if (sql.includes('INNER JOIN agent_assignments')) {
        return {
          rows: [{
            id: 'local-case-1',
            verificationId: 'local-verification-1',
            status: 'SUBMITTED_TO_PD',
            backofficeCaseId: null,
            lastBackofficeEventOccurredAt: null,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes('UPDATE merchant_kyc_cases')) return { rows: [{ id: 'local-case-1', status: 'KYC_APPROVED' }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  const body = {
    eventId: 'kyc-event-1',
    eventType: 'kyc.case.status.changed',
    schemaVersion: 1,
    storeId: 'backoffice-store-1',
    caseId: 'backoffice-case-1',
    assignmentRequestId: 'backoffice-assignment-1',
    status: 'KYC_APPROVED',
    occurredAt: '2023-11-14T22:13:20.000Z',
  };
  const rawBody = JSON.stringify(body);

  const result = await processMerchantWorkflowCallback({
    pool: { connect: async () => client },
    rawBody,
    headers: signedHeaders(rawBody, body.eventId),
    callbackSecretResolver: async () => ({ storeId: localStoreId, secrets: secret }),
    nowSeconds,
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.data.caseId, 'local-case-1');
  assert.equal(result.data.status, 'KYC_APPROVED');
  assert.ok(queries.some(({ sql, parameters }) => sql.includes('UPDATE "KycVerification"') && parameters[0] === 'approved' && parameters[1] === 'approved'));
});
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { processMerchantWorkflowCallback } = require('./merchantWorkflowWebhookService.cjs');

const secret = 'callback-secret';
const nowSeconds = 1700000000;
const localStoreId = '550e8400-e29b-41d4-a716-446655440000';

function signedHeaders(rawBody, eventId, eventType = 'kyc.case.status.changed') {
  const timestamp = String(nowSeconds);
  return {
    'x-chatpos-event-id': eventId,
    'x-chatpos-event-type': eventType,
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

test('accepts store.data.synced and updates Store profile snapshot', async () => {
  const queries = [];
  const client = {
    async query(sql, parameters = []) {
      queries.push({ sql, parameters });
      if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql.trim())) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT "bodyDigest", status FROM integration_webhook_events')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT "profileVersion", "updatedAt", "profileJson" FROM "Store"')) {
        return { rows: [{ profileVersion: 0, updatedAt: new Date('2026-01-01T00:00:00Z'), profileJson: {} }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  const body = {
    eventId: 'sync-event-1',
    eventType: 'store.data.synced',
    schemaVersion: 1,
    storeId: 'backoffice-store-1',
    occurredAt: '2026-08-28T00:00:00.000Z',
    data: {
      store: {
        id: 'backoffice-store-1',
        name: 'ONLINE MARKETING TECHNOLOGY CO., LTD.',
        ownerName: 'ONLINE MARKETING TECHNOLOGY CO., LTD.',
        contactEmail: 'aithaiecom@gmail.com',
        contactPhone: '06947927370',
        address: null,
        province: 'Bangkok',
        businessCategory: 'ecom',
        isActive: true,
        isOnboarded: false,
        tier: 'FREE',
        profileVersion: 3,
        updatedAt: '2026-08-28T00:00:00.000Z',
      },
      kyc: null,
    },
  };
  const rawBody = JSON.stringify(body);

  const result = await processMerchantWorkflowCallback({
    pool: { connect: async () => client },
    rawBody,
    headers: signedHeaders(rawBody, body.eventId, 'store.data.synced'),
    callbackSecretResolver: async () => ({ storeId: localStoreId, secrets: secret }),
    nowSeconds,
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.data.updated, true);
  assert.equal(result.data.profileVersion, 3);
  const updateQuery = queries.find(({ sql }) => sql.includes('UPDATE "Store"') && sql.includes('"profileVersion" = $7'));
  assert.ok(updateQuery, 'Store profile update query should be executed');
  const profileJson = JSON.parse(updateQuery.parameters[7]);
  assert.equal(profileJson.ownerName, 'ONLINE MARKETING TECHNOLOGY CO., LTD.');
  assert.equal(profileJson.contactEmail, 'aithaiecom@gmail.com');
  assert.equal(profileJson.province, 'Bangkok');
});

test('ignores store.data.synced when incoming profileVersion is older', async () => {
  const queries = [];
  const client = {
    async query(sql, parameters = []) {
      queries.push({ sql, parameters });
      if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql.trim())) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT "bodyDigest", status FROM integration_webhook_events')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT "profileVersion", "updatedAt", "profileJson" FROM "Store"')) {
        return { rows: [{ profileVersion: 5, updatedAt: new Date('2026-08-28T00:00:00Z'), profileJson: {} }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  const body = {
    eventId: 'sync-event-2',
    eventType: 'store.data.synced',
    schemaVersion: 1,
    storeId: 'backoffice-store-1',
    occurredAt: '2026-08-28T00:00:00.000Z',
    data: { store: { profileVersion: 2, updatedAt: '2026-08-27T00:00:00.000Z' } },
  };
  const rawBody = JSON.stringify(body);

  const result = await processMerchantWorkflowCallback({
    pool: { connect: async () => client },
    rawBody,
    headers: signedHeaders(rawBody, body.eventId, 'store.data.synced'),
    callbackSecretResolver: async () => ({ storeId: localStoreId, secrets: secret }),
    nowSeconds,
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.late, true);
  assert.equal(queries.some(({ sql }) => sql.includes('UPDATE "Store"') && sql.includes('"profileVersion" = $7')), false);
});
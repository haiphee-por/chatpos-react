const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const {
  processAssignmentCallback,
  verifyAssignmentCallback,
  verifyMerchantWorkflowCallback,
} = require('./assignmentService.cjs');
const {
  processPaymentWebhook,
  verifyPaymentStatusWebhook,
} = require('./transactionService.cjs');

const secret = 'callback-secret';
const nowSeconds = 1700000000;

function signedHeaders({ rawBody, eventId, eventType, timestamp = String(nowSeconds) }) {
  return {
    'x-chatpos-event-id': eventId,
    'x-chatpos-event-type': eventType,
    'x-chatpos-timestamp': timestamp,
    'x-chatpos-signature': `v1=${crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex')}`,
  };
}

test('assignment callback verification requires its event type header', () => {
  const rawBody = '{}';
  const headers = signedHeaders({
    rawBody,
    eventId: 'assignment-event-1',
    eventType: 'assignment.status.changed',
  });
  delete headers['x-chatpos-event-type'];

  assert.throws(
    () => verifyAssignmentCallback({ rawBody, headers, callbackSecret: secret, nowSeconds }),
    (error) => error.code === 'EVENT_TYPE_REQUIRED'
  );
});

test('payment status verification returns and restricts its event type', () => {
  const rawBody = '{}';
  const validHeaders = signedHeaders({
    rawBody,
    eventId: 'payment-event-1',
    eventType: 'payment.status.changed',
  });
  const verified = verifyPaymentStatusWebhook({ rawBody, headers: validHeaders, secret, nowSeconds });
  assert.equal(verified.eventType, 'payment.status.changed');

  const unsupportedHeaders = signedHeaders({
    rawBody,
    eventId: 'payment-event-2',
    eventType: 'assignment.status.changed',
  });
  assert.throws(
    () => verifyPaymentStatusWebhook({ rawBody, headers: unsupportedHeaders, secret, nowSeconds }),
    (error) => error.code === 'UNSUPPORTED_EVENT_TYPE'
  );
});

test('assignment callback rejects a body event type that differs from its header', async () => {
  const rawBody = JSON.stringify({
    eventId: 'assignment-event-2',
    eventType: 'assignment.status.changed.v2',
    storeId: '550e8400-e29b-41d4-a716-446655440000',
    assignmentRequestId: 'assignment-request-1',
    status: 'ACCEPTED',
  });
  const headers = signedHeaders({
    rawBody,
    eventId: 'assignment-event-2',
    eventType: 'assignment.status.changed',
  });

  await assert.rejects(
    () => processAssignmentCallback({ pool: null, rawBody, headers, callbackSecret: secret, nowSeconds }),
    (error) => error.code === 'EVENT_TYPE_MISMATCH'
  );
});

test('payment status processing rejects a body event type that differs from its header', async () => {
  const rawBody = JSON.stringify({
    eventId: 'payment-event-3',
    eventType: 'assignment.status.changed',
    transactionReference: 'transaction-1',
    status: 'paid',
  });

  await assert.rejects(
    () => processPaymentWebhook({
      pool: null,
      rawBody,
      body: JSON.parse(rawBody),
      verified: {
        eventId: 'payment-event-3',
        eventType: 'payment.status.changed',
        bodyDigest: 'digest',
      },
    }),
    (error) => error.code === 'EVENT_TYPE_MISMATCH'
  );
});

test('merchant workflow verification accepts KYC callback events with the assignment secret', () => {
  const rawBody = JSON.stringify({});
  const headers = signedHeaders({
    rawBody,
    eventId: 'kyc-event-1',
    eventType: 'kyc.case.status.changed',
  });
  const verified = verifyMerchantWorkflowCallback({ rawBody, headers, callbackSecret: secret, nowSeconds });

  assert.equal(verified.eventType, 'kyc.case.status.changed');
});

test('assignment callback resolves local Agent and PD by code when remote IDs differ', async () => {
  const localStoreId = '550e8400-e29b-41d4-a716-446655440000';
  const localAgentId = '660e8400-e29b-41d4-a716-446655440000';
  const localPdId = '770e8400-e29b-41d4-a716-446655440000';
  const remoteAgentId = '880e8400-e29b-41d4-a716-446655440000';
  const remotePdId = '990e8400-e29b-41d4-a716-446655440000';
  const remoteStoreId = 'backoffice-store-1';
  const assignment = {
    id: 'assignment-local-1',
    storeId: localStoreId,
    sourceRequestId: 'merchant-assignment-001',
    assignmentRequestId: 'backoffice-assignment-001',
    status: 'PENDING_AGENT_ACCEPTANCE',
    reason: null,
    createdAt: '2026-08-27T00:00:00.000Z',
    updatedAt: '2026-08-27T00:00:00.000Z',
    expiresAt: null,
    agentId: null,
    pdId: null,
    lastEventOccurredAt: null,
  };
  const queries = [];
  const client = {
    async query(sql, parameters = []) {
      queries.push({ sql, parameters });
      if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql.trim())) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT "bodyDigest", status FROM integration_webhook_events')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT * FROM agent_assignments')) return { rows: [assignment], rowCount: 1 };
      if (sql.includes('FROM "Agent" WHERE id = $1')) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM "Agent" WHERE code = $1')) return { rows: [{ id: localAgentId, currentPdId: localPdId }], rowCount: 1 };
      if (sql.includes('FROM "ProvincialDirector" WHERE id = $1')) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM "ProvincialDirector" WHERE code = $1')) return { rows: [{ id: localPdId }], rowCount: 1 };
      if (sql.includes('UPDATE agent_assignments')) return { rows: [{ ...assignment, status: 'ACCEPTED', agentId: localAgentId, pdId: localPdId }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  const rawBody = JSON.stringify({
    eventId: 'assignment-event-code-resolution',
    eventType: 'assignment.status.changed',
    storeId: remoteStoreId,
    assignmentRequestId: assignment.assignmentRequestId,
    status: 'ACCEPTED',
    agentId: remoteAgentId,
    agentCode: 'AG-LOCAL-001',
    pdId: remotePdId,
    pdCode: 'PD-LOCAL-001',
    occurredAt: '2026-08-27T01:00:00.000Z',
  });
  const headers = signedHeaders({
    rawBody,
    eventId: 'assignment-event-code-resolution',
    eventType: 'assignment.status.changed',
  });

  const result = await processAssignmentCallback({
    pool: { connect: async () => client },
    rawBody,
    headers,
    callbackSecretResolver: async () => ({ storeId: localStoreId, secrets: secret }),
    nowSeconds,
  });

  assert.equal(result.data.status, 'ACCEPTED');
  assert.equal(result.data.agent.id, localAgentId);
  assert.equal(result.data.pd.id, localPdId);
  assert.ok(queries.some(({ sql, parameters }) => sql.includes('FROM "Agent" WHERE code = $1') && parameters[0] === 'AG-LOCAL-001'));
  assert.ok(queries.some(({ sql, parameters }) => sql.includes('FROM "ProvincialDirector" WHERE code = $1') && parameters[0] === 'PD-LOCAL-001'));
});
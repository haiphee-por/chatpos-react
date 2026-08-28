const assert = require('node:assert/strict');
const test = require('node:test');
const { createAssignmentRequest } = require('./assignmentService.cjs');

const storeId = '30000000-0000-4000-8000-000000000001';
const webhookUrl = 'https://merchant.example.test/api/webhooks/chatpos';

function createPool() {
  const state = { assignment: null, auditActions: [] };
  const client = {
    async query(sql, parameters = []) {
      if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql.trim())) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT id FROM "Store"')) return { rows: [{ id: storeId }], rowCount: 1 };
      if (sql.includes('SELECT * FROM agent_assignments')) {
        return { rows: state.assignment ? [state.assignment] : [], rowCount: state.assignment ? 1 : 0 };
      }
      if (sql.includes('INSERT INTO agent_assignments')) {
        state.assignment = {
          id: '50000000-0000-4000-8000-000000000001',
          storeId,
          sourceRequestId: parameters[1],
          assignmentRequestId: null,
          status: parameters[3],
          agentPhone: parameters[4],
          reason: null,
          createdAt: '2026-08-27T00:00:00.000Z',
          updatedAt: '2026-08-27T00:00:00.000Z',
          acceptedAt: null,
          rejectedAt: null,
          expiresAt: null,
          agentId: null,
          pdId: null,
        };
        return { rows: [state.assignment], rowCount: 1 };
      }
      if (sql.includes('UPDATE agent_assignments')) {
        state.assignment = sql.includes('"assignmentRequestId" = $1')
          ? { ...state.assignment, assignmentRequestId: parameters[0], status: parameters[1] }
          : sql.includes("status = 'PENDING_BACKOFFICE_DISPATCH'")
          ? { ...state.assignment, status: 'PENDING_BACKOFFICE_DISPATCH', reason: parameters[0] }
          : { ...state.assignment, status: parameters[0], reason: parameters[1] };
        return { rows: [state.assignment], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO audit_logs')) {
        state.auditActions.push(parameters[2]);
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  return { state, pool: { connect: async () => client } };
}

test('keeps a local assignment pending when Store Backoffice mapping is missing', async () => {
  const { pool, state } = createPool();
  const backofficeClient = {
    request: async () => {
      const error = new Error('Store credential mapping is missing');
      error.code = 'STORE_CREDENTIAL_MAPPING_MISSING';
      throw error;
    },
  };

  const result = await createAssignmentRequest({
    pool,
    backofficeClient,
    storeId,
    sourceRequestId: 'merchant-kyc-submit-case-001',
    requestId: 'request-001',
    webhookUrl,
  });

  assert.equal(result.statusCode, 202);
  assert.equal(result.data.status, 'PENDING_BACKOFFICE_DISPATCH');
  assert.equal(state.assignment.status, 'PENDING_BACKOFFICE_DISPATCH');
  assert.equal(state.assignment.reason, 'STORE_CREDENTIAL_MAPPING_MISSING');
  assert.deepEqual(state.auditActions, [
    'ASSIGNMENT_REQUEST_CREATED',
    'ASSIGNMENT_REQUEST_PENDING_BACKOFFICE_DISPATCH',
  ]);
});

test('retries a pending local assignment after Backoffice configuration is restored', async () => {
  const { pool, state } = createPool();
  const firstClient = {
    request: async () => {
      const error = new Error('Store credential mapping is missing');
      error.code = 'STORE_CREDENTIAL_MAPPING_MISSING';
      throw error;
    },
  };
  await createAssignmentRequest({ pool, backofficeClient: firstClient, storeId, sourceRequestId: 'merchant-kyc-submit-case-002', requestId: 'request-002', webhookUrl });

  const secondClient = {
    request: async () => ({ ok: true, status: 201, data: { id: 'BO-ASSIGN-002', status: 'PENDING_ADMIN_ASSIGNMENT', webhookSecret: 'callback-secret-002' } }),
  };
  const result = await createAssignmentRequest({
    pool,
    backofficeClient: secondClient,
    storeId,
    sourceRequestId: 'merchant-kyc-submit-case-002',
    requestId: 'request-003',
    webhookUrl,
    callbackSecretWriter: async () => {},
  });

  assert.equal(result.statusCode, 201);
  assert.equal(result.data.assignmentRequestId, 'BO-ASSIGN-002');
  assert.equal(result.data.status, 'PENDING_ADMIN_ASSIGNMENT');
});

test('sends webhook URL and persists the one-time webhook secret from the first response', async () => {
  const { pool } = createPool();
  let requestOptions;
  let savedSecret;
  const result = await createAssignmentRequest({
    pool,
    backofficeClient: {
      request: async (_path, options) => {
        requestOptions = options;
        return { ok: true, status: 201, data: { id: 'BO-ASSIGN-003', status: 'PENDING_ADMIN_ASSIGNMENT', webhookSecret: 'callback-test-secret' } };
      },
    },
    storeId,
    sourceRequestId: 'merchant-assignment-case-003',
    requestId: 'request-003',
    webhookUrl,
    callbackSecretWriter: async (_storeId, secret) => {
      savedSecret = secret;
    },
  });

  assert.equal(requestOptions.body.webhookUrl, webhookUrl);
  assert.equal(savedSecret, 'callback-test-secret');
  assert.equal(result.data.assignmentRequestId, 'BO-ASSIGN-003');
});

test('keeps assignment retryable when the first Backoffice response omits webhook secret', async () => {
  const { pool, state } = createPool();
  let calls = 0;
  const backofficeClient = {
    request: async () => {
      calls += 1;
      return calls === 1
        ? { ok: true, status: 201, data: { id: 'BO-ASSIGN-004', status: 'PENDING_ADMIN_ASSIGNMENT' } }
        : { ok: true, status: 200, data: { id: 'BO-ASSIGN-004', status: 'PENDING_ADMIN_ASSIGNMENT', webhookSecret: 'callback-secret-004' } };
    },
  };

  const pending = await createAssignmentRequest({ pool, backofficeClient, storeId, sourceRequestId: 'merchant-assignment-case-004', requestId: 'request-004', webhookUrl, callbackSecretWriter: async () => {} });
  const recovered = await createAssignmentRequest({ pool, backofficeClient, storeId, sourceRequestId: 'merchant-assignment-case-004', requestId: 'request-005', webhookUrl, callbackSecretWriter: async () => {} });

  assert.equal(pending.statusCode, 202);
  assert.equal(pending.data.status, 'PENDING_BACKOFFICE_DISPATCH');
  assert.equal(pending.data.reason, 'CALLBACK_SECRET_MISSING');
  assert.equal(recovered.statusCode, 200);
  assert.equal(recovered.data.assignmentRequestId, 'BO-ASSIGN-004');
  assert.equal(state.assignment.status, 'PENDING_ADMIN_ASSIGNMENT');
  assert.equal(calls, 2);
});

test('accepts a new request when the existing callback secret is already stored', async () => {
  const { pool, state } = createPool();
  let resolvedStoreId;
  const result = await createAssignmentRequest({
    pool,
    backofficeClient: {
      request: async () => ({ ok: true, status: 201, data: { id: 'BO-ASSIGN-005', status: 'PENDING_AGENT_ACCEPTANCE' } }),
    },
    storeId,
    sourceRequestId: 'merchant-assignment-case-005',
    requestId: 'request-006',
    webhookUrl,
    callbackSecretWriter: async () => {
      throw new Error('must not overwrite the existing callback secret');
    },
    callbackSecretResolver: async (resolvedId) => {
      resolvedStoreId = resolvedId;
      return ['existing-callback-secret'];
    },
  });

  assert.equal(result.statusCode, 201);
  assert.equal(result.data.status, 'PENDING_AGENT_ACCEPTANCE');
  assert.equal(state.assignment.status, 'PENDING_AGENT_ACCEPTANCE');
  assert.equal(resolvedStoreId, storeId);
});

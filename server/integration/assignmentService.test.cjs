const assert = require('node:assert/strict');
const test = require('node:test');
const { createAssignmentRequest } = require('./assignmentService.cjs');

const storeId = '30000000-0000-4000-8000-000000000001';

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
  await createAssignmentRequest({ pool, backofficeClient: firstClient, storeId, sourceRequestId: 'merchant-kyc-submit-case-002', requestId: 'request-002' });

  const secondClient = {
    request: async () => ({ ok: true, status: 201, data: { id: 'BO-ASSIGN-002', status: 'PENDING_ADMIN_ASSIGNMENT' } }),
  };
  const result = await createAssignmentRequest({ pool, backofficeClient: secondClient, storeId, sourceRequestId: 'merchant-kyc-submit-case-002', requestId: 'request-003' });

  assert.equal(result.statusCode, 201);
  assert.equal(result.data.assignmentRequestId, 'BO-ASSIGN-002');
  assert.equal(result.data.status, 'PENDING_ADMIN_ASSIGNMENT');
});

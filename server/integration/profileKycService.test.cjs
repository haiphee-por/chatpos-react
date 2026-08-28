const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildDocumentCommandBody,
  dispatchPendingKycDocuments,
  intakeKycDocument,
  validateDocumentBody,
  validateProfileBody,
} = require('./profileKycService.cjs');

const storeId = '30000000-0000-4000-8000-000000000001';
const caseId = '40000000-0000-4000-8000-000000000001';

function createDocumentPool({ backofficeCaseId = 'backoffice-case-001' } = {}) {
  const state = {
    latestVersion: 0,
    versions: [],
    sql: [],
  };
  const caseRow = {
    id: caseId,
    storeId,
    verificationId: null,
    backofficeCaseId,
    case_number: 'KYC-202608-TEST01',
    status: 'draft',
    submissionVersion: 0,
    submissionSnapshotJson: null,
    submissionProfileVersion: 0,
  };
  const client = {
    async query(sql, parameters = []) {
      state.sql.push(sql);
      if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql.trim())) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM merchant_kyc_cases')) return { rows: [caseRow], rowCount: 1 };
      if (sql.includes('SELECT id, "documentId"') && sql.includes('"sourceRequestId"')) {
        const row = state.versions.find((version) => version.sourceRequestId === parameters[1] || version.idempotencyKey === parameters[2]);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      if (sql.includes('INSERT INTO kyc_documents')) {
        return { rows: [{ id: '50000000-0000-4000-8000-000000000001', latestVersion: state.latestVersion }], rowCount: 1 };
      }
      if (sql.includes('FROM kyc_document_versions') && sql.includes('"documentId" = $1')) {
        const row = state.versions.find((version) => version.documentId === parameters[0] && version.checksumSha256 === parameters[1]);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      if (sql.includes('INSERT INTO kyc_document_versions')) {
        const row = {
          id: `60000000-0000-4000-8000-00000000000${state.latestVersion + 1}`,
          documentId: parameters[0],
          version: parameters[3],
          fileName: parameters[4],
          mimeType: parameters[5],
          fileSize: parameters[6],
          checksumSha256: parameters[7],
          storageLocator: parameters[8],
          status: parameters[9],
          scanStatus: parameters[10],
          sourceIssuedAt: parameters[16],
          sourceRequestId: parameters[14],
          idempotencyKey: parameters[15],
          createdAt: '2026-08-27T00:00:00.000Z',
        };
        state.latestVersion = row.version;
        state.versions.push(row);
        return { rows: [row], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  return {
    state,
    pool: {
      connect: async () => client,
      query: async (sql) => {
        state.sql.push(sql);
        return { rows: [], rowCount: 1 };
      },
    },
  };
}

function documentBody(sourceRequestId, checksumSha256) {
  return {
    documentType: 'id-card-front',
    fileName: 'id-card.png',
    mimeType: 'image/png',
    fileSize: 3,
    checksumSha256,
    storageLocator: `private/kyc/${storeId}/${caseId}/id-card-${sourceRequestId}.png`,
    sourceRequestId,
    sourceIssuedAt: '2026-08-27T00:00:00.000Z',
  };
}

test('profile validator accepts only nested allowlisted fields', () => {
  const result = validateProfileBody({
    expectedProfileVersion: 2,
    sourceRequestId: 'profile-1',
    profile: {
      businessName: 'ร้านตัวอย่าง',
      contactPhone: '0812345678',
      contactEmail: 'merchant@example.com',
      businessCategory: 'retail',
    },
  });

  assert.deepEqual(result, {
    businessName: 'ร้านตัวอย่าง',
    contactPhone: '0812345678',
    contactEmail: 'merchant@example.com',
    businessCategory: 'retail',
  });
});

test('profile validator rejects ownership, status, and credential fields', () => {
  assert.throws(
    () => validateProfileBody({
      expectedProfileVersion: 0,
      storeId: 'store-from-client',
      profile: { businessName: 'ไม่ควรรับ' },
    }),
    (error) => error.code === 'PROFILE_FIELD_FORBIDDEN'
  );

  assert.throws(
    () => validateProfileBody({
      expectedProfileVersion: 0,
      profile: { currentAgentId: 'agent-from-client' },
    }),
    (error) => error.code === 'PROFILE_FIELD_FORBIDDEN'
  );

  assert.throws(
    () => validateProfileBody({
      expectedProfileVersion: 0,
      agent: { id: 'agent-from-client' },
      profile: { businessName: 'ไม่ควรรับ' },
    }),
    (error) => error.code === 'PROFILE_FIELD_FORBIDDEN'
  );
});

test('document validator requires a private locator and matching SHA-256 metadata', () => {
  const valid = validateDocumentBody({
    documentType: 'id-card-front',
    fileName: 'id-card.png',
    mimeType: 'image/png',
    fileSize: 3,
    checksumSha256: '039058c6f2c0cb492c533b0a4d14ef77cc0a1c7f6e2f6d2f3e6e4e4e7e9e4e4e',
    storageLocator: 'private/kyc/store/case/object.png',
  });

  assert.equal(valid.storageLocator.startsWith('private/kyc/'), true);

  assert.throws(
    () => validateDocumentBody({
      documentType: 'id-card-front',
      fileName: 'id-card.png',
      mimeType: 'image/png',
      fileSize: 3,
      checksumSha256: valid.checksumSha256,
      storageLocator: 'https://public.example/id-card.png',
    }),
    (error) => error.code === 'PRIVATE_STORAGE_LOCATOR_REQUIRED'
  );
});

test('document validator rejects unsupported MIME and oversized files', () => {
  assert.throws(
    () => validateDocumentBody({
      documentType: 'id-card-front',
      fileName: 'id-card.exe',
      mimeType: 'application/octet-stream',
      fileSize: 100,
      checksumSha256: 'a'.repeat(64),
      storageLocator: 'private/kyc/store/case/object.exe',
    }),
    (error) => error.code === 'DOCUMENT_METADATA_INVALID'
  );

  assert.throws(
    () => validateDocumentBody({
      documentType: 'id-card-front',
      fileName: 'id-card.png',
      mimeType: 'image/png',
      fileSize: 10 * 1024 * 1024 + 1,
      checksumSha256: 'a'.repeat(64),
      storageLocator: 'private/kyc/store/case/object.png',
    }),
    (error) => error.code === 'DOCUMENT_SIZE_INVALID'
  );
});

test('document command payload matches the Backoffice guide exactly', () => {
  const payload = buildDocumentCommandBody({
    documentId: 'document-1',
    documentType: 'id-card-front',
    version: 1,
    checksumSha256: 'A'.repeat(64),
    storageLocator: 'private/kyc/store/case/document.jpg',
    sourceIssuedAt: '2026-08-14T03:30:00.000Z',
    sourceRequestId: 'upload-1',
  });

  assert.deepEqual(payload, {
    documentId: 'document-1',
    documentType: 'id-card-front',
    version: 1,
    checksumSha256: 'a'.repeat(64),
    storageLocator: 'private/kyc/store/case/document.jpg',
    sourceIssuedAt: '2026-08-14T03:30:00.000Z',
    sourceRequestId: 'upload-1',
  });
  assert.deepEqual(Object.keys(payload), [
    'documentId',
    'documentType',
    'version',
    'checksumSha256',
    'storageLocator',
    'sourceIssuedAt',
    'sourceRequestId',
  ]);
});

test('document intake creates immutable versions and forwards the Backoffice command', async () => {
  const { pool, state } = createDocumentPool();
  const requests = [];
  const backofficeClient = {
    request: async (path, options) => {
      requests.push({ path, options });
      return { ok: true, status: 201, data: { accepted: true } };
    },
  };
  const originalScannerUrl = process.env.DOCUMENT_SCANNER_URL;
  delete process.env.DOCUMENT_SCANNER_URL;

  try {
    const first = await intakeKycDocument({
      pool,
      backofficeClient,
      storeId,
      caseId,
      body: documentBody('document-upload-001', 'a'.repeat(64)),
      idempotencyKey: 'document-idempotency-001',
      requestId: 'request-document-001',
    });
    const second = await intakeKycDocument({
      pool,
      backofficeClient,
      storeId,
      caseId,
      body: documentBody('document-upload-002', 'b'.repeat(64)),
      idempotencyKey: 'document-idempotency-002',
      requestId: 'request-document-002',
    });

    assert.equal(first.document.version, 1);
    assert.equal(second.document.version, 2);
    assert.deepEqual(state.versions.map((version) => version.version), [1, 2]);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].path, `/api/v1/kyc/cases/backoffice-case-001/documents`);
    assert.equal(requests[0].options.body.version, 1);
    assert.equal(requests[1].options.body.version, 2);
    assert.equal(requests[0].options.body.sourceRequestId, 'document-upload-001');
    assert.equal(state.sql.some((sql) => sql.includes('"submittedBy"')), true);
  } finally {
    if (originalScannerUrl === undefined) delete process.env.DOCUMENT_SCANNER_URL;
    else process.env.DOCUMENT_SCANNER_URL = originalScannerUrl;
  }
});

test('document intake replay does not create another version or call Backoffice', async () => {
  const { pool, state } = createDocumentPool();
  let requestCount = 0;
  const backofficeClient = {
    request: async () => {
      requestCount += 1;
      return { ok: true, status: 201, data: { accepted: true } };
    },
  };
  const originalScannerUrl = process.env.DOCUMENT_SCANNER_URL;
  delete process.env.DOCUMENT_SCANNER_URL;

  try {
    const body = documentBody('document-upload-replay', 'c'.repeat(64));
    const first = await intakeKycDocument({ pool, backofficeClient, storeId, caseId, body, idempotencyKey: 'document-replay-001' });
    const replay = await intakeKycDocument({ pool, backofficeClient, storeId, caseId, body, idempotencyKey: 'document-replay-001' });

    assert.equal(first.document.version, 1);
    assert.equal(replay.replayed, true);
    assert.equal(replay.document.version, 1);
    assert.equal(state.versions.length, 1);
    assert.equal(requestCount, 1);
  } finally {
    if (originalScannerUrl === undefined) delete process.env.DOCUMENT_SCANNER_URL;
    else process.env.DOCUMENT_SCANNER_URL = originalScannerUrl;
  }
});

test('document intake keeps the local version pending when Store Backoffice mapping is missing', async () => {
  const { pool, state } = createDocumentPool();
  const backofficeClient = {
    request: async () => {
      const error = new Error('Store credential mapping is missing');
      error.code = 'STORE_CREDENTIAL_MAPPING_MISSING';
      throw error;
    },
  };
  const result = await intakeKycDocument({
    pool,
    backofficeClient,
    storeId,
    caseId,
    body: documentBody('document-pending-001', 'b'.repeat(64)),
    idempotencyKey: 'document-pending-idempotency-001',
  });

  assert.equal(result.document.version, 1);
  assert.deepEqual(result.backoffice, { status: 'PENDING_CONFIGURATION', code: 'STORE_CREDENTIAL_MAPPING_MISSING' });
  assert.equal(state.versions.length, 1);
  assert.equal(state.versions[0].status, result.document.status);
});

test('document intake keeps the local version pending until Backoffice opens the KYC case', async () => {
  const { pool, state } = createDocumentPool({ backofficeCaseId: null });
  let requestCount = 0;
  const result = await intakeKycDocument({
    pool,
    backofficeClient: {
      request: async () => {
        requestCount += 1;
        return { ok: true, status: 201, data: { accepted: true } };
      },
    },
    storeId,
    caseId,
    body: documentBody('document-waiting-for-agent-001', 'd'.repeat(64)),
    idempotencyKey: 'document-waiting-for-agent-idempotency-001',
  });

  assert.equal(result.backoffice.status, 'PENDING_ASSIGNMENT');
  assert.equal(result.backoffice.code, 'BACKOFFICE_CASE_NOT_READY');
  assert.equal(state.versions.length, 1);
  assert.equal(requestCount, 0);
});

test('pending documents are dispatched with the remote KYC case ID after assignment acceptance', async () => {
  const calls = [];
  const document = {
    id: '60000000-0000-4000-8000-000000000001',
    documentId: '50000000-0000-4000-8000-000000000001',
    documentType: 'id-card-front',
    version: 1,
    checksumSha256: 'e'.repeat(64),
    storageLocator: `private/kyc/${storeId}/${caseId}/id-card.png`,
    sourceIssuedAt: '2026-08-27T00:00:00.000Z',
    sourceRequestId: 'document-pending-forward-001',
    idempotencyKey: 'document-pending-forward-key-001',
  };
  const pool = {
    query: async (sql) => {
      if (sql.includes('FROM merchant_kyc_cases')) {
        return { rows: [{ id: caseId, storeId, backofficeCaseId: 'backoffice-case-001' }], rowCount: 1 };
      }
      if (sql.includes('FROM kyc_document_versions')) return { rows: [document], rowCount: 1 };
      if (sql.includes('UPDATE kyc_document_versions')) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
  };
  const result = await dispatchPendingKycDocuments({
    pool,
    backofficeClient: {
      request: async (path, options) => {
        calls.push({ path, options });
        return { ok: true, status: 200, data: { idempotentReplay: true } };
      },
    },
    storeId,
    caseId,
    requestId: 'callback-kyc-event-001',
  });

  assert.deepEqual(result, { status: 'FORWARDED', scanned: 1, forwarded: 1, pending: 0, failed: 0 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/v1/kyc/cases/backoffice-case-001/documents');
  assert.equal(calls[0].options.body.documentId, document.documentId);
  assert.equal(calls[0].options.body.sourceRequestId, document.sourceRequestId);
});
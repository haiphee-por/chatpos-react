const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildDocumentCommandBody,
  validateDocumentBody,
  validateProfileBody,
} = require('./profileKycService.cjs');

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
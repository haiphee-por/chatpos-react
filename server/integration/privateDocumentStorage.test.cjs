const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  locatorToPath,
  readPrivateDocument,
  writePrivateDocument,
} = require('./privateDocumentStorage.cjs');

const data = Buffer.from('private kyc document');
const checksumSha256 = crypto.createHash('sha256').update(data).digest('hex');

async function temporaryRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'chatpos-kyc-'));
}

test('writes and reads a private document with verified metadata', async () => {
  const root = await temporaryRoot();
  try {
    const locator = 'private://merchant/store-1/case-1/document.pdf';
    await writePrivateDocument({ storageLocator: locator, data, expectedSize: data.length, checksumSha256, root });
    const result = await readPrivateDocument(locator, root);
    assert.deepEqual(result.data, data);
    assert.equal(result.filePath, locatorToPath(locator, root));
    await assert.rejects(
      writePrivateDocument({ storageLocator: locator, data, expectedSize: data.length, checksumSha256, root }),
      (error) => error.code === 'EEXIST'
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('rejects traversal and mismatched document metadata', async () => {
  const root = await temporaryRoot();
  try {
    assert.throws(() => locatorToPath('private://merchant/store/../../outside.pdf', root), (error) => error.code === 'PRIVATE_STORAGE_LOCATOR_REQUIRED');
    await assert.rejects(
      writePrivateDocument({ storageLocator: 'private://merchant/store/case/file.pdf', data, expectedSize: data.length + 1, checksumSha256, root }),
      (error) => error.code === 'DOCUMENT_SIZE_MISMATCH'
    );
    await assert.rejects(
      writePrivateDocument({ storageLocator: 'private://merchant/store/case/file.pdf', data, expectedSize: data.length, checksumSha256: '0'.repeat(64), root }),
      (error) => error.code === 'DOCUMENT_CHECKSUM_MISMATCH'
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

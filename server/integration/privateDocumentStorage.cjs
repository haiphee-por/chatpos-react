const fs = require('fs');
const path = require('path');

class PrivateDocumentStorageError extends Error {
  constructor(message, code, statusCode = 422) {
    super(message);
    this.name = 'PrivateDocumentStorageError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function storageRoot(env = process.env) {
  return path.resolve(String(env.KYC_PRIVATE_STORAGE_ROOT || path.join(process.cwd(), 'private-storage')));
}

function locatorToPath(storageLocator, root = storageRoot()) {
  const locator = String(storageLocator || '');
  if (!/^private:\/\/merchant\/[A-Za-z0-9._/-]+$/.test(locator) || locator.includes('..')) {
    throw new PrivateDocumentStorageError('Only merchant private storage locators are accepted', 'PRIVATE_STORAGE_LOCATOR_REQUIRED', 422);
  }
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, locator.slice('private://'.length));
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new PrivateDocumentStorageError('Storage path is outside the private root', 'PRIVATE_STORAGE_PATH_INVALID', 422);
  }
  return resolvedPath;
}

async function writePrivateDocument({ storageLocator, data, expectedSize, checksumSha256, root }) {
  const filePath = locatorToPath(storageLocator, root);
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buffer.length !== Number(expectedSize)) {
    throw new PrivateDocumentStorageError('Uploaded file size does not match metadata', 'DOCUMENT_SIZE_MISMATCH', 422);
  }
  const checksum = require('crypto').createHash('sha256').update(buffer).digest('hex');
  if (checksum !== String(checksumSha256 || '').toLowerCase()) {
    throw new PrivateDocumentStorageError('Uploaded file checksum does not match metadata', 'DOCUMENT_CHECKSUM_MISMATCH', 422);
  }
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, buffer, { flag: 'wx' });
  return filePath;
}

async function readPrivateDocument(storageLocator, root) {
  const filePath = locatorToPath(storageLocator, root);
  try {
    return { filePath, data: await fs.promises.readFile(filePath) };
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new PrivateDocumentStorageError('Document file was not found in private storage', 'DOCUMENT_FILE_NOT_FOUND', 404);
    }
    throw new PrivateDocumentStorageError('Document file could not be read', 'DOCUMENT_FILE_READ_FAILED', 503);
  }
}

async function deletePrivateDocument(storageLocator, root) {
  const filePath = locatorToPath(storageLocator, root);
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

module.exports = {
  PrivateDocumentStorageError,
  deletePrivateDocument,
  locatorToPath,
  readPrivateDocument,
  storageRoot,
  writePrivateDocument,
};

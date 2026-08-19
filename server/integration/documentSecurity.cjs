const crypto = require('crypto');

class DocumentSecurityError extends Error {
  constructor(message, code, statusCode = 422) {
    super(message);
    this.name = 'DocumentSecurityError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function scannerHeaders() {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (process.env.DOCUMENT_SCANNER_TOKEN) headers.Authorization = `Bearer ${process.env.DOCUMENT_SCANNER_TOKEN}`;
  return headers;
}

async function scanDocument({ metadata, fetchImpl = globalThis.fetch }) {
  const scannerUrl = String(process.env.DOCUMENT_SCANNER_URL || '').trim();
  if (!scannerUrl) {
    return { status: 'PENDING', provider: 'unconfigured', reason: 'DOCUMENT_SCANNER_NOT_CONFIGURED' };
  }
  const scanRequestId = crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.DOCUMENT_SCANNER_TIMEOUT_MS || 15000));
  let response;
  try {
    response = await fetchImpl(scannerUrl, {
      method: 'POST',
      headers: { ...scannerHeaders(), 'X-Scan-Request-Id': scanRequestId },
      body: JSON.stringify({
        storageLocator: metadata.storageLocator,
        checksumSha256: metadata.checksumSha256,
        mimeType: metadata.mimeType,
        fileSize: metadata.fileSize,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    return { status: 'PENDING', provider: 'scanner', reason: 'SCANNER_UNAVAILABLE', error: error.code || error.message };
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    return { status: 'PENDING', provider: 'scanner', reason: `SCANNER_HTTP_${response.status}` };
  }
  let result;
  try {
    result = await response.json();
  } catch {
    return { status: 'PENDING', provider: 'scanner', reason: 'SCANNER_INVALID_RESPONSE' };
  }
  const status = String(result.status || result.verdict || '').toUpperCase();
  if (status === 'INFECTED' || status === 'MALICIOUS' || status === 'REJECTED') {
    throw new DocumentSecurityError('Document failed malware scanning', 'DOCUMENT_SCAN_REJECTED', 422);
  }
  if (status !== 'CLEAN' && status !== 'PASSED') {
    return { status: 'PENDING', provider: 'scanner', reason: 'SCANNER_PENDING', scanRequestId };
  }
  return { status: 'CLEAN', provider: 'scanner', scanRequestId };
}

module.exports = { DocumentSecurityError, scanDocument };

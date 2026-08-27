const crypto = require('crypto');
const { scanDocument } = require('./documentSecurity.cjs');
const { createDocumentDownloadUrl, verifyDocumentDownloadToken } = require('./documentAccess.cjs');
const { readPrivateDocument } = require('./privateDocumentStorage.cjs');

const PROFILE_FIELDS = {
  businessName: { column: 'name' },
  contactPhone: { column: 'phone' },
  address: { column: 'address' },
  businessMode: { column: 'storeType' },
};
const PROFILE_JSON_FIELDS = new Set(['ownerName', 'contactEmail', 'province', 'district', 'businessCategory']);
const KYC_IMPACT_FIELDS = new Set(['businessName', 'ownerName', 'contactPhone', 'contactEmail', 'address', 'province', 'district', 'businessCategory', 'businessMode']);
const FORBIDDEN_PROFILE_FIELDS = new Set([
  'storeId',
  'agentId',
  'agentPhone',
  'agent',
  'currentAgentId',
  'pdId',
  'currentPdId',
  'pd',
  'assignment',
  'assignmentStatus',
  'status',
  'kycStatus',
  'paymentStatus',
  'credential',
  'credentials',
  'apiKey',
  'secret',
  'password',
  'token',
  'webhookSecret',
  'payoutBankName',
  'payoutAccountNumber',
  'payoutAccountName',
  'bankAccountNumber',
  'settlementStatus',
]);
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_DOCUMENT_TYPES = new Set([
  'id-card-front',
  'id-card-back',
  'selfie-with-id',
  'bank-book',
  'business-document',
  'store-front',
  'store-interior',
  'product-photos',
  'sales-evidence',
  'shipping-evidence',
]);
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

class ProfileKycError extends Error {
  constructor(message, code, statusCode = 400, details = {}) {
    super(message);
    this.name = 'ProfileKycError';
    this.code = code;
    this.statusCode = statusCode;
    Object.assign(this, details);
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
  }
  return value;
}

function bodyDigest(value) {
  return sha256(JSON.stringify(stableJson(value)));
}

function stableDocumentId(caseId, documentType) {
  const bytes = crypto.createHash('sha256').update(`chatpos:kyc-document:${caseId}:${documentType}`, 'utf8').digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function assertString(value, field, maxLength = 500) {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new ProfileKycError(`${field} is invalid`, 'INVALID_FIELD', 400, { field });
  }
  return value.trim();
}

function validateProfileBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ProfileKycError('Profile body must be an object', 'INVALID_BODY');
  }
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_PROFILE_FIELDS.has(key)) {
      throw new ProfileKycError(`Profile field ${key} cannot be changed`, 'PROFILE_FIELD_FORBIDDEN', 422, { field: key });
    }
  }
  if (!Number.isInteger(body.expectedProfileVersion) || body.expectedProfileVersion < 0) {
    throw new ProfileKycError('expectedProfileVersion is required', 'EXPECTED_PROFILE_VERSION_REQUIRED', 422);
  }
  if (!body.profile || typeof body.profile !== 'object' || Array.isArray(body.profile)) {
    throw new ProfileKycError('profile object is required', 'PROFILE_FIELDS_REQUIRED', 422);
  }
  const patch = {};
  for (const key of Object.keys(body.profile)) {
    if (!PROFILE_FIELDS[key] && !PROFILE_JSON_FIELDS.has(key)) {
      throw new ProfileKycError(`Profile field ${key} cannot be changed`, 'PROFILE_FIELD_FORBIDDEN', 422, { field: key });
    }
    patch[key] = assertString(body.profile[key], key, key === 'address' ? 2000 : 300);
  }
  if (!Object.keys(patch).length) {
    throw new ProfileKycError('At least one allowlisted profile field is required', 'PROFILE_FIELDS_REQUIRED', 422);
  }
  return patch;
}

function assertIdempotencyKey(value) {
  const key = String(value || '').trim();
  if (!key || key.length > 200) {
    throw new ProfileKycError('Idempotency-Key is required', 'IDEMPOTENCY_REQUIRED', 422);
  }
  return key;
}

function profileSnapshot(row) {
  const profileJson = row.profileJson && typeof row.profileJson === 'object' ? row.profileJson : {};
  return {
    id: row.id,
    profile: {
      businessName: row.name,
      ownerName: profileJson.ownerName || null,
      contactPhone: row.phone,
      contactEmail: profileJson.contactEmail || null,
      address: row.address,
      province: profileJson.province || null,
      district: profileJson.district || null,
      businessCategory: profileJson.businessCategory || null,
      businessMode: row.storeType,
    },
    profileVersion: row.profileVersion,
    updatedAt: row.updatedAt,
  };
}

async function callBackoffice(backofficeClient, path, method, body, idempotencyKey, requestId, sourceRequestId, storeId) {
  if (!backofficeClient) return null;
  const response = await backofficeClient.request(path, {
    method,
    body,
    storeId,
    idempotencyKey,
    requestId,
    sourceRequestId,
  });
  if (!response.ok) {
    throw new ProfileKycError('Backoffice rejected the command', 'BACKOFFICE_COMMAND_REJECTED', response.status >= 400 ? response.status : 502, {
      backofficeStatus: response.status,
      backofficeResponse: response.data,
    });
  }
  return response.data;
}

async function getProfileReplay(pool, storeId, idempotencyKey, digest) {
  const result = await pool.query(
    `SELECT version, "snapshotJson", "bodyDigest"
     FROM merchant_profile_versions
     WHERE "storeId" = $1 AND "idempotencyKey" = $2`,
    [storeId, idempotencyKey]
  );
  const row = result.rows[0];
  if (!row) return null;
  if (row.bodyDigest !== digest) {
    throw new ProfileKycError('The profile idempotency key was reused with a different payload', 'PROFILE_IDEMPOTENCY_CONFLICT', 409);
  }
  return {
    replayed: true,
    idempotentReplay: true,
    profileVersion: row.version,
    profile: row.snapshotJson,
  };
}

async function updateStoreProfile({ pool, backofficeClient, storeId, body, idempotencyKey, requestId }) {
  if (!isUuid(storeId)) throw new ProfileKycError('A valid Store context is required', 'STORE_CONTEXT_REQUIRED', 422);
  const patch = validateProfileBody(body);
  const normalizedIdempotencyKey = assertIdempotencyKey(idempotencyKey);
  const sourceRequestId = String(body.sourceRequestId || requestId || crypto.randomUUID());
  const commandBody = {
    sourceRequestId,
    expectedProfileVersion: body.expectedProfileVersion,
    profile: patch,
  };
  const digest = bodyDigest(commandBody);
  const replay = await getProfileReplay(pool, storeId, normalizedIdempotencyKey, digest);
  if (replay) return replay;

  const currentResult = await pool.query(
    `SELECT id, name, address, phone, "storeType", "profileJson", "profileVersion", "updatedAt"
     FROM "Store" WHERE id = $1`,
    [storeId]
  );
  const currentStore = currentResult.rows[0];
  if (!currentStore) throw new ProfileKycError('Store was not found', 'STORE_NOT_FOUND', 404);
  if (currentStore.profileVersion !== body.expectedProfileVersion) {
    throw new ProfileKycError('Profile was changed by another request', 'PROFILE_VERSION_CONFLICT', 409, {
      currentProfile: profileSnapshot(currentStore),
    });
  }

  await callBackoffice(
    backofficeClient,
    '/api/v1/stores/profile',
    'PATCH',
    commandBody,
    normalizedIdempotencyKey,
    requestId,
    sourceRequestId,
    storeId
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const storeResult = await client.query(
            `SELECT id, name, address, phone, "storeType", "profileJson",
              "profileVersion", "userId", "updatedAt"
       FROM "Store" WHERE id = $1 FOR UPDATE`,
      [storeId]
    );
    const store = storeResult.rows[0];
    if (!store) throw new ProfileKycError('Store was not found', 'STORE_NOT_FOUND', 404);
    const beforeSnapshot = profileSnapshot(store);

    if (store.profileVersion !== body.expectedProfileVersion) {
      throw new ProfileKycError('Profile was changed by another request', 'PROFILE_VERSION_CONFLICT', 409, {
        currentProfile: profileSnapshot(store),
      });
    }

    const nextVersion = store.profileVersion + 1;
    const setParts = [];
    const values = [];
    for (const [field, value] of Object.entries(patch)) {
      const column = PROFILE_FIELDS[field]?.column;
      if (!column) continue;
      values.push(value);
      setParts.push(`"${column}" = $${values.length}`);
    }
    const profileJson = { ...(store.profileJson || {}) };
    for (const field of PROFILE_JSON_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(patch, field)) profileJson[field] = patch[field];
    }
    values.push(JSON.stringify(profileJson), nextVersion, storeId);
    const updatedResult = await client.query(
      `UPDATE "Store"
       SET ${setParts.length ? `${setParts.join(', ')}, ` : ''}"profileJson" = $${values.length - 2}::jsonb, "profileVersion" = $${values.length - 1}, "updatedAt" = NOW()
       WHERE id = $${values.length}
       RETURNING id, name, address, phone, "storeType", "profileJson", "profileVersion", "updatedAt"`,
      values
    );
    const updated = updatedResult.rows[0];
    const snapshot = profileSnapshot(updated);
    const changedFields = Object.keys(patch);

    await client.query(
      `INSERT INTO merchant_profile_versions
        ("storeId", version, "sourceRequestId", "idempotencyKey", "bodyDigest", "changedFieldsJson", "snapshotJson", "createdBy")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)`,
      [storeId, nextVersion, sourceRequestId, normalizedIdempotencyKey, digest, JSON.stringify(changedFields), JSON.stringify(snapshot), 'merchant']
    );

    const caseResult = await client.query(
      `SELECT id, "verificationId", "assignedAgentId", status, "submissionSnapshotJson", "submissionProfileVersion"
       FROM merchant_kyc_cases
       WHERE "storeId" = $1
       ORDER BY "updatedAt" DESC
       LIMIT 1
       FOR UPDATE`,
      [storeId]
    );
    const kycCase = caseResult.rows[0];
    if (kycCase && changedFields.some((field) => KYC_IMPACT_FIELDS.has(field)) && kycCase.status !== 'draft') {
      const submissionSnapshot = kycCase.submissionSnapshotJson || beforeSnapshot;
      await client.query(
        `UPDATE merchant_kyc_cases
         SET status = 'WAITING_AGENT_REVIEW',
             "submissionSnapshotJson" = COALESCE("submissionSnapshotJson", $2::jsonb),
             "submissionProfileVersion" = COALESCE("submissionProfileVersion", $3),
             "updatedAt" = NOW()
         WHERE id = $1`,
        [kycCase.id, JSON.stringify(submissionSnapshot), store.profileVersion]
      );
      if (kycCase.verificationId) {
        await client.query(
          `UPDATE "KycVerification"
           SET status = 'waiting_agent_review',
               "submissionSnapshotJson" = COALESCE("submissionSnapshotJson", $2::jsonb),
               "submissionProfileVersion" = COALESCE("submissionProfileVersion", $3),
               "updatedAt" = NOW()
           WHERE id = $1`,
          [kycCase.verificationId, JSON.stringify(submissionSnapshot), store.profileVersion]
        );
      }
      await client.query(
        `INSERT INTO notifications ("recipientId", "storeId", "caseId", type, category, title, message, "actionTarget")
         VALUES ($1, $2, $3, 'PROFILE_CHANGED_KYC_REVIEW', 'kyc', 'ข้อมูลร้านค้าเปลี่ยน ต้องตรวจ KYC ใหม่', $4, '#kyc')`,
        [String(kycCase.assignedAgentId || store.userId), storeId, kycCase.id, 'มีข้อมูลร้านค้าที่กระทบ KYC ถูกแก้ไข ระบบส่งกลับให้ Agent ตรวจสอบอีกครั้งแล้ว']
      );
    }

    await client.query(
      `INSERT INTO audit_logs ("actorId", "actorRole", action, "targetType", "targetId", "beforeJson", "afterJson", "requestId")
       VALUES ($1, 'merchant', 'PROFILE_UPDATED', 'Store', $2, $3::jsonb, $4::jsonb, $5)`,
      [String(store.userId || 'merchant-session'), storeId, JSON.stringify(beforeSnapshot), JSON.stringify(snapshot), requestId || sourceRequestId]
    );
    await client.query('COMMIT');
    return { replayed: false, idempotentReplay: false, profileVersion: nextVersion, profile: snapshot };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      const replay = await getProfileReplay(pool, storeId, normalizedIdempotencyKey, digest);
      if (replay) return replay;
    }
    throw error;
  } finally {
    client.release();
  }
}

function validateDocumentBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ProfileKycError('Document body must be an object', 'INVALID_BODY');
  const documentType = assertString(body.documentType, 'documentType', 120);
  const fileName = assertString(body.fileName, 'fileName', 255);
  const mimeType = assertString(body.mimeType, 'mimeType', 100).toLowerCase();
  const fileSize = Number(body.fileSize);
  const checksumSha256 = String(body.checksumSha256 || '').toLowerCase();
  const storageLocator = String(body.storageLocator || '');
  const sourceIssuedAtValue = body.sourceIssuedAt === undefined ? new Date() : new Date(String(body.sourceIssuedAt));
  if (Number.isNaN(sourceIssuedAtValue.getTime())) {
    throw new ProfileKycError('sourceIssuedAt must be a valid timestamp', 'DOCUMENT_SOURCE_ISSUED_AT_INVALID', 422);
  }
  const sourceIssuedAt = sourceIssuedAtValue.toISOString();
  if (!documentType || !ALLOWED_DOCUMENT_TYPES.has(documentType) || !fileName || !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new ProfileKycError('Document type, file name and allowed MIME type are required', 'DOCUMENT_METADATA_INVALID', 422);
  }
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MAX_DOCUMENT_BYTES) {
    throw new ProfileKycError('Document size is outside the allowed limit', 'DOCUMENT_SIZE_INVALID', 422);
  }
  if (!/^[a-f0-9]{64}$/.test(checksumSha256)) {
    throw new ProfileKycError('checksumSha256 must be a SHA-256 hex digest', 'DOCUMENT_CHECKSUM_INVALID', 422);
  }
  if (!/^private\/kyc\/[A-Za-z0-9._/-]+$/.test(storageLocator) || storageLocator.includes('..')) {
    throw new ProfileKycError('Only private storage locators are accepted', 'PRIVATE_STORAGE_LOCATOR_REQUIRED', 422);
  }
  if (body.contentBase64 !== undefined) {
    throw new ProfileKycError('Inline document content is not accepted; upload through private storage first', 'DOCUMENT_CONTENT_FORBIDDEN', 422);
  }
  return {
    documentType,
    fileName,
    mimeType,
    fileSize,
    checksumSha256,
    storageLocator,
    sourceIssuedAt,
    reason: body.reason === undefined ? null : assertString(body.reason, 'reason', 500),
  };
}

function buildDocumentCommandBody({ documentId, documentType, version, checksumSha256, storageLocator, sourceIssuedAt, sourceRequestId }) {
  return {
    documentId: String(documentId),
    documentType: String(documentType),
    version: Number(version),
    checksumSha256: String(checksumSha256).toLowerCase(),
    storageLocator: String(storageLocator),
    sourceIssuedAt: new Date(sourceIssuedAt).toISOString(),
    sourceRequestId: String(sourceRequestId),
  };
}

function assertDocumentLocatorScope(storageLocator, storeId, caseId) {
  const expectedPrefix = `private/kyc/${storeId}/${caseId}/`;
  if (!String(storageLocator).startsWith(expectedPrefix)) {
    throw new ProfileKycError('Document locator is outside the Store and Case scope', 'DOCUMENT_LOCATOR_SCOPE_INVALID', 403);
  }
}

async function getKycCaseForStore(client, caseId, storeId, lock = false) {
  if (!isUuid(caseId) || !isUuid(storeId)) throw new ProfileKycError('A valid case and Store context are required', 'KYC_CONTEXT_REQUIRED', 422);
  const result = await client.query(
    `SELECT id, "storeId", "verificationId", case_number, status, "submissionVersion", "submissionSnapshotJson", "submissionProfileVersion"
     FROM merchant_kyc_cases
     WHERE id = $1 AND "storeId" = $2${lock ? ' FOR UPDATE' : ''}`,
    [caseId, storeId]
  );
  if (!result.rows[0]) throw new ProfileKycError('KYC case was not found', 'KYC_CASE_NOT_FOUND', 404);
  return result.rows[0];
}

async function intakeKycDocument({ pool, backofficeClient, storeId, caseId, body, idempotencyKey, requestId, documentLinkTtlSeconds = 86400, publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL }) {
  const metadata = validateDocumentBody(body);
  assertDocumentLocatorScope(metadata.storageLocator, storeId, caseId);
  const scan = await scanDocument({ metadata });
  const normalizedIdempotencyKey = assertIdempotencyKey(idempotencyKey);
  const sourceRequestId = String(body.sourceRequestId || requestId || crypto.randomUUID());
  const sourceIssuedAt = metadata.sourceIssuedAt;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const kycCase = await getKycCaseForStore(client, caseId, storeId, true);
    const replayResult = await client.query(
      `SELECT id, "documentId", version, "fileName", "mimeType", "fileSize", "checksumSha256", "storageLocator", status, "sourceIssuedAt", "sourceRequestId", "createdAt"
       FROM kyc_document_versions
       WHERE "caseId" = $1 AND ("sourceRequestId" = $2 OR "idempotencyKey" = $3)`,
      [caseId, sourceRequestId, normalizedIdempotencyKey]
    );
    if (replayResult.rows[0]) {
      const existing = replayResult.rows[0];
      if (existing.checksumSha256 !== metadata.checksumSha256 || existing.storageLocator !== metadata.storageLocator) {
        throw new ProfileKycError('The document request was replayed with different content', 'DOCUMENT_IDEMPOTENCY_CONFLICT', 409);
      }

      await client.query('COMMIT');
      return { replayed: true, idempotentReplay: true, document: existing, backoffice: null };
    }

    const documentResult = await client.query(
      `INSERT INTO kyc_documents (id, "caseId", "storeId", "documentType")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("caseId", "documentType") DO UPDATE SET "updatedAt" = NOW()
       RETURNING id, "latestVersion"`,
      [stableDocumentId(caseId, metadata.documentType), caseId, storeId, metadata.documentType]
    );
    const document = documentResult.rows[0];
    const checksumResult = await client.query(
      `SELECT id, "checksumSha256", "storageLocator"
       FROM kyc_document_versions
       WHERE "documentId" = $1 AND "checksumSha256" = $2`,
      [document.id, metadata.checksumSha256]
    );
    if (checksumResult.rows[0]) {
      throw new ProfileKycError('This checksum already exists for the document', 'DOCUMENT_CHECKSUM_CONFLICT', 409);
    }
    const version = Number(document.latestVersion) + 1;
    const versionResult = await client.query(
      `INSERT INTO kyc_document_versions
        ("documentId", "caseId", "storeId", version, "fileName", "mimeType", "fileSize", "checksumSha256", "storageLocator", status, "scanStatus", "scanReportJson", "scannedAt", submittedBy, reason, "sourceRequestId", "idempotencyKey", "sourceIssuedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, 'merchant', $14, $15, $16, $17)
       RETURNING id, "documentId", version, "fileName", "mimeType", "fileSize", "checksumSha256", "storageLocator", status, "scanStatus", "sourceIssuedAt", "sourceRequestId", "createdAt"`,
      [document.id, caseId, storeId, version, metadata.fileName, metadata.mimeType, metadata.fileSize, metadata.checksumSha256, metadata.storageLocator, scan.status === 'CLEAN' ? 'uploaded' : 'quarantined', scan.status, JSON.stringify(scan), scan.status === 'CLEAN' ? new Date().toISOString() : null, metadata.reason, sourceRequestId, normalizedIdempotencyKey, sourceIssuedAt]
    );
    const commandBody = buildDocumentCommandBody({
      documentId: versionResult.rows[0].documentId,
      documentType: metadata.documentType,
      version,
      checksumSha256: metadata.checksumSha256,
      storageLocator: metadata.storageLocator,
      sourceIssuedAt: versionResult.rows[0].sourceIssuedAt,
      sourceRequestId,
    });
    const remoteResult = await callBackoffice(backofficeClient, `/api/v1/kyc/cases/${caseId}/documents`, 'POST', commandBody, normalizedIdempotencyKey, requestId, sourceRequestId, storeId);
    await client.query(
      `UPDATE kyc_documents SET status = $1, "scanStatus" = $2, "scanReportJson" = $3::jsonb, "scannedAt" = $4, "latestVersion" = $5, "updatedAt" = NOW() WHERE id = $6`,
      [scan.status === 'CLEAN' ? 'uploaded' : 'quarantined', scan.status, JSON.stringify(scan), scan.status === 'CLEAN' ? new Date().toISOString() : null, version, document.id]
    );
    if (kycCase.status === 'draft' || kycCase.status === 'merchant_replied') {
      await client.query(`UPDATE merchant_kyc_cases SET status = 'WAITING_AGENT_REVIEW', "updatedAt" = NOW() WHERE id = $1`, [caseId]);
    }
    await client.query(
      `INSERT INTO audit_logs ("actorId", "actorRole", action, "targetType", "targetId", "afterJson", "requestId")
       VALUES ('merchant-session', 'merchant', 'KYC_DOCUMENT_VERSION_CREATED', 'KycDocumentVersion', $1, $2::jsonb, $3)`,
      [versionResult.rows[0].id, JSON.stringify({ caseId, documentType: metadata.documentType, version, checksumSha256: metadata.checksumSha256, scanStatus: scan.status }), requestId || sourceRequestId]
    );
    await client.query('COMMIT');
    return { replayed: false, idempotentReplay: false, document: versionResult.rows[0], backoffice: remoteResult };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      throw new ProfileKycError('The document request conflicts with an existing immutable version', 'DOCUMENT_VERSION_CONFLICT', 409);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function ensureKycCase(client, storeId) {
  const existing = await client.query(
    `SELECT id, "storeId", "verificationId", case_number, status, "submissionVersion", "submissionSnapshotJson", "submissionProfileVersion"
     FROM merchant_kyc_cases WHERE "storeId" = $1 ORDER BY "updatedAt" DESC LIMIT 1`,
    [storeId]
  );
  if (existing.rows[0]) return existing.rows[0];
  const store = await client.query(`SELECT id, "userId" FROM "Store" WHERE id = $1`, [storeId]);
  if (!store.rows[0]) throw new ProfileKycError('Store was not found', 'STORE_NOT_FOUND', 404);
  const verification = await client.query(`SELECT id FROM "KycVerification" WHERE "storeId" = $1 ORDER BY "updatedAt" DESC LIMIT 1`, [storeId]);
  const caseNumber = `KYC-${new Date().toISOString().slice(0, 7).replace('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const created = await client.query(
    `INSERT INTO merchant_kyc_cases ("storeId", "verificationId", case_number, status)
     VALUES ($1, $2, $3, 'draft')
     RETURNING id, "storeId", "verificationId", case_number, status, "submissionVersion", "submissionSnapshotJson", "submissionProfileVersion"`,
    [storeId, verification.rows[0]?.id || null, caseNumber]
  );
  return created.rows[0];
}

async function getKycWorkspace({ pool, storeId }) {
  if (!isUuid(storeId)) throw new ProfileKycError('A valid Store context is required', 'STORE_CONTEXT_REQUIRED', 422);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const kycCase = await ensureKycCase(client, storeId);
    const documents = await client.query(
      `SELECT d.id, d."documentType", d.status, d."latestVersion", d."updatedAt",
              COALESCE(json_agg(json_build_object(
                'id', v.id, 'version', v.version, 'fileName', v."fileName", 'mimeType', v."mimeType",
                'fileSize', v."fileSize", 'checksumSha256', v."checksumSha256", 'storageLocator', v."storageLocator",
                'sourceIssuedAt', v."sourceIssuedAt", 'status', v.status, 'scanStatus', v."scanStatus", 'reason', v.reason, 'reviewNotes', v."reviewNotes", 'createdAt', v."createdAt"
              ) ORDER BY v.version DESC) FILTER (WHERE v.id IS NOT NULL), '[]') AS versions
       FROM kyc_documents d
       LEFT JOIN kyc_document_versions v ON v."documentId" = d.id
       WHERE d."caseId" = $1
       GROUP BY d.id
       ORDER BY d."updatedAt" DESC`,
      [kycCase.id]
    );
    const messages = await client.query(
      `SELECT id, "senderId", "senderRole", "recipientId", message, "attachmentMetadataJson", status, "readAt", "createdAt"
       FROM kyc_chat_messages WHERE "caseId" = $1 ORDER BY "createdAt" ASC`,
      [kycCase.id]
    );
    const notifications = await client.query(
      `SELECT id, type, title, message, "readAt", "createdAt"
       FROM notifications WHERE "caseId" = $1 ORDER BY "createdAt" DESC LIMIT 20`,
      [kycCase.id]
    );
    await client.query('COMMIT');
    return { case: kycCase, documents: documents.rows, messages: messages.rows, notifications: notifications.rows };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function validateAttachments(value, storeId, caseId) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10) throw new ProfileKycError('attachments must be an array', 'ATTACHMENTS_INVALID', 422);
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new ProfileKycError('attachment metadata is invalid', 'ATTACHMENT_METADATA_INVALID', 422);
    const metadata = {
      fileName: assertString(item.fileName, 'attachment.fileName', 255),
      mimeType: assertString(item.mimeType, 'attachment.mimeType', 100),
      fileSize: Number(item.fileSize),
      checksumSha256: String(item.checksumSha256 || '').toLowerCase(),
      storageLocator: String(item.storageLocator || ''),
    };
    if (!Number.isSafeInteger(metadata.fileSize) || metadata.fileSize <= 0 || metadata.fileSize > MAX_DOCUMENT_BYTES || !ALLOWED_MIME_TYPES.has(metadata.mimeType) || !/^[a-f0-9]{64}$/.test(metadata.checksumSha256) || !/^private\/kyc\/[A-Za-z0-9._/-]+$/.test(metadata.storageLocator) || metadata.storageLocator.includes('..')) {
      throw new ProfileKycError('Attachment metadata failed private storage validation', 'ATTACHMENT_METADATA_INVALID', 422);
    }
    assertDocumentLocatorScope(metadata.storageLocator, storeId, caseId);
    return metadata;
  });
}

async function appendKycMessage({ pool, storeId, caseId, body, actorId, actorRole }) {
  const message = assertString(body?.message, 'message', 5000);
  const attachments = validateAttachments(body?.attachments, storeId, caseId);
  if (!message && !attachments.length) throw new ProfileKycError('Message or attachment is required', 'MESSAGE_CONTENT_REQUIRED', 422);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await getKycCaseForStore(client, caseId, storeId, true);
    const result = await client.query(
      `INSERT INTO kyc_chat_messages ("caseId", "senderId", "senderRole", "recipientId", message, "attachmentMetadataJson")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, "senderId", "senderRole", "recipientId", message, "attachmentMetadataJson", status, "readAt", "createdAt"`,
      [caseId, String(actorId || 'merchant-session'), String(actorRole || 'merchant'), body?.recipientId ? assertString(body.recipientId, 'recipientId', 200) : null, message || null, JSON.stringify(attachments)]
    );
    await client.query(`UPDATE merchant_kyc_cases SET status = 'merchant_replied', "updatedAt" = NOW() WHERE id = $1 AND status = 'needs_more_info'`, [caseId]);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function markKycMessageRead({ pool, storeId, caseId, messageId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await getKycCaseForStore(client, caseId, storeId, true);
    const result = await client.query(
      `UPDATE kyc_chat_messages SET "readAt" = COALESCE("readAt", NOW())
       WHERE id = $1 AND "caseId" = $2
       RETURNING id, "readAt"`,
      [messageId, caseId]
    );
    await client.query('COMMIT');
    if (!result.rows[0]) throw new ProfileKycError('Message was not found', 'MESSAGE_NOT_FOUND', 404);
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getDocumentAccess({ pool, storeId, versionId, documentLinkTtlSeconds = 86400, publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL }) {
  if (!isUuid(storeId) || !isUuid(versionId)) throw new ProfileKycError('A valid Store and document version are required', 'DOCUMENT_CONTEXT_REQUIRED', 422);
  const result = await pool.query(
    `SELECT id, "caseId", "fileName", "mimeType", "fileSize", "checksumSha256", "storageLocator", status, "scanStatus"
     FROM kyc_document_versions WHERE id = $1 AND "storeId" = $2`,
    [versionId, storeId]
  );
  const version = result.rows[0];
  if (!version) throw new ProfileKycError('Document version was not found', 'DOCUMENT_VERSION_NOT_FOUND', 404);
  if (version.scanStatus !== 'CLEAN') throw new ProfileKycError('Document is not available until malware scanning completes', 'DOCUMENT_QUARANTINED', 423);
  if (!/^private\/kyc\/[A-Za-z0-9._/-]+$/.test(String(version.storageLocator)) && !/^private:\/\/merchant\/[A-Za-z0-9._/-]+$/.test(String(version.storageLocator))) {
    throw new ProfileKycError('Public document locators are forbidden', 'PRIVATE_STORAGE_LOCATOR_REQUIRED', 422);
  }
  const download = createDocumentDownloadUrl({
    baseUrl: publicBaseUrl,
    versionId,
    storeId,
    ttlSeconds: documentLinkTtlSeconds,
  });
  return { ...version, access: 'signed-download', downloadUrl: download.url, downloadUrlExpiresAt: download.expiresAt };
}

async function getKycDocumentDownload({ pool, versionId, token, nowSeconds }) {
  if (!isUuid(versionId)) throw new ProfileKycError('A valid document version is required', 'DOCUMENT_CONTEXT_REQUIRED', 422);
  const result = await pool.query(
    `SELECT id, "caseId", "storeId", "fileName", "mimeType", "fileSize", "checksumSha256", "storageLocator", status, "scanStatus"
     FROM kyc_document_versions WHERE id = $1`,
    [versionId]
  );
  const version = result.rows[0];
  if (!version) throw new ProfileKycError('Document version was not found', 'DOCUMENT_VERSION_NOT_FOUND', 404);
  const payload = verifyDocumentDownloadToken(token, { versionId, storeId: version.storeId, nowSeconds });
  if (version.scanStatus !== 'CLEAN') throw new ProfileKycError('Document is not available until malware scanning completes', 'DOCUMENT_QUARANTINED', 423);
  const file = await readPrivateDocument(version.storageLocator);
  const fileChecksum = sha256(file.data);
  if (file.data.length !== Number(version.fileSize) || fileChecksum !== String(version.checksumSha256).toLowerCase()) {
    throw new ProfileKycError('Document file integrity verification failed', 'DOCUMENT_FILE_INTEGRITY_FAILED', 503);
  }
  return { version, data: file.data, expiresAt: new Date(payload.expiresAt * 1000).toISOString() };
}

module.exports = {
  MAX_DOCUMENT_BYTES,
  ALLOWED_DOCUMENT_TYPES,
  ProfileKycError,
  appendKycMessage,
  buildDocumentCommandBody,
  getDocumentAccess,
  getKycDocumentDownload,
  getKycWorkspace,
  intakeKycDocument,
  markKycMessageRead,
  stableDocumentId,
  updateStoreProfile,
  validateDocumentBody,
  validateProfileBody,
};

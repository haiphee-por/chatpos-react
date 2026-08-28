const crypto = require('crypto');
const {
  AssignmentError,
  normalizeCallbackContext,
  verifyMerchantWorkflowCallback,
} = require('./assignmentService.cjs');

const CALLBACK_PROVIDER = 'agent_pd_backoffice';
const KYC_EVENT_TYPE = 'kyc.case.status.changed';
const KYC_STATUSES = new Set([
  'WAITING_AGENT_REVIEW',
  'AGENT_REVIEWING',
  'WAITING_MERCHANT_DOCUMENTS',
  'READY_FOR_PD',
  'SUBMITTED_TO_PD',
  'PD_REVIEWING',
  'RETURNED_TO_AGENT',
  'REJECTED_BY_PD',
  'KYC_APPROVED',
  'SUSPENDED',
]);

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function withTransaction(pool, callback) {
  return pool.connect().then(async (client) => {
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  });
}

function parseCallbackBody(rawBody) {
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new AssignmentError('Callback body must be valid JSON', 'INVALID_JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AssignmentError('Callback body must be an object', 'INVALID_BODY');
  }
  const storeReference = String(body.storeId || '').trim();
  if (!storeReference || storeReference.length > 200) {
    throw new AssignmentError('Callback storeId is invalid', 'INVALID_STORE_ID');
  }
  return { body, storeReference };
}

function callbackDate(value, nowSeconds) {
  const occurredAt = value ? new Date(value) : new Date(nowSeconds * 1000);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new AssignmentError('occurredAt must be a valid date', 'INVALID_OCCURRED_AT');
  }
  return occurredAt;
}

function verificationStatus(status) {
  const values = {
    WAITING_AGENT_REVIEW: 'waiting_agent_review',
    AGENT_REVIEWING: 'agent_reviewing',
    WAITING_MERCHANT_DOCUMENTS: 'waiting_merchant_documents',
    READY_FOR_PD: 'ready_for_pd',
    SUBMITTED_TO_PD: 'submitted_to_pd',
    PD_REVIEWING: 'pd_reviewing',
    RETURNED_TO_AGENT: 'returned_to_agent',
    REJECTED_BY_PD: 'rejected',
    KYC_APPROVED: 'approved',
    SUSPENDED: 'suspended',
  };
  return values[status] || status.toLowerCase();
}

function approvalLevel(status) {
  if (status === 'KYC_APPROVED') return 'approved';
  if (status === 'SUBMITTED_TO_PD' || status === 'PD_REVIEWING') return 'pd_review';
  return 'pending';
}

async function findKycCase(client, { storeId, backofficeCaseId, assignmentRequestId }) {
  if (backofficeCaseId) {
    const byRemoteId = await client.query(
      `SELECT id, "verificationId", status, "backofficeCaseId", "lastBackofficeEventOccurredAt"
       FROM merchant_kyc_cases
       WHERE "storeId" = $1 AND ("backofficeCaseId" = $2 OR id::text = $2)
       ORDER BY "updatedAt" DESC
       LIMIT 1
       FOR UPDATE`,
      [storeId, backofficeCaseId]
    );
    if (byRemoteId.rows[0]) return byRemoteId.rows[0];
  }

  if (!assignmentRequestId) return null;
  const byAssignment = await client.query(
    `SELECT c.id, c."verificationId", c.status, c."backofficeCaseId", c."lastBackofficeEventOccurredAt"
     FROM merchant_kyc_cases c
     INNER JOIN agent_assignments a ON a."storeId" = c."storeId"
       AND a."assignmentRequestId" = $2
     WHERE c."storeId" = $1
     ORDER BY c."updatedAt" DESC
     LIMIT 1
     FOR UPDATE`,
    [storeId, assignmentRequestId]
  );
  return byAssignment.rows[0] || null;
}

async function syncKycCase(client, { body, storeId, occurredAt }) {
  const status = String(body.status || '').trim().toUpperCase();
  if (!KYC_STATUSES.has(status)) {
    throw new AssignmentError('Unsupported KYC case status', 'INVALID_KYC_STATUS');
  }
  const caseId = String(body.caseId || '').trim();
  if (!caseId || caseId.length > 200) {
    throw new AssignmentError('caseId is required', 'KYC_CASE_ID_REQUIRED');
  }

  const kycCase = await findKycCase(client, {
    storeId,
    backofficeCaseId: caseId,
    assignmentRequestId: String(body.assignmentRequestId || '').trim(),
  });
  if (!kycCase) {
    throw new AssignmentError('KYC case was not found for callback', 'KYC_CASE_NOT_FOUND', 404);
  }

  const previousOccurredAt = kycCase.lastBackofficeEventOccurredAt
    ? new Date(kycCase.lastBackofficeEventOccurredAt)
    : null;
  if (previousOccurredAt && occurredAt.getTime() <= previousOccurredAt.getTime()) {
    return { storeId, caseId: kycCase.id, backofficeCaseId: caseId, status: kycCase.status, late: true };
  }

  const updated = await client.query(
    `UPDATE merchant_kyc_cases
     SET status = $1,
         "backofficeCaseId" = COALESCE("backofficeCaseId", $2),
         "lastBackofficeEventOccurredAt" = $3,
         "lastBackofficeEventId" = $4,
         "updatedAt" = NOW()
     WHERE id = $5
     RETURNING id, status`,
    [status, caseId, occurredAt.toISOString(), String(body.eventId), kycCase.id]
  );
  if (kycCase.verificationId) {
    await client.query(
      `UPDATE "KycVerification"
       SET status = $1,
           "approvalLevel" = $2,
           "updatedAt" = NOW()
       WHERE id = $3`,
      [verificationStatus(status), approvalLevel(status), kycCase.verificationId]
    );
  }
  return { storeId, caseId: updated.rows[0].id, backofficeCaseId: caseId, status: updated.rows[0].status, late: false };
}

async function syncStoreAssignment(client, { body, storeId }) {
  const agentCode = String(body.agentCode || body.agent?.code || '').trim();
  const pdCode = String(body.pdCode || body.pd?.code || '').trim();
  if (!agentCode || !pdCode) return { updated: false };

  const target = await client.query(
    `SELECT a.id AS "agentId", pd.id AS "pdId"
     FROM "Agent" a
     INNER JOIN "ProvincialDirector" pd ON pd.id = a."currentPdId"
     WHERE a.code = $1 AND a.status = 'active' AND pd.code = $2 AND pd.status = 'active'
     LIMIT 1`,
    [agentCode, pdCode]
  );
  if (!target.rows[0]) return { updated: false };

  await client.query(
    `UPDATE "Store"
     SET "currentAgentId" = $1, "currentPdId" = $2, "updatedAt" = NOW()
     WHERE id = $3`,
    [target.rows[0].agentId, target.rows[0].pdId, storeId]
  );
  return { updated: true, agentCode, pdCode };
}

async function syncStoreStatus(client, { body, storeId }) {
  const status = String(body.status || '').trim().toUpperCase();
  const isActive = typeof body.isActive === 'boolean' ? body.isActive : status === 'ACTIVE';
  await client.query(
    `UPDATE "Store" SET "isActive" = $1, "updatedAt" = NOW() WHERE id = $2`,
    [status === 'DELETED' ? false : isActive, storeId]
  );
  return { updated: true, isActive: status === 'DELETED' ? false : isActive };
}

async function syncStoreData(client, { body, storeId }) {
  const snapshot = body.data && typeof body.data === 'object' && body.data.store && typeof body.data.store === 'object'
    ? body.data.store
    : null;
  if (!snapshot) return { updated: false };

  const incomingVersion = Number.isFinite(Number(snapshot.profileVersion)) ? Number(snapshot.profileVersion) : null;
  const incomingUpdatedAt = snapshot.updatedAt ? new Date(snapshot.updatedAt) : null;
  const current = await client.query(
    `SELECT "profileVersion", "updatedAt", "profileJson" FROM "Store" WHERE id = $1 FOR UPDATE`,
    [storeId]
  );
  if (current.rowCount === 0) return { updated: false, missing: true };
  const currentVersion = Number(current.rows[0].profileVersion) || 0;
  const currentUpdatedAt = current.rows[0].updatedAt ? new Date(current.rows[0].updatedAt) : null;
  if (incomingVersion !== null && incomingVersion < currentVersion) {
    return { updated: false, late: true };
  }
  if (
    incomingVersion !== null &&
    incomingVersion === currentVersion &&
    incomingUpdatedAt &&
    currentUpdatedAt &&
    incomingUpdatedAt.getTime() <= currentUpdatedAt.getTime()
  ) {
    return { updated: false, late: true };
  }

  const mergedProfile = { ...(current.rows[0].profileJson || {}) };
  const profileFields = ['ownerName', 'contactEmail', 'contactPhone', 'province', 'district', 'businessCategory', 'businessMode'];
  for (const key of profileFields) {
    if (Object.prototype.hasOwnProperty.call(snapshot, key) && snapshot[key] !== undefined && snapshot[key] !== null) {
      mergedProfile[key] = snapshot[key];
    }
  }

  const nextVersion = incomingVersion !== null ? Math.max(incomingVersion, currentVersion) : currentVersion;
  await client.query(
    `UPDATE "Store"
     SET name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         address = COALESCE($3, address),
         "isActive" = COALESCE($4, "isActive"),
         "isOnboarded" = COALESCE($5, "isOnboarded"),
         tier = COALESCE($6, tier),
         "profileVersion" = $7,
         "profileJson" = $8::jsonb,
         "updatedAt" = NOW()
     WHERE id = $9`,
    [
      snapshot.name ?? null,
      snapshot.contactPhone ?? null,
      snapshot.address ?? null,
      typeof snapshot.isActive === 'boolean' ? snapshot.isActive : null,
      typeof snapshot.isOnboarded === 'boolean' ? snapshot.isOnboarded : null,
      snapshot.tier ?? null,
      nextVersion,
      JSON.stringify(mergedProfile),
      storeId,
    ]
  );
  return { updated: true, profileVersion: nextVersion };
}

async function processMerchantWorkflowCallback({ pool, rawBody, headers, callbackSecret, callbackSecretResolver, nowSeconds = Math.floor(Date.now() / 1000) }) {
  const { body, storeReference } = parseCallbackBody(rawBody);
  const resolvedCallbackSecret = callbackSecretResolver
    ? await callbackSecretResolver(storeReference)
    : callbackSecret;
  const callbackContext = normalizeCallbackContext(resolvedCallbackSecret, storeReference);
  if (!isUuid(callbackContext.storeId)) {
    throw new AssignmentError('Callback Store mapping is invalid', 'INVALID_STORE_ID');
  }
  const verified = verifyMerchantWorkflowCallback({
    rawBody,
    headers,
    callbackSecret: callbackContext.secrets,
    nowSeconds,
  });
  if (body.eventId !== verified.eventId) {
    throw new AssignmentError('Callback event ID header does not match body', 'EVENT_ID_MISMATCH');
  }
  if (body.eventType !== verified.eventType) {
    throw new AssignmentError('Callback event type header does not match body', 'EVENT_TYPE_MISMATCH');
  }
  const occurredAt = callbackDate(body.occurredAt, nowSeconds);
  const bodyDigest = crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex');

  return withTransaction(pool, async (client) => {
    const existingEvent = await client.query(
      'SELECT "bodyDigest", status FROM integration_webhook_events WHERE provider = $1 AND "eventId" = $2 FOR UPDATE',
      [CALLBACK_PROVIDER, verified.eventId]
    );
    if (existingEvent.rowCount > 0) {
      if (existingEvent.rows[0].bodyDigest !== bodyDigest) {
        throw new AssignmentError('Event ID was used with a different payload', 'EVENT_PAYLOAD_CONFLICT', 409);
      }
      return { statusCode: 200, duplicate: true, late: false, data: null };
    }

    await client.query(
      `INSERT INTO integration_webhook_events
        (provider, "eventId", "eventType", "bodyDigest", status, "payloadJson", "receivedAt", "processedAt")
       VALUES ($1, $2, $3, $4, 'RECEIVED', $5::jsonb, NOW(), NOW())`,
      [CALLBACK_PROVIDER, verified.eventId, verified.eventType, bodyDigest, JSON.stringify(body)]
    );

    let data;
    if (verified.eventType === KYC_EVENT_TYPE) {
      data = await syncKycCase(client, { body, storeId: callbackContext.storeId, occurredAt });
    } else if (verified.eventType === 'store.assignment.changed') {
      data = await syncStoreAssignment(client, { body, storeId: callbackContext.storeId });
    } else if (verified.eventType === 'store.data.synced') {
      data = await syncStoreData(client, { body, storeId: callbackContext.storeId });
    } else {
      data = await syncStoreStatus(client, { body, storeId: callbackContext.storeId });
    }

    const late = Boolean(data?.late);
    await client.query(
      `UPDATE integration_webhook_events
       SET status = $1, "processedAt" = NOW()
       WHERE provider = $2 AND "eventId" = $3`,
      [late ? 'IGNORED_LATE' : 'PROCESSED', CALLBACK_PROVIDER, verified.eventId]
    );
    await client.query(
      `INSERT INTO audit_logs
        ("actorId", "actorRole", action, "targetType", "targetId", "reason", "afterJson", "requestId", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW())`,
      [
        'backoffice',
        'backoffice',
        late ? 'MERCHANT_WORKFLOW_CALLBACK_IGNORED_LATE' : 'MERCHANT_WORKFLOW_CALLBACK_PROCESSED',
        verified.eventType,
        callbackContext.storeId,
        body.reason ? String(body.reason).slice(0, 1000) : null,
        JSON.stringify({ eventId: verified.eventId, status: body.status || null, data }),
        verified.eventId,
      ]
    );
    return { statusCode: 200, duplicate: false, late, data };
  });
}

module.exports = { processMerchantWorkflowCallback };
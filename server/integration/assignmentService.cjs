const crypto = require('crypto');

const ASSIGNMENT_STATUSES = new Set([
  'PENDING_ADMIN_ASSIGNMENT',
  'PENDING_AGENT_ACCEPTANCE',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'REASSIGNED',
  'REQUEST_FAILED',
]);
const CALLBACK_STATUSES = new Set(['ACCEPTED', 'REJECTED', 'EXPIRED', 'REASSIGNED', 'ASSIGNED_FOR_ACCEPTANCE']);
const CALLBACK_PROVIDER = 'agent_pd_backoffice';
const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 300;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class AssignmentError extends Error {
  constructor(message, code, statusCode = 400, details = {}) {
    super(message);
    this.name = 'AssignmentError';
    this.code = code;
    this.statusCode = statusCode;
    Object.assign(this, details);
  }
}

function isUuid(value) {
  return UUID_PATTERN.test(String(value || ''));
}

function normalizePhone(value, fieldName = 'phone') {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  if (/^66[0-9]{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^0[0-9]{9}$/.test(digits)) return digits;
  throw new AssignmentError(`${fieldName} must be a valid Thai mobile number`, 'INVALID_PHONE');
}

function validateInput({ storeId, sourceRequestId, agentPhone }) {
  if (!isUuid(storeId)) throw new AssignmentError('storeId must be a UUID', 'INVALID_STORE_ID');
  const normalizedSourceRequestId = String(sourceRequestId || '').trim();
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(normalizedSourceRequestId)) {
    throw new AssignmentError('sourceRequestId must contain 8-128 URL-safe characters', 'INVALID_SOURCE_REQUEST_ID');
  }
  return {
    storeId,
    sourceRequestId: normalizedSourceRequestId,
    agentPhone: agentPhone ? normalizePhone(agentPhone, 'agentPhone') : null,
  };
}

function buildIdempotencyKey(storeId, sourceRequestId) {
  return `assignment:${storeId}:${sourceRequestId}`;
}

function initialStatus(agentPhone) {
  return agentPhone ? 'PENDING_AGENT_ACCEPTANCE' : 'PENDING_ADMIN_ASSIGNMENT';
}

function responseData(response) {
  if (!response || !response.data) return {};
  return response.data.data && typeof response.data.data === 'object' ? response.data.data : response.data;
}

function publicAssignment(row, idempotentReplay = false) {
  if (!row) return null;
  const confirmed = row.status === 'ACCEPTED';
  return {
    id: row.id,
    assignmentRequestId: row.assignmentRequestId || null,
    storeId: row.storeId,
    sourceRequestId: row.sourceRequestId,
    status: row.status,
    requestedAt: row.createdAt,
    expiresAt: row.expiresAt || null,
    idempotentReplay,
    agent: confirmed && row.agentId ? { id: row.agentId } : null,
    pd: confirmed && row.pdId ? { id: row.pdId } : null,
  };
}

async function withTransaction(pool, callback) {
  const client = await pool.connect();
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
}

async function createAssignmentRequest({ pool, backofficeClient, storeId, sourceRequestId, agentPhone, requestId }) {
  const input = validateInput({ storeId, sourceRequestId, agentPhone });
  const idempotencyKey = buildIdempotencyKey(input.storeId, input.sourceRequestId);
  const pendingStatus = initialStatus(input.agentPhone);
  let localAssignment;

  const prepared = await withTransaction(pool, async (client) => {
    const storeResult = await client.query('SELECT id FROM "Store" WHERE id = $1 FOR SHARE', [input.storeId]);
    if (storeResult.rowCount === 0) {
      throw new AssignmentError('Store was not found', 'STORE_NOT_FOUND', 404);
    }

    const existingResult = await client.query(
      'SELECT * FROM agent_assignments WHERE "storeId" = $1 AND "sourceRequestId" = $2 FOR UPDATE',
      [input.storeId, input.sourceRequestId]
    );
    if (existingResult.rowCount > 0) {
      const existing = existingResult.rows[0];
      if (existing.status !== 'REQUEST_FAILED') return { assignment: existing, replay: true };
      await client.query(
        `UPDATE agent_assignments
         SET status = $1, reason = NULL, "agentPhone" = $2, "updatedAt" = NOW()
         WHERE id = $3`,
        [pendingStatus, input.agentPhone, existing.id]
      );
      localAssignment = { ...existing, status: pendingStatus, agentPhone: input.agentPhone };
      return { assignment: localAssignment, replay: false };
    }

    const insertResult = await client.query(
      `INSERT INTO agent_assignments
        ("storeId", "sourceRequestId", "idempotencyKey", status, "agentPhone", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [input.storeId, input.sourceRequestId, idempotencyKey, pendingStatus, input.agentPhone]
    );
    const assignment = insertResult.rows[0];
    await client.query(
      `INSERT INTO audit_logs
        ("actorId", "actorRole", action, "targetType", "targetId", reason, "afterJson", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())`,
      [
        'system',
        'system',
        'ASSIGNMENT_REQUEST_CREATED',
        'agent_assignment',
        assignment.id,
        input.agentPhone ? 'Merchant supplied agentPhone' : 'Merchant requested Admin assignment',
        JSON.stringify({ status: pendingStatus, storeId: input.storeId, sourceRequestId: input.sourceRequestId }),
      ]
    );
    return { assignment, replay: false };
  });

  if (prepared.replay) {
    return { statusCode: 200, data: publicAssignment(prepared.assignment, true) };
  }

  const payload = { sourceRequestId: input.sourceRequestId };
  if (input.agentPhone) payload.agentPhone = input.agentPhone;

  try {
    const response = await backofficeClient.request('/api/v1/assignments/requests', {
      method: 'POST',
      body: payload,
      idempotencyKey,
      requestId,
      sourceRequestId: input.sourceRequestId,
    });
    if (!response.ok) {
      throw new AssignmentError('Backoffice rejected assignment request', 'BACKOFFICE_REQUEST_FAILED', 502, {
        upstreamStatus: response.status,
      });
    }

    const data = responseData(response);
    const upstreamStatus = ASSIGNMENT_STATUSES.has(String(data.status || '').toUpperCase())
      ? String(data.status).toUpperCase()
      : pendingStatus;
    const assignmentRequestId = data.id || data.assignmentRequestId || null;
    const updated = await withTransaction(pool, async (client) => {
      const updateResult = await client.query(
        `UPDATE agent_assignments
         SET "assignmentRequestId" = $1, status = $2, "updatedAt" = NOW()
         WHERE id = $3
         RETURNING *`,
        [assignmentRequestId, upstreamStatus, prepared.assignment.id]
      );
      if (updateResult.rowCount === 0) throw new AssignmentError('Local assignment row disappeared', 'ASSIGNMENT_NOT_FOUND', 500);
      await client.query(
        `INSERT INTO audit_logs
          ("actorId", "actorRole", action, "targetType", "targetId", "requestId", "afterJson", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())`,
        [
          'system',
          'system',
          'ASSIGNMENT_REQUEST_FORWARDED',
          'agent_assignment',
          prepared.assignment.id,
          requestId || null,
          JSON.stringify({ status: upstreamStatus, assignmentRequestId }),
        ]
      );
      return updateResult.rows[0];
    });

    return { statusCode: response.status === 200 ? 200 : 201, data: publicAssignment(updated, false) };
  } catch (error) {
    await withTransaction(pool, async (client) => {
      await client.query(
        `UPDATE agent_assignments
         SET status = 'REQUEST_FAILED', reason = $1, "updatedAt" = NOW()
         WHERE id = $2`,
        [error.code || error.message || 'BACKOFFICE_REQUEST_FAILED', prepared.assignment.id]
      );
      await client.query(
        `INSERT INTO audit_logs
          ("actorId", "actorRole", action, "targetType", "targetId", reason, "requestId", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        ['system', 'system', 'ASSIGNMENT_REQUEST_FAILED', 'agent_assignment', prepared.assignment.id, error.code || error.message, requestId || null]
      );
    }).catch(() => {});
    throw error;
  }
}

function getHeader(headers, name) {
  const value = headers?.[name.toLowerCase()] ?? headers?.[name];
  return Array.isArray(value) ? value[0] : String(value || '');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyAssignmentCallback({ rawBody, headers, callbackSecret, nowSeconds = Math.floor(Date.now() / 1000), timestampToleranceSeconds = DEFAULT_TIMESTAMP_TOLERANCE_SECONDS }) {
  if (!callbackSecret) throw new AssignmentError('Assignment callback secret is not configured', 'CALLBACK_SECRET_MISSING', 503);
  const callbackSecrets = Array.isArray(callbackSecret) ? callbackSecret.filter(Boolean) : [callbackSecret];
  const eventId = getHeader(headers, 'x-chatpos-event-id');
  const timestamp = getHeader(headers, 'x-chatpos-timestamp');
  const signature = getHeader(headers, 'x-chatpos-signature');
  if (!eventId) throw new AssignmentError('X-ChatPOS-Event-Id is required', 'EVENT_ID_REQUIRED');
  if (!/^\d{10}$/.test(timestamp) || Math.abs(nowSeconds - Number(timestamp)) > timestampToleranceSeconds) {
    throw new AssignmentError('Callback timestamp is outside the allowed clock skew', 'STALE_TIMESTAMP', 401);
  }
  if (!/^v1=[a-f0-9]{64}$/.test(signature)) {
    throw new AssignmentError('Callback signature is invalid', 'INVALID_SIGNATURE', 401);
  }
  const valid = callbackSecrets.some((secret) => {
    const expected = `v1=${crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex')}`;
    return safeEqual(signature, expected);
  });
  if (!valid) throw new AssignmentError('Callback signature is invalid', 'INVALID_SIGNATURE', 401);
  return { eventId, timestamp: Number(timestamp) };
}

function normalizeCallbackStatus(status) {
  const normalized = String(status || '').toUpperCase();
  if (!CALLBACK_STATUSES.has(normalized)) {
    throw new AssignmentError('Unsupported assignment callback status', 'INVALID_ASSIGNMENT_STATUS');
  }
  return normalized === 'ASSIGNED_FOR_ACCEPTANCE' ? 'PENDING_AGENT_ACCEPTANCE' : normalized;
}

async function resolveTarget(client, body, assignment = null) {
  const agentReference = body.agentId || body.agentCode || body.agent?.id || body.agent?.code;
  const pdReference = body.pdId || body.pdCode || body.pd?.id || body.pd?.code;
  let agent = null;
  let pd = null;

  if (agentReference) {
    agent = (isUuid(agentReference)
      ? await client.query('SELECT id, "currentPdId" FROM "Agent" WHERE id = $1 AND status = \'active\'', [agentReference])
      : await client.query('SELECT id, "currentPdId" FROM "Agent" WHERE code = $1 AND status = \'active\'', [String(agentReference)])).rows[0] || null;
  }
  if (!agent && assignment?.agentId) {
    const agentResult = await client.query('SELECT id, "currentPdId" FROM "Agent" WHERE id = $1 AND status = \'active\'', [assignment.agentId]);
    agent = agentResult.rows[0] || null;
  }
  if (!agent && assignment?.agentPhone) {
    const agentResult = await client.query(
      `SELECT a.id, a."currentPdId"
       FROM "Agent" a
       INNER JOIN "User" u ON u.id = a."userId"
       WHERE u.phone = $1 AND a.status = 'active'
       LIMIT 1`,
      [assignment.agentPhone]
    );
    agent = agentResult.rows[0] || null;
  }
  if (pdReference) {
    pd = (isUuid(pdReference)
      ? await client.query('SELECT id FROM "ProvincialDirector" WHERE id = $1 AND status = \'active\'', [pdReference])
      : await client.query('SELECT id FROM "ProvincialDirector" WHERE code = $1 AND status = \'active\'', [String(pdReference)])).rows[0] || null;
  }
  if (!pd && agent?.currentPdId) {
    const pdResult = await client.query('SELECT id FROM "ProvincialDirector" WHERE id = $1 AND status = \'active\'', [agent.currentPdId]);
    pd = pdResult.rows[0] || null;
  }
  return { agentId: agent?.id || null, pdId: pd?.id || null };
}

async function processAssignmentCallback({ pool, rawBody, headers, callbackSecret, nowSeconds = Math.floor(Date.now() / 1000) }) {
  const verified = verifyAssignmentCallback({ rawBody, headers, callbackSecret, nowSeconds });
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new AssignmentError('Callback body must be valid JSON', 'INVALID_JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AssignmentError('Callback body must be an object', 'INVALID_BODY');
  }
  if (body.eventId !== verified.eventId) {
    throw new AssignmentError('Callback event ID header does not match body', 'EVENT_ID_MISMATCH');
  }
  if (!isUuid(body.storeId)) throw new AssignmentError('Callback storeId must be a UUID', 'INVALID_STORE_ID');
  if (!String(body.assignmentRequestId || '').trim()) {
    throw new AssignmentError('assignmentRequestId is required', 'ASSIGNMENT_REQUEST_ID_REQUIRED');
  }
  const status = normalizeCallbackStatus(body.status);
  const bodyDigest = crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex');
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date(nowSeconds * 1000);
  if (Number.isNaN(occurredAt.getTime())) throw new AssignmentError('occurredAt must be a valid date', 'INVALID_OCCURRED_AT');

  return withTransaction(pool, async (client) => {
    const existingEvent = await client.query(
      'SELECT "bodyDigest", status FROM integration_webhook_events WHERE provider = $1 AND "eventId" = $2 FOR UPDATE',
      [CALLBACK_PROVIDER, verified.eventId]
    );
    if (existingEvent.rowCount > 0) {
      if (existingEvent.rows[0].bodyDigest !== bodyDigest) {
        throw new AssignmentError('Event ID was used with a different payload', 'EVENT_PAYLOAD_CONFLICT', 409);
      }
      return { statusCode: 200, duplicate: true, status: existingEvent.rows[0].status };
    }

    const assignmentResult = await client.query(
      `SELECT * FROM agent_assignments
       WHERE "assignmentRequestId" = $1 AND "storeId" = $2
       FOR UPDATE`,
      [String(body.assignmentRequestId), body.storeId]
    );
    if (assignmentResult.rowCount === 0) {
      throw new AssignmentError('Assignment request was not found for callback', 'ASSIGNMENT_NOT_FOUND', 404);
    }
    const assignment = assignmentResult.rows[0];
    const previousOccurredAt = assignment.lastEventOccurredAt ? new Date(assignment.lastEventOccurredAt) : null;
    const isLate = previousOccurredAt && occurredAt.getTime() <= previousOccurredAt.getTime();

    await client.query(
      `INSERT INTO integration_webhook_events
        (provider, "eventId", "eventType", "bodyDigest", status, "payloadJson", "receivedAt", "processedAt")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())`,
      [CALLBACK_PROVIDER, verified.eventId, body.eventType || 'assignment.status.changed', bodyDigest, isLate ? 'IGNORED_LATE' : 'RECEIVED', JSON.stringify(body)]
    );
    await client.query(
      `INSERT INTO agent_assignment_events
        ("assignmentId", "eventId", "eventType", status, "payloadJson", "requestId", "createdAt")
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())`,
      [assignment.id, verified.eventId, body.eventType || 'assignment.status.changed', isLate ? 'IGNORED_LATE' : status, JSON.stringify(body), verified.eventId]
    );

    if (isLate) {
      await client.query(
        `UPDATE integration_webhook_events SET status = 'IGNORED_LATE', "processedAt" = NOW()
         WHERE provider = $1 AND "eventId" = $2`,
        [CALLBACK_PROVIDER, verified.eventId]
      );
      return { statusCode: 200, duplicate: false, late: true, data: publicAssignment(assignment, false) };
    }

    const target = await resolveTarget(client, body, assignment);
    if (status === 'ACCEPTED' && (!target.agentId || !target.pdId)) {
      throw new AssignmentError('ACCEPTED callback must identify an active Agent and PD', 'ASSIGNMENT_TARGET_REQUIRED', 422);
    }
    const reason = body.reason ? String(body.reason).slice(0, 1000) : null;
    const before = {
      status: assignment.status,
      agentId: assignment.agentId,
      pdId: assignment.pdId,
    };
    const updateResult = await client.query(
      `UPDATE agent_assignments
       SET status = $1,
           "agentId" = $2,
           "pdId" = $3,
           reason = $4,
           "assignedAt" = CASE WHEN $1 IN ('PENDING_AGENT_ACCEPTANCE', 'ACCEPTED') THEN COALESCE("assignedAt", NOW()) ELSE "assignedAt" END,
           "acceptedAt" = CASE WHEN $1 = 'ACCEPTED' THEN NOW() ELSE "acceptedAt" END,
           "rejectedAt" = CASE WHEN $1 = 'REJECTED' THEN NOW() ELSE "rejectedAt" END,
           "expiresAt" = CASE WHEN $1 = 'EXPIRED' THEN NOW() ELSE "expiresAt" END,
           "lastEventOccurredAt" = $5,
           "lastEventId" = $6,
           "updatedAt" = NOW()
       WHERE id = $7
       RETURNING *`,
      [status, target.agentId, target.pdId, reason, occurredAt.toISOString(), verified.eventId, assignment.id]
    );
    const updated = updateResult.rows[0];

    if (status === 'ACCEPTED') {
      await client.query(
        `UPDATE "Store"
         SET "currentAgentId" = $1, "currentPdId" = $2, "updatedAt" = NOW()
         WHERE id = $3`,
        [target.agentId, target.pdId, assignment.storeId]
      );
    } else if (status === 'REASSIGNED' || status === 'REJECTED' || status === 'EXPIRED') {
      await client.query(
        `UPDATE "Store"
         SET "currentAgentId" = NULL, "currentPdId" = NULL, "updatedAt" = NOW()
         WHERE id = $1 AND ("currentAgentId" = $2 OR "currentPdId" = $3)`,
        [assignment.storeId, assignment.agentId, assignment.pdId]
      );
    }

    await client.query(
      `UPDATE integration_webhook_events SET status = 'PROCESSED', "processedAt" = NOW()
       WHERE provider = $1 AND "eventId" = $2`,
      [CALLBACK_PROVIDER, verified.eventId]
    );
    await client.query(
      `INSERT INTO audit_logs
        ("actorId", "actorRole", action, "targetType", "targetId", reason, "beforeJson", "afterJson", "requestId", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, NOW())`,
      [
        'backoffice',
        'backoffice',
        'ASSIGNMENT_STATUS_CHANGED',
        'agent_assignment',
        assignment.id,
        reason,
        JSON.stringify(before),
        JSON.stringify({ status: updated.status, agentId: updated.agentId, pdId: updated.pdId, eventId: verified.eventId }),
        verified.eventId,
      ]
    );

    return { statusCode: 200, duplicate: false, late: false, data: publicAssignment(updated, false) };
  });
}

module.exports = {
  ASSIGNMENT_STATUSES,
  AssignmentError,
  buildIdempotencyKey,
  createAssignmentRequest,
  normalizePhone,
  processAssignmentCallback,
  publicAssignment,
  verifyAssignmentCallback,
};

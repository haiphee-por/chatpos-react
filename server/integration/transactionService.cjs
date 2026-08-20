const crypto = require('crypto');

const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 300;
const PAYMENT_STATUS_MAP = new Map([
  ['pending', 'pending'],
  ['created', 'pending'],
  ['processing', 'pending'],
  ['authorized', 'pending'],
  ['success', 'completed'],
  ['successful', 'completed'],
  ['paid', 'completed'],
  ['completed', 'completed'],
  ['failed', 'failed'],
  ['declined', 'failed'],
  ['cancelled', 'failed'],
  ['canceled', 'failed'],
  ['expired', 'expired'],
  ['refunded', 'refunded'],
  ['chargeback', 'chargeback'],
  ['stoppay', 'stoppay'],
]);

class TransactionRoutingError extends Error {
  constructor(message, code, statusCode = 400, details = {}) {
    super(message);
    this.name = 'TransactionRoutingError';
    this.code = code;
    this.statusCode = statusCode;
    Object.assign(this, details);
  }
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

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function header(headers, name) {
  const value = headers && (headers[name] || headers[name.toLowerCase()]);
  return Array.isArray(value) ? value[0] : value;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function normalizeAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    throw new TransactionRoutingError('amount must be greater than zero', 'INVALID_AMOUNT');
  }
  return Number(amount.toFixed(2));
}

function normalizeCommand({ storeId, body, idempotencyKey }) {
  if (!isUuid(storeId)) throw new TransactionRoutingError('storeId must be a UUID', 'INVALID_STORE_ID');
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(String(idempotencyKey || ''))) {
    throw new TransactionRoutingError('Idempotency-Key must contain 8-128 URL-safe characters', 'INVALID_IDEMPOTENCY_KEY');
  }
  const amount = normalizeAmount(body.amount);
  const channel = String(body.channel || 'promptpay').trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,32}$/.test(channel)) {
    throw new TransactionRoutingError('channel is invalid', 'INVALID_CHANNEL');
  }
  const clientReference = body.clientReference ? String(body.clientReference).trim() : null;
  if (clientReference && !/^[A-Za-z0-9:_-]{8,128}$/.test(clientReference)) {
    throw new TransactionRoutingError('clientReference must contain 8-128 URL-safe characters', 'INVALID_CLIENT_REFERENCE');
  }
  return {
    storeId,
    amount,
    channel,
    currency: String(body.currency || 'THB').trim().toUpperCase(),
    clientReference,
    orderId: body.orderId ? String(body.orderId).slice(0, 128) : null,
    customerName: String(body.customerName || 'ลูกค้าหน้าร้าน').slice(0, 255),
    customerPhone: body.customerPhone ? String(body.customerPhone).slice(0, 64) : null,
    tableName: String(body.tableName || 'คิดเงินหน้าร้าน').slice(0, 255),
    note: String(body.note || 'ชำระเงินผ่าน Transaction Routing').slice(0, 1000),
    metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {},
    idempotencyKey: String(idempotencyKey),
  };
}

function commandBody(input, clientReference) {
  return {
    schemaVersion: 'transaction.command.v1',
    storeId: input.storeId,
    clientReference,
    orderId: input.orderId,
    amount: input.amount.toFixed(2),
    currency: input.currency,
    channel: input.channel,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    tableName: input.tableName,
    note: input.note,
    metadata: input.metadata,
  };
}

function responseData(response) {
  if (!response || !response.data) return {};
  return response.data.data && typeof response.data.data === 'object' ? response.data.data : response.data;
}

function shouldApplyPaymentStatus(currentStatus, nextStatus) {
  if (currentStatus === 'completed' && ['pending', 'failed', 'expired'].includes(nextStatus)) return false;
  if (['refunded', 'chargeback', 'stoppay'].includes(currentStatus) && nextStatus !== currentStatus) return false;
  return true;
}

function publicTransaction(row, extra = {}) {
  if (!row) return null;
  const metadata = row.paymentMetadataJson || {};
  return {
    id: row.id,
    storeId: row.storeId,
    reference: row.reference,
    clientReference: row.clientReference || row.reference,
    paymentReference: row.backofficePaymentReference || null,
    gatewayReference: row.gatewayReference || null,
    amount: Number(row.amount),
    currency: row.currency || 'THB',
    channel: row.channel,
    status: row.status,
    qrCodeUrl: metadata.qrCodeUrl || null,
    qrRawText: metadata.qrRawText || null,
    expiresAt: metadata.expiresAt || null,
    paidAt: row.paidAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...extra,
  };
}

async function createTransactionCommand({ pool, backofficeClient, storeId, body, idempotencyKey, requestId }) {
  const input = normalizeCommand({ storeId, body, idempotencyKey });
  const requestPayload = commandBody(input, input.clientReference || 'generated-once');
  const requestDigest = sha256Hex(JSON.stringify(requestPayload));
  let local;

  local = await withTransaction(pool, async (client) => {
    const storeResult = await client.query('SELECT id FROM "Store" WHERE id = $1 FOR SHARE', [input.storeId]);
    if (storeResult.rowCount === 0) throw new TransactionRoutingError('Store was not found', 'STORE_NOT_FOUND', 404);

    const existingResult = await client.query(
      'SELECT * FROM "Transaction" WHERE "storeId" = $1 AND "idempotencyKey" = $2 FOR UPDATE',
      [input.storeId, input.idempotencyKey]
    );
    if (existingResult.rowCount > 0) {
      const existing = existingResult.rows[0];
      const metadata = existing.paymentMetadataJson || {};
      if (metadata.commandBodyDigest && metadata.commandBodyDigest !== requestDigest) {
        throw new TransactionRoutingError('Idempotency key was used with a different payload', 'IDEMPOTENCY_CONFLICT', 409);
      }
      return { row: existing, replay: true, command: commandBody(input, existing.clientReference || existing.reference) };
    }

    const clientReference = input.clientReference || `CP-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const command = commandBody(input, clientReference);
    const metadata = { commandBodyDigest: requestDigest, commandStatus: 'PENDING' };
    const insertResult = await client.query(
      `INSERT INTO "Transaction"
        (reference, "clientReference", "idempotencyKey", amount, fee, "netAmount", channel, status,
         "storeId", currency, "kitchenStatus", origin, "paymentMethod", "paymentMethodLabel",
         "customerName", "customerPhone", "tableName", note, "paymentMetadataJson", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 0, $4, $5, 'pending', $6, $7, 'NONE', 'TRANSACTION_ROUTING',
               'Backoffice Transaction', 'Backoffice Transaction', $8, $9, $10, $11, $12::jsonb, NOW(), NOW())
       RETURNING *`,
      [clientReference, clientReference, input.idempotencyKey, input.amount, input.channel, input.storeId,
        input.currency, input.customerName, input.customerPhone, input.tableName, input.note, JSON.stringify(metadata)]
    );
    return { row: insertResult.rows[0], replay: false, command };
  });

  const command = local.command;
  let response;
  try {
    response = await backofficeClient.request(backofficeClient.config.transactionCommandPath || '/api/v1/transactions', {
      method: 'POST',
      body: command,
      storeId: input.storeId,
      idempotencyKey: input.idempotencyKey,
      requestId,
      sourceRequestId: input.clientReference || local.row.reference,
    });
  } catch (error) {
    await pool.query(
      `UPDATE "Transaction"
       SET "paymentMetadataJson" = jsonb_set(COALESCE("paymentMetadataJson", '{}'::jsonb), '{commandError}', $1::jsonb), "updatedAt" = NOW()
       WHERE id = $2`,
      [JSON.stringify({ code: error.code || 'BACKOFFICE_REQUEST_FAILED', message: error.message }), local.row.id]
    );
    throw error;
  }

  const data = responseData(response);
  if (!response.ok) {
    const code = data?.error?.code || data?.code || 'BACKOFFICE_TRANSACTION_REJECTED';
    await pool.query(
      `UPDATE "Transaction" SET status = CASE WHEN $1 < 500 THEN 'failed' ELSE status END,
       "paymentMetadataJson" = jsonb_set(COALESCE("paymentMetadataJson", '{}'::jsonb), '{commandError}', $2::jsonb), "updatedAt" = NOW()
       WHERE id = $3`,
      [response.status, JSON.stringify({ code, upstreamStatus: response.status }), local.row.id]
    );
    throw new TransactionRoutingError('Backoffice rejected the transaction command', code, response.status >= 500 ? 502 : response.status);
  }

  const payment = data.payment && typeof data.payment === 'object' ? data.payment : data;
  const paymentReference = payment.paymentReference || payment.reference || payment.id || null;
  const gatewayReference = payment.gatewayReference || payment.gatewayPaymentReference || null;
  const status = PAYMENT_STATUS_MAP.get(String(payment.status || 'pending').toLowerCase()) || 'pending';
  const metadata = {
    ...(local.row.paymentMetadataJson || {}),
    commandStatus: 'ACCEPTED',
    qrCodeUrl: payment.qrCodeUrl || payment.qrUrl || null,
    qrRawText: payment.qrRawText || payment.qrPayload || null,
    expiresAt: payment.expiresAt || null,
    upstream: payment,
  };
  const updateResult = await pool.query(
    `UPDATE "Transaction"
     SET "backofficePaymentReference" = COALESCE($1, "backofficePaymentReference"),
         "gatewayReference" = COALESCE($2, "gatewayReference"),
         status = $3, "paymentMetadataJson" = $4::jsonb, "updatedAt" = NOW()
     WHERE id = $5 RETURNING *`,
    [paymentReference, gatewayReference, status, JSON.stringify(metadata), local.row.id]
  );
  return { transaction: publicTransaction(updateResult.rows[0]), idempotentReplay: local.replay };
}

async function getTransaction({ pool, reference }) {
  const result = await pool.query(
    `SELECT * FROM "Transaction"
     WHERE reference = $1 OR "clientReference" = $1 OR "backofficePaymentReference" = $1 OR "gatewayReference" = $1 OR id::text = $1
     LIMIT 1`,
    [String(reference)]
  );
  if (result.rowCount === 0) throw new TransactionRoutingError('Transaction reference not found', 'TRANSACTION_NOT_FOUND', 404);
  return publicTransaction(result.rows[0]);
}

function transactionQueryPath(template, reference) {
  const path = String(template || '/api/v1/transactions/{id}/payment');
  if (!path.includes('{id}')) {
    throw new TransactionRoutingError('Transaction query path must contain {id}', 'TRANSACTION_QUERY_PATH_INVALID', 500);
  }
  return path.replaceAll('{id}', encodeURIComponent(String(reference)));
}

function normalizedPaymentStatus(value) {
  const normalized = String(value || '').toLowerCase();
  return PAYMENT_STATUS_MAP.get(normalized) || normalized || 'pending';
}

function normalizePaymentQueryResponse(response, reference) {
  const data = responseData(response);
  const amount = Number(data.amount);
  return {
    id: data.id || null,
    storeId: data.storeId || null,
    reference: data.reference || data.clientReference || data.transactionReference || String(reference),
    clientReference: data.clientReference || data.transactionReference || String(reference),
    paymentReference: data.paymentReference || data.gatewayReference || null,
    gatewayReference: data.gatewayReference || null,
    amount: Number.isFinite(amount) ? amount : null,
    currency: data.currency || 'THB',
    channel: data.channel || data.paymentMethod || null,
    paymentMethod: data.paymentMethod || data.channel || null,
    paymentProvider: data.paymentProvider || data.provider || null,
    providerStatus: data.providerStatus || data.status || null,
    status: normalizedPaymentStatus(data.status || data.paymentStatus || data.providerStatus),
    paidAt: data.paidAt || null,
    failedAt: data.failedAt || null,
    expiresAt: data.expiresAt || null,
  };
}

async function getTransactionStatus({ backofficeClient, storeId, reference, requestId }) {
  const normalizedReference = String(reference || '').trim();
  if (!normalizedReference || normalizedReference.length > 128) {
    throw new TransactionRoutingError('Transaction reference is invalid', 'TRANSACTION_REFERENCE_INVALID', 422);
  }
  if (!backofficeClient?.config?.transactionQueryPath) {
    throw new TransactionRoutingError('Transaction query path is not configured', 'TRANSACTION_QUERY_PATH_MISSING', 503);
  }
  const response = await backofficeClient.request(transactionQueryPath(backofficeClient.config.transactionQueryPath, normalizedReference), {
    method: 'GET',
    storeId,
    requestId,
    sourceRequestId: normalizedReference,
  });
  if (!response.ok) {
    const data = responseData(response);
    const code = data?.error?.code || data?.code || 'BACKOFFICE_TRANSACTION_QUERY_FAILED';
    throw new TransactionRoutingError('Backoffice rejected the transaction query', code, response.status >= 500 ? 502 : response.status);
  }
  return normalizePaymentQueryResponse(response, normalizedReference);
}

function verifyLlgwWebhook({ rawBody, headers, secret, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = DEFAULT_TIMESTAMP_TOLERANCE_SECONDS }) {
  if (!secret) throw new TransactionRoutingError('LLGW webhook secret is not configured', 'WEBHOOK_SECRET_MISSING', 503);
  const secrets = Array.isArray(secret) ? secret.filter(Boolean) : [secret];
  const timestamp = String(header(headers, 'x-llgw-timestamp') || '');
  const signature = String(header(headers, 'x-llgw-signature') || '').replace(/^v1=/, '');
  const eventId = String(header(headers, 'x-llgw-event-id') || '');
  const timestampNumber = Number(timestamp);
  if (!/^\d+$/.test(timestamp) || !Number.isInteger(timestampNumber) || Math.abs(nowSeconds - timestampNumber) > toleranceSeconds) {
    throw new TransactionRoutingError('LLGW webhook timestamp is invalid or stale', 'STALE_WEBHOOK', 401);
  }
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(eventId)) throw new TransactionRoutingError('LLGW event ID is required', 'EVENT_ID_REQUIRED', 401);
  const valid = secrets.some((candidate) => {
    const expected = crypto.createHmac('sha256', candidate).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
    return safeEqual(signature, expected);
  });
  if (!valid) throw new TransactionRoutingError('LLGW webhook signature is invalid', 'INVALID_WEBHOOK_SIGNATURE', 401);
  return { timestamp: timestampNumber, eventId, bodyDigest: sha256Hex(rawBody) };
}

function verifyPaymentStatusWebhook({ rawBody, headers, secret, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = DEFAULT_TIMESTAMP_TOLERANCE_SECONDS }) {
  if (!secret) throw new TransactionRoutingError('Payment status webhook secret is not configured', 'PAYMENT_STATUS_SECRET_MISSING', 503);
  const secrets = Array.isArray(secret) ? secret.filter(Boolean) : [secret];
  const eventId = String(header(headers, 'x-chatpos-event-id') || '');
  const timestamp = String(header(headers, 'x-chatpos-timestamp') || '');
  const signature = String(header(headers, 'x-chatpos-signature') || '');
  const timestampNumber = Number(timestamp);
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(eventId)) {
    throw new TransactionRoutingError('X-ChatPOS-Event-Id is required', 'EVENT_ID_REQUIRED', 401);
  }
  if (!/^\d{10}$/.test(timestamp) || Math.abs(nowSeconds - timestampNumber) > toleranceSeconds) {
    throw new TransactionRoutingError('Payment status webhook timestamp is invalid or stale', 'STALE_WEBHOOK', 401);
  }
  if (!/^v1=[a-f0-9]{64}$/.test(signature)) {
    throw new TransactionRoutingError('Payment status webhook signature is invalid', 'INVALID_WEBHOOK_SIGNATURE', 401);
  }
  const valid = secrets.some((candidate) => {
    const expected = `v1=${crypto.createHmac('sha256', candidate).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex')}`;
    return safeEqual(signature, expected);
  });
  if (!valid) throw new TransactionRoutingError('Payment status webhook signature is invalid', 'INVALID_WEBHOOK_SIGNATURE', 401);
  return { timestamp: timestampNumber, eventId, bodyDigest: sha256Hex(rawBody) };
}

function normalizeWebhookBody(body, eventId) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TransactionRoutingError('Webhook body must be an object', 'INVALID_WEBHOOK_BODY');
  if (body.eventId && String(body.eventId) !== eventId) throw new TransactionRoutingError('Webhook event ID header does not match body', 'EVENT_ID_MISMATCH', 400);
  const clientReference = body.clientReference || body.transactionReference || body.merchantReference || null;
  const paymentReference = body.paymentReference || body.reference || null;
  const transactionId = body.transactionId ? String(body.transactionId) : null;
  if (!clientReference && !paymentReference && !transactionId) throw new TransactionRoutingError('transaction reference is required', 'PAYMENT_REFERENCE_REQUIRED');
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) throw new TransactionRoutingError('occurredAt must be a valid date', 'INVALID_OCCURRED_AT');
  const status = PAYMENT_STATUS_MAP.get(String(body.status || body.paymentStatus || body.providerStatus || '').toLowerCase());
  if (!status) throw new TransactionRoutingError('Webhook payment status is invalid', 'INVALID_PAYMENT_STATUS');
  return {
    ...body,
    eventId,
    clientReference,
    paymentReference,
    transactionId,
    status,
    occurredAt,
    gatewayReference: body.gatewayReference || body.gatewayPaymentReference || null,
  };
}

async function processPaymentWebhook({ pool, rawBody, body, verified, commissionConfig = {}, provider = 'llgw' }) {
  const webhook = normalizeWebhookBody(body, verified.eventId);
  return withTransaction(pool, async (client) => {
    const duplicate = await client.query(
      'SELECT "bodyDigest", status FROM payment_webhook_events WHERE provider = $1 AND "eventId" = $2 FOR UPDATE',
      [provider, verified.eventId]
    );
    if (duplicate.rowCount > 0) {
      if (duplicate.rows[0].bodyDigest !== verified.bodyDigest) {
        throw new TransactionRoutingError('Event ID was used with a different payload', 'EVENT_PAYLOAD_CONFLICT', 409);
      }
      return { duplicate: true, status: duplicate.rows[0].status };
    }

    const txnResult = await client.query(
      `SELECT t.*, s."currentAgentId" AS "agentId", s."currentPdId" AS "pdId"
       FROM "Transaction" t
       LEFT JOIN "Store" s ON s.id = t."storeId"
       WHERE (
         ($3::text IS NOT NULL AND t.id::text = $3)
         OR t."clientReference" = $1
         OR t."backofficePaymentReference" = $2
         OR t.reference = $1
         OR t."gatewayReference" = $2
       )
       AND ($4::text IS NULL OR t."storeId"::text = $4)
      LIMIT 1 FOR UPDATE OF t`,
      [webhook.clientReference, webhook.paymentReference, webhook.transactionId, body.storeId ? String(body.storeId) : null]
    );
    if (txnResult.rowCount === 0) throw new TransactionRoutingError('Transaction reference not found', 'TRANSACTION_NOT_FOUND', 404);
    const txn = txnResult.rows[0];
    await client.query(
      `INSERT INTO payment_webhook_events
        (provider, "eventId", "bodyDigest", "transactionId", status, "occurredAt", "payloadJson", "receivedAt")
       VALUES ($1, $2, $3, $4, 'RECEIVED', $5, $6::jsonb, NOW())`,
      [provider, verified.eventId, verified.bodyDigest, txn.id, webhook.occurredAt.toISOString(), JSON.stringify(body)]
    );

    if (body.storeId && String(body.storeId) !== String(txn.storeId)) {
      throw new TransactionRoutingError('Payment status Store does not match transaction Store', 'STORE_REFERENCE_MISMATCH', 400);
    }

    const previousOccurredAt = txn.lastPaymentOccurredAt ? new Date(txn.lastPaymentOccurredAt) : null;
    if (previousOccurredAt && webhook.occurredAt.getTime() <= previousOccurredAt.getTime()) {
      await client.query(
        `UPDATE payment_webhook_events SET status = 'IGNORED_LATE', "processedAt" = NOW()
         WHERE provider = $1 AND "eventId" = $2`, [provider, verified.eventId]
      );
      return { duplicate: false, late: true, transaction: publicTransaction(txn) };
    }

    const shouldSettle = webhook.status === 'completed' && txn.status !== 'completed';
    const applyStatus = shouldApplyPaymentStatus(txn.status, webhook.status);
    const nextMetadata = { ...(txn.paymentMetadataJson || {}), lastWebhook: body };
    if (!applyStatus) {
      await client.query(
        `UPDATE payment_webhook_events SET status = 'IGNORED_INVALID_TRANSITION', "processedAt" = NOW()
         WHERE provider = $1 AND "eventId" = $2`, [provider, verified.eventId]
      );
      return { duplicate: false, late: false, invalidTransition: true, transaction: publicTransaction(txn) };
    }
    const updateResult = await client.query(
      `UPDATE "Transaction"
       SET status = $1,
           "backofficePaymentReference" = COALESCE($2, "backofficePaymentReference"),
           "gatewayReference" = COALESCE($3, "gatewayReference"),
           "lastPaymentOccurredAt" = $4,
           "lastPaymentEventId" = $5,
           "paidAt" = CASE WHEN $1 = 'completed' THEN COALESCE("paidAt", $4) ELSE "paidAt" END,
           "paymentMetadataJson" = $6::jsonb,
           "updatedAt" = NOW()
       WHERE id = $7 RETURNING *`,
      [webhook.status, webhook.paymentReference, webhook.gatewayReference || null, webhook.occurredAt.toISOString(), verified.eventId, JSON.stringify(nextMetadata), txn.id]
    );

    let settlementEvent = null;
    if (shouldSettle && commissionConfig.enabled) {
      settlementEvent = await createSettlementEvent(client, updateResult.rows[0], webhook, commissionConfig);
    }
    await client.query(
      `UPDATE payment_webhook_events SET status = 'PROCESSED', "processedAt" = NOW()
       WHERE provider = $1 AND "eventId" = $2`, [provider, verified.eventId]
    );
    return { duplicate: false, late: false, transaction: publicTransaction(updateResult.rows[0]), settlementEvent };
  });
}

function mappedGrossBenefit(txn, config) {
  const field = config.grossBenefitField;
  if (!field) return null;
  const value = txn[field];
  return value === undefined || value === null ? null : Number(value).toFixed(2);
}

async function createSettlementEvent(client, txn, webhook, config) {
  const eventType = webhook.settlementEventType || 'SETTLEMENT_EARNED';
  const eventId = `settlement-${webhook.eventId}`;
  const grossBenefit = mappedGrossBenefit(txn, config);
  let status = grossBenefit === null ? 'BLOCKED_MAPPING' : 'PENDING';
  const payload = {
    schemaVersion: 'commission.settlement.v1',
    eventId,
    eventType,
    transactionId: txn.id,
    sourceRef: `settlement:${txn.clientReference || txn.reference}`,
    earnedAt: webhook.occurredAt.toISOString(),
    ownershipSnapshot: { storeId: txn.storeId, agentId: txn.agentId || null, pdId: txn.pdId || null },
    amounts: { pdGrossBenefit: grossBenefit },
  };
  if (eventType !== 'SETTLEMENT_EARNED') {
    const reversal = webhook.reversalReference;
    if (!reversal || !reversal.originalEventId || !reversal.reasonCode || !reversal.sourceReference) {
      status = 'BLOCKED_REVERSAL_CONFLICT';
    } else {
      const original = await client.query(
        `SELECT "eventId", status FROM commission_settlement_events WHERE "eventId" = $1 FOR UPDATE`,
        [reversal.originalEventId]
      );
      if (original.rowCount === 0 || original.rows[0].status === 'BLOCKED_REVERSAL_CONFLICT') {
        status = 'BLOCKED_REVERSAL_CONFLICT';
      }
      payload.reversalReference = reversal;
    }
  }
  const result = await client.query(
    `INSERT INTO commission_settlement_events
      ("eventId", "eventType", "transactionId", "sourceRef", "bodyDigest", "payloadJson", status)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     ON CONFLICT ("eventId") DO NOTHING RETURNING *`,
      [eventId, eventType, txn.id, payload.sourceRef, sha256Hex(JSON.stringify(payload)), JSON.stringify(payload), status]
  );
  if (result.rowCount > 0) return result.rows[0];
  const existing = await client.query('SELECT * FROM commission_settlement_events WHERE "eventId" = $1', [eventId]);
  return existing.rows[0];
}

async function dispatchSettlementEvent({ pool, eventId, config, fetchImpl = globalThis.fetch }) {
  if (!config.enabled) return { skipped: true, reason: 'COMMISSION_EVENT_INGEST_DISABLED' };
  const maxAttempts = Number(config.maxAttempts || process.env.SETTLEMENT_MAX_ATTEMPTS || 8);
  const existing = await pool.query('SELECT * FROM commission_settlement_events WHERE "eventId" = $1', [eventId]);
  if (existing.rowCount === 0) throw new TransactionRoutingError('Settlement event was not found', 'SETTLEMENT_NOT_FOUND', 404);
  if (existing.rows[0].status === 'SENT') return { sent: true, duplicate: true };
  if (['BLOCKED_MAPPING', 'BLOCKED_REVERSAL_CONFLICT'].includes(existing.rows[0].status)) {
    return { sent: false, blocked: true, reason: existing.rows[0].status };
  }
  if (!config.sourceUrl || !config.webhookSecret) {
    throw new TransactionRoutingError('Commission settlement endpoint is not configured', 'SETTLEMENT_CONFIG_MISSING', 503);
  }
  const result = await pool.query(
    `UPDATE commission_settlement_events
     SET "lockedAt" = NOW(), attempts = attempts + 1
     WHERE "eventId" = $1
       AND status IN ('PENDING', 'FAILED')
       AND "deadLetteredAt" IS NULL
       AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
       AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - INTERVAL '5 minutes')
     RETURNING *`,
    [eventId]
  );
  if (result.rowCount === 0) return { sent: false, inFlight: true };
  const event = result.rows[0];
  const rawBody = JSON.stringify(event.payloadJson);
  const signature = crypto.createHmac('sha256', config.webhookSecret).update(rawBody, 'utf8').digest('hex');
  try {
    const response = await fetchImpl(config.sourceUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Commission-Event-Id': event.eventId,
        'X-Commission-Signature': signature,
        'Idempotency-Key': event.eventId,
      },
      body: rawBody,
    });
    if (!response.ok) {
      throw new TransactionRoutingError('Backoffice rejected settlement event', `HTTP_${response.status}`, 502);
    }
    await pool.query('UPDATE commission_settlement_events SET status = \'SENT\', "sentAt" = NOW(), "lockedAt" = NULL WHERE id = $1', [event.id]);
    return { sent: true, duplicate: false, attempts: event.attempts };
  } catch (error) {
    const nextAttemptSeconds = Math.min(3600, 2 ** Math.min(event.attempts, 10) * 10);
    const deadLettered = event.attempts >= maxAttempts;
    await pool.query(
      `UPDATE commission_settlement_events
       SET status = $1,
           "lastErrorCode" = $2,
           "nextAttemptAt" = CASE WHEN $3 THEN NULL ELSE NOW() + ($4 * INTERVAL '1 second') END,
           "deadLetteredAt" = CASE WHEN $3 THEN NOW() ELSE NULL END,
           "lockedAt" = NULL
       WHERE id = $5`,
      [deadLettered ? 'DEAD_LETTERED' : 'FAILED', error.code || 'SETTLEMENT_SEND_FAILED', deadLettered, nextAttemptSeconds, event.id]
    );
    throw error;
  }
}

async function retryPendingSettlementEvents({ pool, config, limit = 20, fetchImpl = globalThis.fetch }) {
  if (!config.enabled) return { attempted: 0, sent: 0, failed: 0 };
  const pending = await pool.query(
    `SELECT "eventId"
     FROM commission_settlement_events
     WHERE status IN ('PENDING', 'FAILED')
       AND "deadLetteredAt" IS NULL
       AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
       AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - INTERVAL '5 minutes')
     ORDER BY "createdAt"
     LIMIT $1`,
    [limit]
  );
  let sent = 0;
  let failed = 0;
  for (const row of pending.rows) {
    try {
      const result = await dispatchSettlementEvent({ pool, eventId: row.eventId, config, fetchImpl });
      if (result.sent) sent += 1;
    } catch {
      failed += 1;
    }
  }
  return { attempted: pending.rowCount, sent, failed };
}

module.exports = {
  TransactionRoutingError,
  createTransactionCommand,
  getTransactionStatus,
  dispatchSettlementEvent,
  retryPendingSettlementEvents,
  getTransaction,
  processPaymentWebhook,
  sha256Hex,
  verifyPaymentStatusWebhook,
  verifyLlgwWebhook,
};

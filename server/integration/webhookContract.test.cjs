const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const {
  processAssignmentCallback,
  verifyAssignmentCallback,
} = require('./assignmentService.cjs');
const {
  processPaymentWebhook,
  verifyPaymentStatusWebhook,
} = require('./transactionService.cjs');

const secret = 'callback-secret';
const nowSeconds = 1700000000;

function signedHeaders({ rawBody, eventId, eventType, timestamp = String(nowSeconds) }) {
  return {
    'x-chatpos-event-id': eventId,
    'x-chatpos-event-type': eventType,
    'x-chatpos-timestamp': timestamp,
    'x-chatpos-signature': `v1=${crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex')}`,
  };
}

test('assignment callback verification requires its event type header', () => {
  const rawBody = '{}';
  const headers = signedHeaders({
    rawBody,
    eventId: 'assignment-event-1',
    eventType: 'assignment.status.changed',
  });
  delete headers['x-chatpos-event-type'];

  assert.throws(
    () => verifyAssignmentCallback({ rawBody, headers, callbackSecret: secret, nowSeconds }),
    (error) => error.code === 'EVENT_TYPE_REQUIRED'
  );
});

test('payment status verification returns and restricts its event type', () => {
  const rawBody = '{}';
  const validHeaders = signedHeaders({
    rawBody,
    eventId: 'payment-event-1',
    eventType: 'payment.status.changed',
  });
  const verified = verifyPaymentStatusWebhook({ rawBody, headers: validHeaders, secret, nowSeconds });
  assert.equal(verified.eventType, 'payment.status.changed');

  const unsupportedHeaders = signedHeaders({
    rawBody,
    eventId: 'payment-event-2',
    eventType: 'assignment.status.changed',
  });
  assert.throws(
    () => verifyPaymentStatusWebhook({ rawBody, headers: unsupportedHeaders, secret, nowSeconds }),
    (error) => error.code === 'UNSUPPORTED_EVENT_TYPE'
  );
});

test('assignment callback rejects a body event type that differs from its header', async () => {
  const rawBody = JSON.stringify({
    eventId: 'assignment-event-2',
    eventType: 'assignment.status.changed.v2',
    storeId: '550e8400-e29b-41d4-a716-446655440000',
    assignmentRequestId: 'assignment-request-1',
    status: 'ACCEPTED',
  });
  const headers = signedHeaders({
    rawBody,
    eventId: 'assignment-event-2',
    eventType: 'assignment.status.changed',
  });

  await assert.rejects(
    () => processAssignmentCallback({ pool: null, rawBody, headers, callbackSecret: secret, nowSeconds }),
    (error) => error.code === 'EVENT_TYPE_MISMATCH'
  );
});

test('payment status processing rejects a body event type that differs from its header', async () => {
  const rawBody = JSON.stringify({
    eventId: 'payment-event-3',
    eventType: 'assignment.status.changed',
    transactionReference: 'transaction-1',
    status: 'paid',
  });

  await assert.rejects(
    () => processPaymentWebhook({
      pool: null,
      rawBody,
      body: JSON.parse(rawBody),
      verified: {
        eventId: 'payment-event-3',
        eventType: 'payment.status.changed',
        bodyDigest: 'digest',
      },
    }),
    (error) => error.code === 'EVENT_TYPE_MISMATCH'
  );
});
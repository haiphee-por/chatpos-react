const assert = require('node:assert/strict');
const test = require('node:test');
const {
  boundedInteger,
  getStoppayTransition,
  getTransactionFilters,
} = require('./merchantHomeContract.cjs');

test('bounds pagination values and uses safe defaults', () => {
  assert.equal(boundedInteger('0', 20, 1, 100), 1);
  assert.equal(boundedInteger('999', 20, 1, 100), 100);
  assert.equal(boundedInteger('not-a-number', 20, 1, 100), 20);
  assert.equal(boundedInteger('10', 20, 1, 100), 10);
});

test('accepts only allowlisted transaction filters', () => {
  const query = new URLSearchParams({
    status: 'completed',
    channel: 'promptpay',
    transactionType: 'payment',
    storeId: 'store-attacker-value',
    orderBy: 'customerPhone',
  });

  assert.deepEqual(getTransactionFilters(query), {
    status: 'completed',
    channel: 'promptpay',
    transactionType: 'payment',
  });
});

test('rejects invalid STOPPAY transitions and permits valid role transitions', () => {
  assert.equal(getStoppayTransition('merchant', 'request_pause', 'ACTIVE').to, 'PAUSE_REQUESTED');
  assert.equal(getStoppayTransition('merchant', 'request_pause', 'PAUSED'), null);
  assert.equal(getStoppayTransition('agent', 'request_pause', 'ACTIVE'), null);
  assert.equal(getStoppayTransition('compliance', 'suspend', 'PAUSED').to, 'SUSPENDED');
});

test('keeps an idempotent command replay side-effect free', () => {
  const events = new Map();
  const applyCommand = (key, event) => {
    if (events.has(key)) return { replay: true, event: events.get(key) };
    events.set(key, event);
    return { replay: false, event };
  };

  const first = applyCommand('stoppay:store-a:pause-1', { toStatus: 'PAUSE_REQUESTED' });
  const replay = applyCommand('stoppay:store-a:pause-1', { toStatus: 'PAUSED' });

  assert.equal(first.replay, false);
  assert.equal(replay.replay, true);
  assert.deepEqual(replay.event, first.event);
  assert.equal(events.size, 1);
});

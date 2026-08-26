const stoppayTransitions = {
  merchant: {
    request_pause: { from: ['ACTIVE'], to: 'PAUSE_REQUESTED' },
    request_resume: { from: ['PAUSED'], to: 'RESUME_REQUESTED' },
    request_recovery: { from: ['SUSPENDED'], to: 'RECOVERY_REQUESTED' },
  },
  admin: {
    approve_pause: { from: ['PAUSE_REQUESTED'], to: 'PAUSED' },
    approve_resume: { from: ['RESUME_REQUESTED'], to: 'ACTIVE' },
    suspend: { from: ['ACTIVE', 'PAUSED', 'RESUME_REQUESTED'], to: 'SUSPENDED' },
    restore: { from: ['RECOVERY_REQUESTED', 'SUSPENDED'], to: 'ACTIVE' },
  },
  compliance: {
    approve_pause: { from: ['PAUSE_REQUESTED'], to: 'PAUSED' },
    approve_resume: { from: ['RESUME_REQUESTED'], to: 'ACTIVE' },
    suspend: { from: ['ACTIVE', 'PAUSED', 'RESUME_REQUESTED'], to: 'SUSPENDED' },
    restore: { from: ['RECOVERY_REQUESTED', 'SUSPENDED'], to: 'ACTIVE' },
  },
};

const transactionStatuses = new Set([
  'pending',
  'processing',
  'completed',
  'paid',
  'succeeded',
  'settled',
  'failed',
  'refunded',
  'cancelled',
]);

const transactionChannels = new Set(['promptpay', 'cash', 'card', 'bank_transfer', 'wallet']);
const transactionTypes = new Set(['payment', 'refund', 'payout', 'adjustment']);

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function getTransactionFilters(query) {
  const filters = {};
  if (transactionStatuses.has(query.get('status'))) filters.status = query.get('status');
  if (transactionChannels.has(query.get('channel'))) filters.channel = query.get('channel');
  if (transactionTypes.has(query.get('transactionType'))) filters.transactionType = query.get('transactionType');
  return filters;
}

function getStoppayTransition(role, action, currentStatus) {
  const transition = stoppayTransitions[role]?.[action];
  if (!transition || (currentStatus !== undefined && !transition.from.includes(currentStatus))) return null;
  return transition;
}

module.exports = {
  boundedInteger,
  getStoppayTransition,
  getTransactionFilters,
  stoppayTransitions,
};

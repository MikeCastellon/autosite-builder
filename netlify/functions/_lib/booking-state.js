export const ALLOWED_ACTIONS = ['confirm', 'decline', 'complete', 'cancel'];

const TRANSITIONS = {
  pending: { confirm: 'confirmed', decline: 'declined', cancel: 'cancelled' },
  confirmed: { complete: 'completed', cancel: 'cancelled' },
  declined: {},
  completed: {},
  cancelled: {},
};

export function applyAction(currentStatus, action, opts = {}) {
  if (!ALLOWED_ACTIONS.includes(action)) {
    return { ok: false, error: `unknown action: ${action}` };
  }
  const allowed = TRANSITIONS[currentStatus];
  if (!allowed || !allowed[action]) {
    return { ok: false, error: `cannot ${action} from ${currentStatus}` };
  }
  if (action === 'decline' && !opts.reason) {
    return { ok: false, error: 'reason required for decline' };
  }
  return { ok: true, status: allowed[action] };
}

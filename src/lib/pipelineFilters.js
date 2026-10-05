// Filtering, sorting, validation and the journey for Admin > Pipeline.
//
// Pure, so the board's behaviour is testable without rendering a column.
// Works on shaped (camelCase) leads from pipeline.js, not raw rows. Ported
// from Genius Routes (src/lib/leadFilters.js + leadJourney.js).

export const OWNER_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'Mine' },
];

export const SORTS = [
  { key: 'age', label: 'Longest in stage' },
  { key: 'newest', label: 'Newest' },
  { key: 'next', label: 'Next action' },
  { key: 'value', label: 'Est. value' },
  { key: 'name', label: 'Name' },
];

export const SOURCES = [
  // Set by "Add to Pipeline" on the Leads tab.
  'Leads finder',
  'Referral',
  'Inbound call',
  'Social media',
  'Signed up (free)',
  'Trade show',
  'Other',
];

/** How long a won lead stays on the board before it drops off. */
export const WON_LINGER_DAYS = 7;

/** Mine = I own it, or I started it and nobody else has taken it over. */
export function matchesOwner(lead, key, userId) {
  if (key !== 'mine' || !userId) return true;
  return lead?.ownerId === userId || (!lead?.ownerId && lead?.createdBy === userId);
}

function compare(a, b, sort) {
  if (sort === 'newest') return Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0);
  if (sort === 'name') return String(a.companyName || '').localeCompare(String(b.companyName || ''));
  if (sort === 'value') return (Number(b.estMonthlyValue) || 0) - (Number(a.estMonthlyValue) || 0);
  if (sort === 'next') {
    // Soonest action first; leads with nothing scheduled sink to the bottom
    // rather than floating up as if they were due today.
    const at = a.nextActionOn ? Date.parse(a.nextActionOn) : null;
    const bt = b.nextActionOn ? Date.parse(b.nextActionOn) : null;
    if (at === null && bt === null) return 0;
    if (at === null) return 1;
    if (bt === null) return -1;
    return at - bt;
  }
  // 'age', the default: whatever has sat still longest floats to the top of
  // its column, because that is the one to look at.
  return Date.parse(a.stageEnteredAt || a.createdAt || 0) - Date.parse(b.stageEnteredAt || b.createdAt || 0);
}

export function filterLeads(leads = [], { search = '', owner = 'all', userId = null, sort = 'age' } = {}) {
  const term = search.trim().toLowerCase();
  const rows = leads.filter((l) => {
    if (!matchesOwner(l, owner, userId)) return false;
    if (!term) return true;
    return [l.companyName, l.contactName, l.city, l.address, l.email, l.phone]
      .some((v) => String(v || '').toLowerCase().includes(term));
  });
  return [...rows].sort((a, b) => compare(a, b, sort));
}

/** Won leads age off the board after a week; everything else stays until archived. */
export function visibleOnBoard(leads = [], stages = [], now = Date.now()) {
  const cutoff = now - WON_LINGER_DAYS * 86400000;
  const won = new Set(stages.filter((s) => s.kind === 'won').map((s) => s.id));
  return leads.filter((l) => !won.has(l.stageId) || Date.parse(l.stageEnteredAt || l.createdAt || 0) >= cutoff);
}

/** Filtered leads in their columns, one bucket per stage. */
export function groupByStage(leads = [], stages = []) {
  const buckets = new Map(stages.map((s) => [s.id, []]));
  for (const lead of leads) {
    if (buckets.has(lead.stageId)) buckets.get(lead.stageId).push(lead);
  }
  return stages.map((stage) => ({ stage, leads: buckets.get(stage.id) || [] }));
}

/** Open pipeline = everything not yet won or lost. */
export function openPipelineTotal(leads = [], stages = []) {
  const terminal = new Set(stages.filter((s) => s.kind !== 'open').map((s) => s.id));
  return leads
    .filter((l) => !terminal.has(l.stageId))
    .reduce((sum, l) => sum + (Number(l.estMonthlyValue) || 0), 0);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Form validation: a { field: message } map, empty when valid. Only the name
 * and the stage are required; demanding a full address is how a lead ends up
 * not written down at all.
 */
export function validateLead(values = {}) {
  const errors = {};
  if (!String(values.companyName || '').trim()) errors.companyName = 'Business name is required.';
  if (!values.stageId) errors.stageId = 'Pick a stage.';
  const email = String(values.email || '').trim();
  if (email && !EMAIL.test(email)) errors.email = "That doesn't look like an email address.";
  const value = String(values.estMonthlyValue ?? '').trim();
  if (value && (Number.isNaN(Number(value)) || Number(value) < 0)) {
    errors.estMonthlyValue = 'Enter a number, or leave it blank.';
  }
  return errors;
}

/**
 * Soft duplicate check for the add form: a warning, never a block.
 * `accounts`: [{ id, name, email }] from the account search.
 */
export function findDuplicates(name, { leads = [], accounts = [] } = {}) {
  const term = String(name || '').trim().toLowerCase();
  if (term.length < 3) return { leads: [], accounts: [] };
  const hit = (v) => String(v || '').toLowerCase().includes(term);
  return {
    leads: leads.filter((l) => hit(l.companyName)).slice(0, 3),
    accounts: accounts.filter((a) => hit(a.name)).slice(0, 3),
  };
}

/** "$650/mo", "$2.2k/mo". Null when there is no value. */
export function monthlyLabel(n) {
  const v = Number(n);
  if (n == null || n === '' || !Number.isFinite(v) || v <= 0) return null;
  if (v < 1000) return `$${Math.round(v)}/mo`;
  if (v < 10000) return `$${(v / 1000).toFixed(1).replace(/\.0$/, '')}k/mo`;
  return `$${Math.round(v / 1000)}k/mo`;
}

/** A next-action date is due when it is today or earlier. */
export function isDue(nextActionOn, now = Date.now()) {
  if (!nextActionOn) return false;
  const end = Date.parse(`${nextActionOn}T23:59:59`);
  return Number.isFinite(end) && end - 86400000 <= now;
}

// ─── The journey ──────────────────────────────────────────────────────

/** "MR" for the owner chip. Two letters max; a dash when there's no name. */
export function initials(name) {
  const parts = String(name || '').trim().split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return '–';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "just now" / "4h" / "12d" / a date once it stops being relatable. */
export function timeAgo(iso, now = Date.now()) {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((now - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(then).toLocaleDateString();
}

/** "today" / "3d": whole days since the lead last changed stage. */
export function stageAgeLabel(lead, now = Date.now()) {
  const at = lead?.stageEnteredAt || lead?.createdAt;
  const then = at ? Date.parse(at) : NaN;
  if (Number.isNaN(then)) return '';
  const days = Math.max(0, Math.floor((now - then) / 86400000));
  return days === 0 ? 'today' : `${days}d`;
}

/**
 * Every stage, marked done / current / upcoming. "Done" means the lead
 * actually stood there (a movement points at it), not merely that it sits
 * earlier in the order: a lead dragged from New Lead to Onboarding skipped
 * three stages, and the strip should say so.
 */
export function journeyFor(stages = [], movements = [], currentStageId = null) {
  const visited = new Set(movements.map((m) => m.toStageId).filter(Boolean));
  const enteredAt = new Map();
  for (const m of [...movements].sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0))) {
    if (m.toStageId) enteredAt.set(m.toStageId, m.createdAt);
  }
  return stages.map((stage) => {
    const current = stage.id === currentStageId;
    return {
      id: stage.id,
      name: stage.name,
      kind: stage.kind,
      current,
      done: !current && visited.has(stage.id),
      upcoming: !current && !visited.has(stage.id),
      enteredAt: enteredAt.get(stage.id) || null,
    };
  });
}

/** One movement as a sentence: "Added to New Lead", or "Contacted → Demo Sent". */
export function movementLabel(movement, stagesById = {}) {
  const to = stagesById[movement?.toStageId]?.name || 'a stage';
  if (!movement?.fromStageId) return `Added to ${to}`;
  const from = stagesById[movement.fromStageId]?.name || 'a stage';
  return `${from} → ${to}`;
}

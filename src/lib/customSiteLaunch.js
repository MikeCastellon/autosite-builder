// The Launch card of a custom website project: the go-live checklist and the
// revision-round counter. It lives in custom_site_projects.design.launch (no
// column of its own) and only custom-site-admin `launch-save` writes it: the
// card sends just what changed (a patch) and the server merges it with
// applyLaunchPatch, so the design setup's keys and another admin's ticks
// survive. Pure: used by the function, the card and the activity log.

// Ids are stored in saved projects (design.launch.checked): never rename one.
// The card lists them in this order.
export const LAUNCH_ITEMS = [
  { id: 'domain', label: 'Domain connected', hint: 'Their own address opens the site, with the padlock (https).' },
  { id: 'google_profile', label: 'Google profile linked', hint: 'The website link on their Google Business Profile points to the site.' },
  { id: 'test_booking', label: 'Test booking made', hint: 'Booked a test appointment on the live site and it came through. Cancel it after.' },
  { id: 'contact_form', label: 'Contact form tested', hint: 'Sent a message through the site and it reached them.' },
  { id: 'logo_favicon', label: 'Logo + favicon checked', hint: 'The logo is sharp and the browser tab shows their icon.' },
  { id: 'mobile', label: 'Mobile checked', hint: 'On a phone: menu, Call and Book buttons, nothing cut off.' },
  { id: 'seo', label: 'SEO title/description checked', hint: 'The page title and description name the business, what they do and where.' },
  { id: 'customer_approved', label: 'Customer approved draft', hint: 'They said yes to the draft (in writing is best).' },
  { id: 'handed_over', label: 'Handed over', hint: 'The site is in their account and they can sign in.' },
];

export const LAUNCH_ITEM_IDS = LAUNCH_ITEMS.map((i) => i.id);
export const DEFAULT_ROUNDS_INCLUDED = 3;
export const MAX_ROUNDS = 20;
export const LAUNCH_NOTES_MAX = 4000;

export function launchItemLabel(id) {
  return LAUNCH_ITEMS.find((i) => i.id === id)?.label || id;
}

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// A tick's date, normalized to UTC ISO, or '' when it isn't a date.
function isoDate(v) {
  if (typeof v !== 'string' || v.length > 40) return '';
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : '';
}

// A whole number in [min, max]. Only numbers and numeric strings count
// (Number(true) or Number('') would quietly read as 1 or 0).
function intIn(v, min, max, fallback) {
  if (typeof v !== 'number' && (typeof v !== 'string' || !v.trim())) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function cleanNotes(v) {
  return typeof v === 'string' ? v.trim().slice(0, LAUNCH_NOTES_MAX) : '';
}

// The stored shape, from anything (a missing launch, an old or hand-edited
// row): { checked: { itemId: ISO date }, round: 0..20, roundsIncluded: 1..20,
// notes }. Unknown item ids and bad dates are dropped.
export function sanitizeLaunch(raw) {
  const src = isObject(raw) ? raw : {};
  const given = isObject(src.checked) ? src.checked : {};
  const checked = {};
  for (const id of LAUNCH_ITEM_IDS) {
    const iso = isoDate(given[id]);
    if (iso) checked[id] = iso;
  }
  return {
    checked,
    round: intIn(src.round, 0, MAX_ROUNDS, 0),
    roundsIncluded: intIn(src.roundsIncluded, 1, MAX_ROUNDS, DEFAULT_ROUNDS_INCLUDED),
    notes: cleanNotes(src.notes),
  };
}

// A project's launch state (design.launch), sanitized.
export function launchOf(project) {
  return sanitizeLaunch(project?.design?.launch);
}

// Applies what the card changed to the stored launch. `patch` holds only the
// changes: { checked: { itemId: true | false }, round, roundsIncluded, notes }.
// A newly ticked item is dated `now` (the server passes its own clock); one
// already ticked keeps its first date. Returns
//   launch:  the new state
//   changed: whether anything needs saving
//   event:   what changed, for the activity log, or null (notes alone are
//            not logged, like the project's admin notes)
export function applyLaunchPatch(current, patch, now = new Date().toISOString()) {
  const base = sanitizeLaunch(current);
  const p = isObject(patch) ? patch : {};
  const stamp = isoDate(now) || new Date().toISOString();
  const launch = { ...base, checked: { ...base.checked } };
  const event = {};
  let changed = false;

  if (isObject(p.checked)) {
    const ticked = [];
    const unticked = [];
    for (const id of LAUNCH_ITEM_IDS) {
      const v = p.checked[id];
      if (v === true && !launch.checked[id]) {
        launch.checked[id] = stamp;
        ticked.push(id);
      } else if (v === false && launch.checked[id]) {
        delete launch.checked[id];
        unticked.push(id);
      }
    }
    if (ticked.length) event.checked = ticked;
    if (unticked.length) event.unchecked = unticked;
  }
  if ('roundsIncluded' in p) {
    const n = intIn(p.roundsIncluded, 1, MAX_ROUNDS, base.roundsIncluded);
    if (n !== base.roundsIncluded) {
      launch.roundsIncluded = n;
      event.roundsIncluded = { from: base.roundsIncluded, to: n };
    }
  }
  if ('round' in p) {
    const n = intIn(p.round, 0, MAX_ROUNDS, base.round);
    if (n !== base.round) {
      launch.round = n;
      event.round = { from: base.round, to: n, of: launch.roundsIncluded };
    }
  }
  if ('notes' in p) {
    const notes = cleanNotes(p.notes);
    if (notes !== base.notes) {
      launch.notes = notes;
      changed = true;
    }
  }
  const logged = Object.keys(event).length > 0;
  return { launch, changed: changed || logged, event: logged ? event : null };
}

// { done, total, complete, label }: "4 of 9 done", "All 9 done".
export function launchProgress(launch) {
  const { checked } = sanitizeLaunch(launch);
  const total = LAUNCH_ITEMS.length;
  const done = LAUNCH_ITEM_IDS.filter((id) => checked[id]).length;
  return { done, total, complete: done === total, label: done === total ? `All ${total} done` : `${done} of ${total} done` };
}

// The revision counter as the card shows it: "Round 2 of 3", and a warning
// once the rounds go past the ones included.
export function roundStatus(launch) {
  const { round, roundsIncluded } = sanitizeLaunch(launch);
  const over = Math.max(0, round - roundsIncluded);
  return {
    round,
    included: roundsIncluded,
    over,
    isLastIncluded: round > 0 && round === roundsIncluded,
    label: round === 0 ? 'No revision rounds yet' : `Round ${round} of ${roundsIncluded}`,
    warning: over ? `${over} round${over === 1 ? '' : 's'} over the ${roundsIncluded} included` : '',
  };
}

// The activity log line for a 'launch' event (its data is applyLaunchPatch's
// `event`).
export function describeLaunchEvent(data) {
  const d = isObject(data) ? data : {};
  const names = (ids) => (Array.isArray(ids) ? ids : []).map((id) => `"${launchItemLabel(id)}"`).join(', ');
  const parts = [];
  if (Array.isArray(d.checked) && d.checked.length) parts.push(`ticked ${names(d.checked)}`);
  if (Array.isArray(d.unchecked) && d.unchecked.length) parts.push(`unticked ${names(d.unchecked)}`);
  if (isObject(d.roundsIncluded)) parts.push(`included revision rounds set to ${d.roundsIncluded.to}`);
  if (isObject(d.round)) {
    const { to, of } = d.round;
    if (!to) parts.push('revision rounds reset');
    else parts.push(`revision round ${to}${of ? ` of ${of}` : ''}${of && to > of ? ' (over the included rounds)' : ''}`);
  }
  return parts.length ? `Launch list: ${parts.join('; ')}` : 'Launch list updated';
}

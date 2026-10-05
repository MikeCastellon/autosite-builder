// Stands in for src/lib/supabase.js while the CLI renders pages (the real
// client needs the app's VITE_ env and a browser). exportHtml.js only uses
// it for the old widget section: a site with widget_config_ids but no
// Google reviews / Instagram key. In Admin > Site upgrades that read runs
// with the admin's session, and RLS shows an admin only their own
// widget_configs, so for an owner's site it comes back empty. This answers
// the same: empty. Such sites are always flagged (legacy_widgets), so the
// difference could never reach a live page anyway.
const empty = () => Promise.resolve({ data: [], error: null });

function query() {
  const q = {};
  for (const op of ['select', 'eq', 'neq', 'in', 'is', 'order', 'limit']) q[op] = () => q;
  q.maybeSingle = () => Promise.resolve({ data: null, error: null });
  q.single = () => Promise.resolve({ data: null, error: { message: 'not available while rendering' } });
  q.then = (res, rej) => empty().then(res, rej);
  return q;
}

export const supabase = { from: () => query() };
export const isImpersonationTab = false;

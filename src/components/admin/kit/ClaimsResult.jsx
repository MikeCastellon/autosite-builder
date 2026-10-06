import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  CLAIM_KIND_LABELS, CLAIM_STATUSES, CLAIM_STATUS_LABELS, CLAIM_WHERE, CLAIM_WHERE_LABELS, claimCounts, filterClaims,
  groupClaims, ledgerSummary, openClaims, sanitizeClaimsSignOff, sanitizeLedger, sourceLabel,
} from '../../../lib/kit/claims.js';
import { copyText, formatDateTime } from '../customSiteUi.jsx';

// The claims ledger's view (Launch Kit skill "claims"): every factual claim
// on the site and in the kit, grouped by what needs work first (needs a
// rewrite, no source, sourced), with filters, the source quote and the
// suggested rewrite to copy. The "Signed off" box records that the admin
// checked them; the handover's sign-off line reads it. LaunchKitPanel shows
// the run's files, notes and warnings above this view.
//
//   run        design.kit.claims (status 'ready'); run.data is the stored
//              ledger, sanitized again here (src/lib/kit/claims.js)
//   project    the custom_site_projects row (unused; the panel passes it)
//   urls       signed links by file name (unused: ledger.json is the data)
//   signedOff  optional: the saved sign-off, true/false or { at, by, open,
//              startedAt } (sanitizeClaimsSignOff); falls back to
//              run.signOff. One for another run (startedAt) doesn't count.
//   onSignOff  optional (signedOff: boolean, summary) => void | Promise:
//              saves the box. summary = { at, startedAt, counts, open }.
//              Without it the box still works on this screen, and says it
//              isn't saved. A rejected promise puts the box back.

const STATUS_STYLES = {
  'needs-rewrite': { dot: 'bg-amber-500', head: 'text-amber-900' },
  unsourced: { dot: 'bg-[#cc0000]', head: 'text-[#a80000]' },
  sourced: { dot: 'bg-emerald-600', head: 'text-emerald-800' },
};
const STATUS_HINTS = {
  'needs-rewrite': 'A source exists, but the claim says more than it. Use the suggestion, or get the customer to confirm.',
  unsourced: 'Nothing the customer told us backs it. Remove or rewrite it before launch.',
  sourced: 'Backed word for word by the customer\'s answers, the confirmed business info or their pasted reviews.',
};
const CHIP = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40';
const COPY_BTN = 'shrink-0 inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-black/[0.12] text-[11px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40';
const FIELD = 'px-2.5 py-1.5 rounded-lg border border-black/[0.12] bg-white text-[12px] text-[#1a1a1a] focus:outline-none focus:border-[#cc0000]';
// Below the sm breakpoint a row stacks (the cells become blocks, each with
// its column name), so the suggestion is never off to the side.
const CELL = 'block sm:table-cell py-0.5 sm:py-2';
const CELL_LABEL = 'sm:hidden block text-[10px] font-bold uppercase tracking-[1px] text-ink-tertiary';

// The saved sign-off of this run as { on, at, by }.
function signOffOf(value, startedAt) {
  const s = sanitizeClaimsSignOff(value);
  const run = typeof startedAt === 'string' && !Number.isNaN(Date.parse(startedAt)) ? new Date(Date.parse(startedAt)).toISOString() : '';
  if (!s || (s.startedAt && run && s.startedAt !== run)) return { on: false, at: '', by: '' };
  return { on: true, at: s.at, by: s.by };
}

function SourceCell({ claim }) {
  if (!claim.source) return <span className="text-ink-tertiary">No source</span>;
  return (
    <>
      <span className="block text-[11px] font-semibold text-[#4a4a4a]">{sourceLabel(claim.source.field)}</span>
      <q className="block mt-0.5 text-[#1a1a1a] italic break-words">{claim.source.quote}</q>
    </>
  );
}

// copied: '' | 'ok' | 'failed' (the browser refused the clipboard: the
// text is selectable, so the admin copies it by hand).
function SuggestionCell({ claim, copied, onCopy }) {
  if (claim.status === 'sourced') return <span className="text-ink-tertiary">Nothing to change</span>;
  return (
    <div className="flex items-start gap-2">
      <span className="min-w-0 flex-1 break-words text-[#1a1a1a] select-text">{claim.suggestion}</span>
      <button
        type="button"
        onClick={onCopy}
        className={COPY_BTN}
        aria-label={copied === 'failed' ? 'Copy failed: select the suggestion and copy it by hand' : `Copy the suggestion for "${claim.text}"`}
        title={copied === 'failed' ? 'The browser blocked the clipboard: select the text and copy it' : undefined}
      >
        {copied === 'ok' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy'}
      </button>
    </div>
  );
}

function ClaimRow({ claim, copied, onCopy }) {
  return (
    <tr role="row" className="block sm:table-row align-top border-t border-black/[0.06] py-2 sm:py-0">
      <td role="cell" className={`${CELL} sm:pr-3`}>
        <span className="block text-[#1a1a1a] font-semibold break-words">&ldquo;{claim.text}&rdquo;</span>
        <span className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
          <span className="px-1.5 py-px rounded bg-black/[0.06] font-bold text-[#4a4a4a]">{CLAIM_KIND_LABELS[claim.kind] || claim.kind}</span>
          <span className="px-1.5 py-px rounded bg-black/[0.06] font-bold text-[#4a4a4a]">{CLAIM_WHERE_LABELS[claim.where] || claim.where}</span>
          {claim.path && <code className="text-ink-tertiary break-all">{claim.path}</code>}
        </span>
        {claim.note && <span className="mt-1 block text-[11px] text-amber-900">Changed by the server: {claim.note}</span>}
      </td>
      <td role="cell" className={`${CELL} sm:pr-3`}><span className={CELL_LABEL}>Source</span><SourceCell claim={claim} /></td>
      <td role="cell" className={CELL}><span className={CELL_LABEL}>Suggestion</span><SuggestionCell claim={claim} copied={copied} onCopy={onCopy} /></td>
    </tr>
  );
}

function ClaimGroup({ group, openByDefault, copied, onCopy }) {
  const style = STATUS_STYLES[group.status];
  return (
    <details open={openByDefault} className="group/claims rounded-lg border border-black/[0.06] bg-white">
      <summary className="cursor-pointer select-none px-3 py-2 flex items-center gap-2 text-[12px] font-bold">
        <span className={`w-2 h-2 rounded-full ${style.dot}`} aria-hidden="true" />
        <span className={style.head}>{group.label}</span>
        <span className="font-semibold text-ink-tertiary">{group.claims.length}</span>
      </summary>
      <div className="px-3 pb-3">
        <p className="text-[11px] text-ink-tertiary">{STATUS_HINTS[group.status]}</p>
        <div className="mt-1">
          {/* Explicit roles: below sm the rows and cells are blocks, which drops
              their native table semantics in some browsers. */}
          <table role="table" className="block sm:table w-full sm:table-fixed text-left text-[12px]">
            <caption className="sr-only">{group.label}: {group.claims.length} claim{group.claims.length === 1 ? '' : 's'}</caption>
            <colgroup>
              <col className="w-[38%]" />
              <col className="w-[30%]" />
              <col className="w-[32%]" />
            </colgroup>
            <thead className="hidden sm:table-header-group">
              <tr role="row" className="text-[10px] uppercase tracking-[1px] text-ink-tertiary">
                <th role="columnheader" scope="col" className="py-1.5 pr-3 font-bold">Claim</th>
                <th role="columnheader" scope="col" className="py-1.5 pr-3 font-bold">Source</th>
                <th role="columnheader" scope="col" className="py-1.5 font-bold">Suggestion</th>
              </tr>
            </thead>
            <tbody role="rowgroup" className="block sm:table-row-group">
              {group.claims.map((c) => (
                <ClaimRow
                  key={c.key}
                  claim={c}
                  copied={copied.key === c.key ? copied.state : ''}
                  onCopy={() => onCopy(c)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

export default function ClaimsResult({ run, signedOff, onSignOff }) {
  const ids = useId();
  const data = useMemo(() => sanitizeLedger(run?.data), [run?.data]);
  // A stable key per claim (place + position): texts can repeat across places.
  const claims = useMemo(() => (data?.claims || []).map((c, i) => ({ ...c, key: `${c.where}-${i}` })), [data]);
  const [status, setStatus] = useState('all');
  const [where, setWhere] = useState('all');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState({ key: '', state: '' });
  const saved = signOffOf(signedOff !== undefined ? signedOff : run?.signOff, run?.startedAt);
  const [sign, setSign] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [signError, setSignError] = useState('');
  const timer = useRef(null);
  const live = useRef(true);

  // Set on every mount: StrictMode runs the cleanup once right after the
  // first mount, which would otherwise leave it false for good.
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  // A newly saved value (the page reloaded the project) or a rebuilt
  // ledger replaces the box's.
  useEffect(() => {
    setSign(saved);
  }, [saved.on, saved.at, saved.by, run?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) {
    return <p className="text-[12px] text-ink-tertiary">The ledger in this run couldn't be read. Rebuild it to check the claims again.</p>;
  }

  const counts = claimCounts(claims);
  const open = openClaims({ counts });
  const statusCount = { all: claims.length, ...Object.fromEntries(CLAIM_STATUSES.map((s) => [s, claims.filter((c) => c.status === s).length])) };
  const places = CLAIM_WHERE.filter((w) => claims.some((c) => c.where === w));
  const shown = filterClaims(claims, { status, where, query });
  const groups = groupClaims(shown);
  const filtered = status !== 'all' || where !== 'all' || !!query.trim();
  // A place with claims was read, whatever the stored scope says.
  const checkedPlaces = CLAIM_WHERE.filter((w) => data.scope.includes(w) || places.includes(w));
  const unchecked = CLAIM_WHERE.filter((w) => !checkedPlaces.includes(w));

  const copy = async (claim) => {
    const ok = await copyText(claim.suggestion);
    if (!live.current) return;
    setCopied({ key: claim.key, state: ok ? 'ok' : 'failed' });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (live.current) setCopied({ key: '', state: '' }); }, ok ? 1500 : 4000);
  };

  const toggleSignOff = async (next) => {
    const before = sign;
    const at = next ? new Date().toISOString() : '';
    setSign({ on: next, at, by: '' });
    setSignError('');
    if (typeof onSignOff !== 'function') return;
    setSaving(true);
    try {
      await onSignOff(next, { at, startedAt: run?.startedAt || '', counts: { ...counts }, open });
    } catch (err) {
      if (!live.current) return;
      setSign(before);
      setSignError(err?.message ? `Not saved: ${err.message}` : 'The sign-off couldn\'t be saved. Try again.');
    } finally {
      if (live.current) setSaving(false);
    }
  };

  return (
    <div className="space-y-3 text-[12px] text-[#4a4a4a]">
      <div>
        <p className="text-[13px] font-semibold text-[#1a1a1a]">{ledgerSummary({ counts })}</p>
        <p className="mt-0.5 text-ink-tertiary">
          Checked: {checkedPlaces.length ? checkedPlaces.map((w) => CLAIM_WHERE_LABELS[w]).join(', ') : 'nothing'}.
          {unchecked.length > 0 && ` Not checked: ${unchecked.map((w) => CLAIM_WHERE_LABELS[w]).join(', ')} (nothing there to check when this ran).`}
          {data.dismissed > 0 && ` ${data.dismissed} pattern match${data.dismissed === 1 ? ' was' : 'es were'} read and judged not to be claims.`}
        </p>
      </div>

      {claims.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter the claims">
          {['all', ...CLAIM_STATUSES].map((s) => {
            const on = status === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setStatus(s)}
                className={`${CHIP} ${on ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white' : 'bg-white border-black/[0.12] text-[#1a1a1a] hover:border-[#cc0000]/40'}`}
              >
                {s !== 'all' && <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLES[s].dot}`} aria-hidden="true" />}
                {s === 'all' ? 'All' : CLAIM_STATUS_LABELS[s]}
                <span className={on ? 'text-white/70' : 'text-ink-tertiary'}>{statusCount[s]}</span>
              </button>
            );
          })}
          {places.length > 1 && (
            <>
              <label htmlFor={`${ids}-where`} className="sr-only">Where</label>
              <select id={`${ids}-where`} value={where} onChange={(e) => setWhere(e.target.value)} className={FIELD}>
                <option value="all">Everywhere</option>
                {places.map((w) => (
                  <option key={w} value={w}>{CLAIM_WHERE_LABELS[w]} · {claims.filter((c) => c.where === w).length}</option>
                ))}
              </select>
            </>
          )}
          <label htmlFor={`${ids}-q`} className="sr-only">Search the claims</label>
          <input
            id={`${ids}-q`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search claims, sources, suggestions"
            className={`${FIELD} min-w-0 flex-1 basis-48`}
          />
        </div>
      )}

      {filtered && (
        <p className="text-ink-tertiary" aria-live="polite">
          Showing {shown.length} of {claims.length}.{' '}
          <button type="button" onClick={() => { setStatus('all'); setWhere('all'); setQuery(''); }} className="underline underline-offset-2 text-[#1a1a1a] hover:text-[#cc0000]">
            Show all
          </button>
        </p>
      )}

      {claims.length === 0 && <p className="text-ink-tertiary">The pages hold no factual claims to check (no prices, numbers, ratings, awards or promises).</p>}
      {claims.length > 0 && groups.length === 0 && <p className="text-ink-tertiary">No claims match these filters.</p>}

      <div className="space-y-2">
        {groups.map((g) => (
          <ClaimGroup
            key={g.status}
            group={g}
            // What needs work opens; the sourced list opens when it's all there is or asked for.
            openByDefault={g.status !== 'sourced' || open === 0 || status === 'sourced'}
            copied={copied}
            onCopy={copy}
          />
        ))}
      </div>

      <div className="rounded-lg border border-black/[0.08] bg-white px-3 py-2.5">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={sign.on}
            disabled={saving}
            onChange={(e) => toggleSignOff(e.target.checked)}
            aria-describedby={`${ids}-sign`}
            className="mt-0.5 w-4 h-4 accent-[#cc0000]"
          />
          <span>
            <span className="text-[13px] font-semibold text-[#1a1a1a]">Signed off</span>
            <span id={`${ids}-sign`} className="block text-ink-tertiary">
              Every claim is fixed on the site and in the kit, or the customer confirmed it in writing.
              {sign.on && (sign.at || sign.by) && ` Signed off${sign.at ? ` ${formatDateTime(sign.at)}` : ''}${sign.by ? ` by ${sign.by}` : ''}.`}
              {saving && ' Saving…'}
              {typeof onSignOff !== 'function' && ' Only on this screen: the sign-off isn\'t saved yet.'}
            </span>
            {open > 0 && (
              <span className="block mt-0.5 text-amber-900">
                {open} claim{open === 1 ? '' : 's'} in this ledger still {open === 1 ? 'needs' : 'need'} a rewrite or a source. Fix them in the editor (and rebuild the kit texts) before signing off.
              </span>
            )}
          </span>
        </label>
        {signError && <p className="mt-1 text-[#cc0000]" role="alert">{signError}</p>}
      </div>
    </div>
  );
}

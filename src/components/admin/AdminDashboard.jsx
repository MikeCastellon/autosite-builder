import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { listAllUsers, listAllAdminTags } from '../../lib/adminUsers.js';
import { customSiteAdmin } from '../../lib/customSites.js';
import { STAGES } from '../../lib/customSiteForm.js';
import { computeAdminStats, billingStatusOf, accountFilterForKey, PRO_MONTHLY_PRICE_CENTS } from '../../lib/adminStats.js';
import { BillingBadge, formatMoney, formatShortDate } from './billingUi.jsx';
import { StageBadge } from './customSiteUi.jsx';
import AdminUserDrawer from './AdminUserDrawer.jsx';

// Admin > Dashboard: who is paying, custom websites in progress and what
// needs a look. The page loads its own data (users are required; custom
// websites and bookings are optional and show "—" when they fail), and
// DashboardView draws it from computeAdminStats alone, so it renders the
// same in a test as on the page.

const DAY_MS = 24 * 60 * 60 * 1000;
const CARD = 'bg-white border border-black/[0.07] rounded-xl';
const SECTION_LABEL = 'text-[11px] font-bold text-[#1a1a1a] uppercase tracking-[1.5px]';
// Long lists collapse behind "Show all" so the right column stays in view.
const PAYING_ROWS = 8;
const ATTENTION_ROWS = 6;

// Plan breakdown chips, in billing order (admins are not customers). A
// click opens Customers on the chip that lists that key; the Customers tab
// folds a few keys together (lapsed under Past due, cancelling under
// Cancelled).
export const PLAN_CHIPS = [
  { key: 'paying', label: 'Paying' },
  { key: 'trial', label: 'Trial' },
  { key: 'manual', label: 'Pro (manual)' },
  { key: 'comped', label: 'Comped Pro' },
  { key: 'past_due', label: 'Past due' },
  { key: 'past_due_lapsed', label: 'Past due (lapsed)' },
  { key: 'cancelled_grace', label: 'Cancelling' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'free', label: 'Free' },
].map((c) => ({ ...c, filter: accountFilterForKey(c.key) }));

// ─── Small formatters ─────────────────────────────────────────────────

// A missing source shows "—", never a made-up zero.
function num(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
}

function plural(n, one, many = `${one}s`) {
  return `${num(n)} ${n === 1 ? one : many}`;
}

function hostOf(url) {
  return String(url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
}

function nameOf(u) {
  return [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim();
}

function businessOf(u) {
  return u?.business_name || u?.firstSiteName || '';
}

function sourceLabel(source) {
  if (source === 'stripe') return 'Stripe';
  if (source === 'shopify') return 'Shopify';
  return '—';
}

// One column for both dates: a renewal for accounts that will be billed
// again, the end date for ones that are winding down.
function nextDateText(status) {
  if (status?.renewsAt) return formatShortDate(status.renewsAt);
  if (status?.endsAt) return `Ends ${formatShortDate(status.endsAt)}`;
  return '—';
}

// ─── Building blocks ──────────────────────────────────────────────────

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function Card({ id, title, count, action, className = '', children }) {
  return (
    <section aria-labelledby={id} className={`${CARD} min-w-0 ${className}`}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <h2 id={id} className={SECTION_LABEL}>{title}</h2>
        {count != null && <span className="text-[11px] font-semibold text-ink-tertiary">{count}</span>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function TextButton({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="text-[12px] font-semibold text-[#555] hover:text-[#cc0000] whitespace-nowrap">
      {children}
    </button>
  );
}

function ShowAll({ total, shown, open, onToggle }) {
  if (total <= shown && !open) return null;
  return (
    <div className="px-4 py-2.5 border-t border-black/[0.05]">
      <TextButton onClick={onToggle}>{open ? 'Show less' : `Show all ${total}`}</TextButton>
    </div>
  );
}

function KpiCard({ label, value, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${CARD} min-w-0 text-left px-4 py-4 hover:border-[#cc0000]/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40`}
    >
      <span className="block text-[11px] font-semibold text-ink-tertiary leading-tight">{label}</span>
      <span className="block mt-2 text-[28px] font-[800] leading-none text-[#1a1a1a] tabular-nums">{value}</span>
      {sub && <span className="block mt-2 text-[11px] text-[#555] leading-snug">{sub}</span>}
    </button>
  );
}

function KpiRow({ stats, onSection, onOpenAccounts }) {
  const { billing, customSites, sites, accounts } = stats;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label="Paying customers"
        value={num(billing.paying)}
        sub={`est. ${formatMoney(billing.estMrrCents)}/mo at ${formatMoney(PRO_MONTHLY_PRICE_CENTS)}`}
        onClick={() => onOpenAccounts?.('paying')}
      />
      <KpiCard
        label="Custom websites in progress"
        value={customSites ? num(customSites.active) : '—'}
        sub={customSites ? `${num(customSites.live)} live · ${num(customSites.paid)} paid` : 'Stats unavailable'}
        onClick={() => onSection?.('custom-sites')}
      />
      <KpiCard
        label="Live customer websites"
        value={num(sites.published)}
        sub={`${plural(accounts.withLiveSite, 'owner')} · ${num(sites.newLiveLast30)} new in 30 days`}
        onClick={() => onOpenAccounts?.('live')}
      />
      <KpiCard
        label="New customers (30 days)"
        value={num(accounts.signups30)}
        sub={`${num(accounts.signups7)} this week · ${num(accounts.customers)} total`}
        onClick={() => onOpenAccounts?.('all')}
      />
    </div>
  );
}

// ─── Who's paying ─────────────────────────────────────────────────────

function PayingCard({ items, onOpenUser, onOpenAccounts }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, PAYING_ROWS);
  return (
    <Card
      id="dash-paying"
      title="Who's paying"
      count={items.length || null}
      action={<TextButton onClick={() => onOpenAccounts?.('all')}>All customers</TextButton>}
    >
      {items.length === 0 ? (
        <p className="px-4 pb-5 text-sm text-ink-tertiary">No paying customers yet.</p>
      ) : (
        <>
          {/* The table scrolls inside the card on a phone; the page never does. */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[620px]">
              <thead className="bg-[#faf9f7] text-left text-[10px] text-ink-tertiary uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Billing</th>
                  <th className="px-4 py-3">Next bill or ends</th>
                  <th className="px-4 py-3">Live site</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ user, status }) => {
                  const name = nameOf(user);
                  const business = businessOf(user);
                  return (
                    // A click anywhere on the row opens the customer; the
                    // name is a real button so the keyboard can do the same.
                    <tr
                      key={user.id}
                      onClick={() => onOpenUser?.(user)}
                      className="border-t border-black/[0.05] hover:bg-[#faf9f7] cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onOpenUser?.(user); }}
                          className="block text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]"
                        >
                          <span className="block font-semibold text-[#1a1a1a] truncate max-w-[220px]">{name || user.email}</span>
                          {business && <span className="block text-[11px] text-ink-tertiary truncate max-w-[220px]">{business}</span>}
                        </button>
                      </td>
                      <td className="px-4 py-3"><BillingBadge status={status} /></td>
                      <td className="px-4 py-3 text-[12px] text-[#555]">{sourceLabel(status?.source)}</td>
                      <td className="px-4 py-3 text-[12px] text-[#555] whitespace-nowrap">{nextDateText(status)}</td>
                      <td className="px-4 py-3">
                        {user.firstPublishedUrl ? (
                          <a
                            href={user.firstPublishedUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[12px] text-[#cc0000] font-semibold hover:underline truncate max-w-[160px] inline-block align-bottom"
                          >
                            {hostOf(user.firstPublishedUrl)}
                          </a>
                        ) : (
                          <span className="text-[12px] text-ink-tertiary">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ShowAll total={items.length} shown={PAYING_ROWS} open={open} onToggle={() => setOpen((v) => !v)} />
        </>
      )}
    </Card>
  );
}

function PlanBreakdown({ byKey, onOpenAccounts }) {
  return (
    <div className="min-w-0">
      <p className={`${SECTION_LABEL} mb-2`}>Plan breakdown</p>
      <div className="flex flex-wrap gap-1.5">
        {PLAN_CHIPS.map((c) => {
          const n = byKey?.[c.key] ?? 0;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onOpenAccounts?.(c.filter)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors bg-white border-black/[0.10] hover:border-[#cc0000]/40 ${n ? 'text-[#555]' : 'text-ink-tertiary'}`}
            >
              {c.label} <span className={`ml-1 ${n ? 'text-[#1a1a1a]' : 'text-ink-tertiary'}`}>{num(n)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Right column ─────────────────────────────────────────────────────

function AttentionCard({ items, onOpenUser, onOpenProject }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, ATTENTION_ROWS);
  return (
    <Card id="dash-attention" title="Needs attention" count={items.length || null}>
      {items.length === 0 ? (
        <p className="px-4 pb-5 text-sm text-ink-tertiary">Nothing needs attention.</p>
      ) : (
        <>
          <ul>
            {shown.map((item) => {
              const isProject = item.kind === 'project';
              const openItem = isProject
                ? () => onOpenProject?.(item.project?.id ?? item.id)
                : () => { if (item.user) onOpenUser?.(item.user); };
              const red = item.tone === 'red';
              return (
                <li key={`${item.kind}:${item.id}`} className="border-t border-black/[0.05]">
                  <button type="button" onClick={openItem} className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-[#faf9f7]">
                    <span aria-hidden="true" className={`mt-[7px] w-2 h-2 rounded-full shrink-0 ${red ? 'bg-[#cc0000]' : 'bg-amber-500'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-[#1a1a1a] truncate">
                        {red && <span className="sr-only">Urgent: </span>}
                        {item.title}
                      </span>
                      {item.detail && <span className="block text-[12px] text-[#555] leading-snug">{item.detail}</span>}
                    </span>
                    <span className="mt-1"><Chevron /></span>
                  </button>
                </li>
              );
            })}
          </ul>
          <ShowAll total={items.length} shown={ATTENTION_ROWS} open={open} onToggle={() => setOpen((v) => !v)} />
        </>
      )}
    </Card>
  );
}

function CustomSitesCard({ customSites, onSection }) {
  const open = () => onSection?.('custom-sites');
  return (
    <Card id="dash-custom-sites" title="Custom websites" action={<TextButton onClick={open}>Open</TextButton>}>
      {!customSites ? (
        <div className="px-4 pb-5">
          <p className="text-sm font-semibold text-[#1a1a1a]">Custom website stats unavailable</p>
          <p className="mt-0.5 text-[12px] text-ink-tertiary">The custom websites service didn't answer. Refresh to try again.</p>
        </div>
      ) : (
        <>
          <ul>
            {STAGES.map((s) => {
              const n = customSites.byStage?.[s.id] || 0;
              return (
                <li key={s.id} className="border-t border-black/[0.05]">
                  <button type="button" onClick={open} className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left hover:bg-[#faf9f7]">
                    <StageBadge stage={s.id} />
                    <span className={`text-[15px] font-[800] tabular-nums ${n ? 'text-[#1a1a1a]' : 'text-ink-tertiary'}`}>{num(n)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-4 py-3 border-t border-black/[0.05] text-[12px] text-[#555]">
            {num(customSites.paid)} paid · {num(customSites.handedOver)} handed over
            {customSites.onHold ? ` · ${num(customSites.onHold)} on hold` : ''}
          </p>
        </>
      )}
    </Card>
  );
}

function QuickActions({ onSection, onOpenDemo }) {
  const actions = [
    { id: 'add', label: 'Add a custom website customer', hint: 'Send them their website form', onClick: () => onSection?.('custom-sites') },
    onOpenDemo && { id: 'demo', label: 'Open editor demo', hint: 'The site editor with sample content', onClick: () => onOpenDemo() },
    { id: 'upgrades', label: 'Site upgrades', hint: 'Republish live sites onto the current templates', onClick: () => onSection?.('site-upgrades') },
  ].filter(Boolean);
  return (
    <Card id="dash-actions" title="Quick actions">
      <ul>
        {actions.map((a) => (
          <li key={a.id} className="border-t border-black/[0.05]">
            <button type="button" onClick={a.onClick} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#faf9f7]">
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-[#1a1a1a]">{a.label}</span>
                <span className="block text-[12px] text-ink-tertiary leading-snug">{a.hint}</span>
              </span>
              <Chevron />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ─── Bottom row ───────────────────────────────────────────────────────

function siteLine(u) {
  if (u.firstPublishedUrl) return { text: hostOf(u.firstPublishedUrl), tone: 'text-emerald-700 font-semibold' };
  if (u.siteCount > 0) return { text: 'Draft, not published', tone: 'text-ink-tertiary' };
  return { text: 'No site yet', tone: 'text-ink-tertiary' };
}

function RecentSignupsCard({ items, now, onOpenUser }) {
  return (
    <Card id="dash-signups" title="Recent sign-ups">
      {items.length === 0 ? (
        <p className="px-4 pb-5 text-sm text-ink-tertiary">No sign-ups yet.</p>
      ) : (
        <ul>
          {items.map((item) => {
            // Accepts a bare user or a { user, status } pair.
            const user = item?.user || item;
            const status = item?.status || billingStatusOf(user, now);
            const name = nameOf(user);
            const site = siteLine(user);
            return (
              <li key={user.id} className="border-t border-black/[0.05]">
                <button type="button" onClick={() => onOpenUser?.(user)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#faf9f7]">
                  <span className="w-8 h-8 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-[11px] font-bold overflow-hidden shrink-0">
                    {user.photo_url ? <img src={user.photo_url} alt="" className="w-full h-full object-cover" /> : (name || user.email || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-[#1a1a1a] truncate">{name || user.email}</span>
                    <span className={`block text-[11px] truncate ${site.tone}`}>{site.text}</span>
                  </span>
                  <span className="shrink-0 flex flex-col items-end gap-1">
                    <BillingBadge status={status} />
                    <span className="text-[11px] text-ink-tertiary whitespace-nowrap">Joined {formatShortDate(user.created_at)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function ActivityCard({ stats }) {
  const { bookings, sites, billing, accounts } = stats;
  const rows = [
    ['Bookings, last 30 days', bookings ? num(bookings.last30) : '—'],
    ['New live websites, last 30 days', num(sites.newLiveLast30)],
    ['Custom domains', `${num(sites.customDomainsLive)} live · ${num(sites.customDomainsPending)} pending`],
    ['Booking-only pages', num(sites.bookingOnly)],
    ['Conversion', accounts.customers ? `${num(billing.conversionPct)}% of customers pay` : '—'],
    ['Signed up, no site yet', num(accounts.withoutSite)],
  ];
  return (
    <Card id="dash-activity" title="Activity">
      <dl>
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-2.5 border-t border-black/[0.05]">
            <dt className="text-[13px] text-[#555]">{label}</dt>
            <dd className="text-[13px] font-semibold text-[#1a1a1a] text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {!bookings && <p className="px-4 pb-3 text-[11px] text-ink-tertiary">Bookings couldn't load. Refresh to try again.</p>}
    </Card>
  );
}

// ─── The view ─────────────────────────────────────────────────────────

// Renders a computeAdminStats result. No data loading, so it can be
// rendered statically with a hand-built stats object.
export function DashboardView({ stats, now, onSection, onOpenAccounts, onOpenProject, onOpenDemo, onOpenUser }) {
  if (!stats) return null;
  const { lists, billing } = stats;
  return (
    <div className="space-y-4">
      <KpiRow stats={stats} onSection={onSection} onOpenAccounts={onOpenAccounts} />

      {/* grid-cols-1 (minmax(0,1fr)) + min-w-0 keep a wide table from pushing the page sideways on a phone. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 min-w-0 space-y-4">
          <PayingCard items={lists.paying || []} onOpenUser={onOpenUser} onOpenAccounts={onOpenAccounts} />
          <PlanBreakdown byKey={billing.byKey} onOpenAccounts={onOpenAccounts} />
        </div>
        <div className="min-w-0 space-y-4">
          <AttentionCard items={lists.attention || []} onOpenUser={onOpenUser} onOpenProject={onOpenProject} />
          <CustomSitesCard customSites={stats.customSites} onSection={onSection} />
          <QuickActions onSection={onSection} onOpenDemo={onOpenDemo} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <RecentSignupsCard items={lists.recentSignups || []} now={now} onOpenUser={onOpenUser} />
        <ActivityCard stats={stats} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${CARD} h-[112px] px-4 py-4 motion-safe:animate-pulse`}>
            <div className="h-2.5 w-24 max-w-full rounded bg-black/[0.06]" />
            <div className="mt-3 h-7 w-12 rounded bg-black/[0.08]" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${CARD} lg:col-span-2 h-72 motion-safe:animate-pulse`} />
        <div className={`${CARD} h-72 motion-safe:animate-pulse`} />
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

// Each source settles on its own: only the user list is required, the
// rest fall back to null ("—" / "unavailable") instead of failing the page.
async function loadSources() {
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const settle = (fn) => Promise.resolve().then(fn);
  const [usersRes, tagsRes, projectsRes, bookingsRes] = await Promise.allSettled([
    settle(() => listAllUsers()),
    settle(() => listAllAdminTags()),
    settle(async () => (await customSiteAdmin('list')).projects || []),
    // Paged: one request stops at Supabase's 1000-row cap.
    settle(async () => {
      const PAGE = 1000;
      const rows = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('bookings')
          .select('owner_user_id, created_at')
          .gte('created_at', since)
          .order('id')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }
      return rows;
    }),
  ]);
  return {
    users: usersRes.status === 'fulfilled' ? usersRes.value : null,
    usersError: usersRes.status === 'rejected' ? (usersRes.reason?.message || 'Could not load customers') : '',
    // Tags only feed the drawer's suggestions.
    allTags: tagsRes.status === 'fulfilled' ? tagsRes.value : [],
    projects: projectsRes.status === 'fulfilled' ? projectsRes.value : null,
    bookings: bookingsRes.status === 'fulfilled' ? bookingsRes.value : null,
  };
}

export default function AdminDashboard({ onSection, onOpenAccounts, onOpenProject, onOpenDemo }) {
  const [data, setData] = useState(null); // { users, projects, bookings, loadedAt }
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  // Bumped by every load and on unmount, so a slow earlier answer never
  // overwrites a newer one (or lands after the page is gone).
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    const res = await loadSources();
    if (seq !== loadSeq.current) return;
    if (res.users) {
      setData({ users: res.users, projects: res.projects, bookings: res.bookings, loadedAt: new Date() });
      setAllTags(res.allTags);
      setErr('');
    } else {
      // Keep what is on screen after a failed refresh; the banner says so.
      setErr(res.usersError);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    return () => { loadSeq.current += 1; };
  }, [load]);

  const stats = useMemo(() => {
    if (!data) return null;
    return computeAdminStats({ users: data.users, projects: data.projects, bookings: data.bookings, now: data.loadedAt });
  }, [data]);

  // The drawer autosaves notes and tags and reports them here; patching the
  // row (as the Customers tab does) avoids reloading every source per keystroke pause.
  const applyMetadataPatch = useCallback(({ userId, notes, tags }) => {
    setData((prev) => prev && {
      ...prev,
      users: prev.users.map((u) => (u.id === userId ? { ...u, adminNotes: notes, adminTags: tags } : u)),
    });
    setAllTags((prev) => [...new Set([...prev, ...(tags || [])])].sort());
  }, []);

  const closeDrawer = useCallback(() => setSelectedUserId(null), []);
  const openUser = useCallback((u) => { if (u?.id) setSelectedUserId(u.id); }, []);
  const selectedUser = selectedUserId && data ? data.users.find((u) => u.id === selectedUserId) : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <p className="text-[12px] text-ink-tertiary" role="status" aria-live="polite">
          {loading
            ? 'Loading…'
            : data
              ? `Updated ${data.loadedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
              : ''}
        </p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-black/[0.10] text-[12px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-60"
        >
          <RefreshIcon />
          {loading && data ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {err && (
        <div role="alert" className="mb-4 rounded-xl border border-[#cc0000]/20 bg-[#fff5f5] px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#cc0000]">
              {data ? 'Could not refresh the dashboard. Showing the last numbers.' : 'Could not load the dashboard.'}
            </p>
            <p className="text-[12px] text-[#555] break-words">{err}</p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-2 rounded-lg bg-[#1a1a1a] hover:bg-[#cc0000] disabled:opacity-60 text-white text-[12px] font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {stats ? (
        <DashboardView
          stats={stats}
          now={data.loadedAt}
          onSection={onSection}
          onOpenAccounts={onOpenAccounts}
          onOpenProject={onOpenProject}
          onOpenDemo={onOpenDemo}
          onOpenUser={openUser}
        />
      ) : loading ? (
        <DashboardSkeleton />
      ) : null}

      {selectedUser && (
        <AdminUserDrawer user={selectedUser} allTags={allTags} onClose={closeDrawer} onRefresh={applyMetadataPatch} />
      )}
    </div>
  );
}

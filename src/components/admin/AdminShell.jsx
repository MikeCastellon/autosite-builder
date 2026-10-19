import { useEffect, useRef, useState } from 'react';
import { ADMIN_GROUPS, DEFAULT_ADMIN_SECTION, adminGroupOf, isAdminSection } from '../../lib/adminWorkspace.js';

// The Admin workspace's frame, built like the other Genius apps' headers
// (Closeout, Routes, Forecast, Trends, Passwords): a white sticky bar with
// the ACG logo (back to Genius HQ), the "Genius Websites" wordmark, a row
// of text tabs with a black pill on the current one, and the account menu on
// the right. What says "admin" is the red Admin pill after the
// wordmark, the same spot Logistics and Vendors use for their context pill.
// No HelpChrome or "Need Assistance?": those are for customers.
//
// The tabs are ADMIN_GROUPS (Dashboard, Websites, Customers, Sales,
// Activity): one tab per group, and the current group's sections as sub-tabs
// on a row under the bar when it has more than one. They fit in the bar from
// lg (1024px). Below that they move to a second row that scrolls sideways,
// as Closeout's tabs do on small screens.

const ACG_LOGO = 'https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=200';
const HQ_URL = 'https://hq.autocaregenius.com';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2';
const TAB = 'shrink-0 whitespace-nowrap px-2.5 sm:px-3 py-1.5 rounded-token-md text-[13px] font-medium transition-colors';
const TAB_ON = 'bg-ink-primary text-white';
const TAB_OFF = 'text-ink-primary hover:bg-black/[0.04]';
// Sub-tabs: underlined rather than pilled, so they read as a level below.
const SUB = 'shrink-0 whitespace-nowrap px-3 h-10 -mb-px border-b-2 text-[13px] font-semibold transition-colors';
const SUB_ON = 'border-ink-primary text-ink-primary';
const SUB_OFF = 'border-transparent text-ink-tertiary hover:text-ink-primary';
const MENU_ITEM = 'flex w-full items-center gap-2 rounded-token-md px-2.5 py-2 text-left text-[13px] font-semibold text-ink-secondary transition-colors hover:bg-surface-secondary';
// Hides a scrolling row's scrollbar (the tabs still scroll by touch, wheel
// and keyboard focus).
const NO_SCROLLBAR = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

// 14px line icons for the account menu and the switch button. Plain paths
// (the app has no icon library), drawn with currentColor.
const ICON_PATHS = {
  store: (
    <>
      <path d="M4 10v10h16V10" />
      <path d="M2.5 10 5 4h14l2.5 6z" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
};

function Icon({ name, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      {ICON_PATHS[name]}
    </svg>
  );
}

// The group tabs, shared by the bar (lg+) and the second row (below lg). On
// the scrolling row the current tab is brought to the middle, so a section
// opened from a link or a card is never hidden off the edge. A group tab
// opens the section of that group used last in this visit (`lastIn`), else
// its first, so going Sales > Pipeline > Websites > Sales lands on Pipeline.
function Tabs({ currentGroup, lastIn, onPick }) {
  const activeRef = useRef(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [currentGroup]);
  return ADMIN_GROUPS.map((g) => {
    const on = g.id === currentGroup;
    return (
      <button
        key={g.id}
        ref={on ? activeRef : undefined}
        type="button"
        onClick={() => onPick(lastIn[g.id] || g.sections[0].id)}
        aria-current={on ? 'page' : undefined}
        className={`${TAB} ${FOCUS} ${on ? TAB_ON : TAB_OFF}`}
      >
        {g.label}
      </button>
    );
  });
}

// The current group's sections, under the bar. Nothing for a one-section group.
function SubTabs({ group, current, onPick }) {
  if (group.sections.length < 2) return null;
  return (
    <nav aria-label={`${group.label} sections`} className={`border-t border-black/[0.05] px-2 sm:px-6 overflow-x-auto ${NO_SCROLLBAR}`}>
      <div className="flex items-center w-max mx-auto">
        {group.sections.map((s) => {
          const on = s.id === current;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s.id)}
              aria-current={on ? 'page' : undefined}
              className={`${SUB} ${FOCUS} ${on ? SUB_ON : SUB_OFF}`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// The open menu. Its own component so it can be rendered (and tested)
// without the open/close state. `onPick(fn)` closes the menu, then runs fn.
// An action without a handler is left out.
export function AccountMenuPanel({ userEmail, onPick, onSwitchToBusiness, onOpenProfile, onSignOut }) {
  const item = (fn) => () => onPick(fn);
  return (
    <div role="menu" className="absolute right-0 top-11 z-50 w-60 rounded-token-lg border border-black/[0.07] bg-white p-1.5 shadow-token-md">
      <div className="px-2.5 py-2">
        {userEmail && <div className="truncate text-[13px] font-semibold text-ink-primary" title={userEmail}>{userEmail}</div>}
        <div className="mt-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-ink-tertiary">
          <Icon name="shield" size={12} /> Super admin
        </div>
      </div>
      <div className="my-1 h-px bg-black/[0.07]" />
      {onSwitchToBusiness && (
        <button type="button" role="menuitem" onClick={item(onSwitchToBusiness)} className={`${MENU_ITEM} hover:text-ink-primary`}>
          <Icon name="store" /> Switch to my business
        </button>
      )}
      {onOpenProfile && (
        <button type="button" role="menuitem" onClick={item(onOpenProfile)} className={`${MENU_ITEM} hover:text-ink-primary`}>
          <Icon name="user" /> Profile
        </button>
      )}
      {onSignOut && (
        <>
          <div className="my-1 h-px bg-black/[0.07]" />
          <button type="button" role="menuitem" onClick={item(onSignOut)} className={`${MENU_ITEM} hover:text-brand-red`}>
            <Icon name="logout" /> Sign out
          </button>
        </>
      )}
    </div>
  );
}

// Avatar and its menu: who is signed in (and as what), the way back to the
// business, Profile and Sign out. Closes on an outside click or Escape.
function AccountMenu({ userEmail, profile, onSwitchToBusiness, onOpenProfile, onSignOut }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const photoUrl = profile?.photo_url || '';
  const initial = userEmail ? userEmail[0].toUpperCase() : '?';

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-surface-tertiary text-[12px] font-extrabold text-ink-secondary hover:bg-[#e7e5e1] transition-colors ${FOCUS}`}
      >
        {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> : initial}
      </button>
      {open && (
        <AccountMenuPanel
          userEmail={userEmail}
          onPick={(fn) => { setOpen(false); fn(); }}
          onSwitchToBusiness={onSwitchToBusiness}
          onOpenProfile={onOpenProfile}
          onSignOut={onSignOut}
        />
      )}
    </div>
  );
}

export default function AdminShell({
  section,
  onSection,
  onSwitchToBusiness,
  onOpenProfile,
  onSignOut,
  userEmail,
  profile,
  children,
}) {
  // Same fallback as AdminPage, so the highlighted tab is always the page shown.
  const current = isAdminSection(section) ? section : DEFAULT_ADMIN_SECTION;
  const group = adminGroupOf(current);
  const pick = (id) => onSection?.(id);

  // Last section opened in each group, for its tab. Kept in state for this
  // visit only: a fresh load starts each group at its first section.
  const [lastIn, setLastIn] = useState({});
  useEffect(() => {
    setLastIn((prev) => (prev[group.id] === current ? prev : { ...prev, [group.id]: current }));
  }, [group.id, current]);

  return (
    <div className="min-h-screen bg-surface-secondary">
      <header className="sticky top-0 z-50 bg-white border-b border-black/[0.07]">
        <div className="h-16 px-4 sm:px-8 flex items-center gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <a href={HQ_URL} aria-label="Back to Genius HQ" className={`inline-flex items-center rounded-token-md hover:opacity-80 transition-opacity ${FOCUS}`}>
              <img src={ACG_LOGO} alt="Auto Care Genius" className="h-7 w-auto" />
            </a>
            <span aria-hidden="true" className="hidden sm:block w-px h-6 bg-black/[0.07]" />
            <button
              type="button"
              onClick={() => pick(DEFAULT_ADMIN_SECTION)}
              className={`hidden sm:inline font-bold text-ink-primary text-[17px] tracking-[-0.5px] whitespace-nowrap rounded-token-md hover:opacity-80 transition-opacity ${FOCUS}`}
            >
              Genius <span className="text-brand-red">Websites</span>
            </button>
            {/* #cc0000 on #fff5f5 is 5.5:1. */}
            <span className="ml-1 inline-flex items-center rounded-full border border-brand-red/30 bg-brand-red-faint px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide leading-4 text-brand-red">
              Admin
            </span>
          </div>

          {/* w-max + mx-auto centres the row when it fits and starts it at
              the left when it doesn't (justify-center on a scrolling box
              would cut off the first tabs). */}
          <nav aria-label="Admin" className={`hidden lg:block flex-1 min-w-0 overflow-x-auto ${NO_SCROLLBAR}`}>
            <div className="flex items-center gap-1 w-max mx-auto">
              <Tabs currentGroup={group.id} lastIn={lastIn} onPick={pick} />
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {onSwitchToBusiness && (
              // Outlined like the "Genius HQ" button in Genius Calendar. Only
              // the icon between lg and xl, where the tabs need the room;
              // the avatar menu has the same action at every width.
              <button
                type="button"
                onClick={onSwitchToBusiness}
                aria-label="Switch to my business"
                title="Switch to my business"
                className={`hidden sm:inline-flex items-center gap-1.5 h-9 px-3 lg:px-2.5 xl:px-3 rounded-token-md border border-black/[0.10] text-[12px] font-semibold text-ink-secondary hover:bg-surface-secondary hover:text-ink-primary transition-colors ${FOCUS}`}
              >
                <Icon name="store" />
                <span className="lg:hidden xl:inline">Switch to my business</span>
              </button>
            )}
            <AccountMenu
              userEmail={userEmail}
              profile={profile}
              onSwitchToBusiness={onSwitchToBusiness}
              onOpenProfile={onOpenProfile}
              onSignOut={onSignOut}
            />
          </div>
        </div>

        {/* Below lg: the same tabs on their own row, scrolling sideways. */}
        <nav aria-label="Admin sections" className={`lg:hidden border-t border-black/[0.05] px-2 sm:px-6 overflow-x-auto ${NO_SCROLLBAR}`}>
          <div className="flex items-center gap-1 w-max h-11">
            <Tabs currentGroup={group.id} lastIn={lastIn} onPick={pick} />
          </div>
        </nav>

        <SubTabs group={group} current={current} onPick={pick} />
      </header>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

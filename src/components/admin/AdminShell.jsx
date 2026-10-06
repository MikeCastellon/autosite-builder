import { useEffect, useRef, useState } from 'react';
import { ADMIN_SECTIONS, DEFAULT_ADMIN_SECTION, isAdminSection } from '../../lib/adminWorkspace.js';

// The Admin workspace's frame, built like the other Genius apps' headers
// (Closeout, Routes, Forecast, Trends, Passwords): a white sticky bar with
// the ACG logo (back to Genius HQ), the "Genius Websites" wordmark, a flat
// row of text tabs with a black pill on the current one, and the account
// menu on the right. What says "admin" is the red Admin pill after the
// wordmark, the same spot Logistics and Vendors use for their context pill.
// No HelpChrome or "Need Assistance?": those are for customers.
//
// All eight tabs fit in the bar from xl (1280px). Below that they move to a
// second row that scrolls sideways, as Closeout's tabs do on small screens.

const ACG_LOGO = 'https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=200';
const HQ_URL = 'https://hq.autocaregenius.com';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2';
const TAB = 'shrink-0 whitespace-nowrap px-2.5 sm:px-3 py-1.5 rounded-token-md text-[13px] font-medium transition-colors';
const TAB_ON = 'bg-ink-primary text-white';
const TAB_OFF = 'text-ink-primary hover:bg-black/[0.04]';
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

// The tabs, shared by the bar (xl+) and the second row (below xl). On the
// scrolling row the current tab is brought to the middle, so a section
// opened from a link or a card is never hidden off the edge.
function Tabs({ current, onPick }) {
  const activeRef = useRef(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [current]);
  return ADMIN_SECTIONS.map((s) => {
    const on = s.id === current;
    return (
      <button
        key={s.id}
        ref={on ? activeRef : undefined}
        type="button"
        onClick={() => onPick(s.id)}
        aria-current={on ? 'page' : undefined}
        className={`${TAB} ${FOCUS} ${on ? TAB_ON : TAB_OFF}`}
      >
        {s.label}
      </button>
    );
  });
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
  const pick = (id) => onSection?.(id);

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
          <nav aria-label="Admin" className={`hidden xl:block flex-1 min-w-0 overflow-x-auto ${NO_SCROLLBAR}`}>
            <div className="flex items-center gap-1 w-max mx-auto">
              <Tabs current={current} onPick={pick} />
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {onSwitchToBusiness && (
              // Outlined like the "Genius HQ" button in Genius Calendar. Only
              // the icon between xl and 1440px, where the tabs need the room;
              // the avatar menu has the same action at every width.
              <button
                type="button"
                onClick={onSwitchToBusiness}
                aria-label="Switch to my business"
                title="Switch to my business"
                className={`hidden sm:inline-flex items-center gap-1.5 h-9 px-3 xl:px-2.5 min-[1440px]:px-3 rounded-token-md border border-black/[0.10] text-[12px] font-semibold text-ink-secondary hover:bg-surface-secondary hover:text-ink-primary transition-colors ${FOCUS}`}
              >
                <Icon name="store" />
                <span className="xl:hidden min-[1440px]:inline">Switch to my business</span>
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

        {/* Below xl: the same tabs on their own row, scrolling sideways. */}
        <nav aria-label="Admin sections" className={`xl:hidden border-t border-black/[0.05] px-2 sm:px-6 overflow-x-auto ${NO_SCROLLBAR}`}>
          <div className="flex items-center gap-1 w-max h-11">
            <Tabs current={current} onPick={pick} />
          </div>
        </nav>
      </header>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

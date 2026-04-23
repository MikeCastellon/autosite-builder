import { useState } from 'react';
import { canSeeBookingsNav } from '../../lib/subscriptionGating.js';

const ACG_LOGO = 'https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=200';

// Shared sticky header used across authenticated app pages (Dashboard, Bookings,
// Booking Settings, Admin). Renders the brand lockup, centered nav with the
// active page highlighted, and an account avatar/dropdown.
export default function AppHeader({
  active,                  // 'sites' | 'bookings' | 'admin' | 'profile'
  userEmail,
  profile,
  onMySites,
  onOpenBookings,
  onOpenAdmin,
  onOpenProfile,
  onSignOut,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const showBookingsNav = canSeeBookingsNav(profile);
  const isAdmin = !!profile?.is_super_admin;
  const initial = userEmail ? userEmail[0].toUpperCase() : '?';

  const navItems = [
    onMySites && { id: 'sites', label: 'Dashboard', onClick: onMySites },
    showBookingsNav && onOpenBookings && { id: 'bookings', label: 'Bookings', onClick: onOpenBookings },
    isAdmin && onOpenAdmin && { id: 'admin', label: 'Admin', onClick: onOpenAdmin },
  ].filter(Boolean);

  return (
    <>
      <header className="border-b border-black/[0.07] bg-white px-4 sm:px-8 flex items-center justify-between h-16 sticky top-0 z-50">
        <a
          href="https://www.autocaregenius.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5"
        >
          <img src={ACG_LOGO} alt="Auto Care Genius" className="h-7" />
          <div className="w-px h-6 bg-black/[0.07]" />
          <span className="font-bold text-[#1a1a1a] text-[17px] tracking-[-0.5px]">
            Genius <span className="text-[#cc0000]">Websites</span>
          </span>
        </a>

        <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1 text-[13px] font-medium">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                active === item.id
                  ? 'bg-[#1a1a1a] text-white'
                  : 'text-[#1a1a1a] hover:bg-black/[0.04]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex items-center">
          {userEmail && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                className="flex items-center gap-2 text-[13px] text-[#555] hover:text-[#1a1a1a] transition-colors font-medium"
                aria-label="Account menu"
              >
                <div className="w-8 h-8 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-[12px] font-bold">
                  {initial}
                </div>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-10 bg-white border border-black/[0.1] rounded-xl shadow-lg py-1.5 min-w-[200px] z-[100]">
                  <div className="px-4 py-2 text-[11px] text-[#888] border-b border-black/[0.05] truncate">{userEmail}</div>
                  {onOpenProfile && (
                    <button
                      onClick={() => { setDropdownOpen(false); onOpenProfile(); }}
                      className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#faf9f7] transition-colors font-medium ${
                        active === 'profile' ? 'text-[#1a1a1a] font-semibold' : 'text-[#1a1a1a]'
                      }`}
                    >
                      Profile
                    </button>
                  )}
                  {onSignOut && (
                    <button
                      onClick={() => { setDropdownOpen(false); onSignOut(); }}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-[#cc0000] hover:bg-[#faf9f7] transition-colors font-medium border-t border-black/[0.05] mt-1 pt-2.5"
                    >
                      Sign Out
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Open menu"
          className="md:hidden flex items-center justify-center w-10 h-10 text-[#1a1a1a] hover:bg-black/[0.04] rounded-lg transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {mobileOpen ? (
              <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            ) : (
              <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>
            )}
          </svg>
        </button>
      </header>

      {mobileOpen && (
        <div className="md:hidden border-b border-black/[0.07] bg-white shadow-sm px-4 py-3 sticky top-16 z-40">
          {userEmail && (
            <div className="flex items-center gap-3 pb-3 mb-2 border-b border-black/[0.05]">
              <div className="w-10 h-10 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-sm font-bold">
                {initial}
              </div>
              <div className="text-sm text-[#1a1a1a] font-medium truncate">{userEmail}</div>
            </div>
          )}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setMobileOpen(false); item.onClick(); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors ${
                  active === item.id ? 'bg-[#1a1a1a] text-white' : 'text-[#1a1a1a] hover:bg-black/[0.04]'
                }`}
              >
                {item.label}
              </button>
            ))}
            {onOpenProfile && (
              <button
                onClick={() => { setMobileOpen(false); onOpenProfile(); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors ${
                  active === 'profile' ? 'bg-[#1a1a1a] text-white' : 'text-[#1a1a1a] hover:bg-black/[0.04]'
                }`}
              >
                Profile
              </button>
            )}
            {onSignOut && (
              <button
                onClick={() => { setMobileOpen(false); onSignOut(); }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-[14px] font-medium text-[#cc0000] hover:bg-black/[0.04] transition-colors border-t border-black/[0.05] mt-1 pt-3"
              >
                Sign Out
              </button>
            )}
          </nav>
        </div>
      )}
    </>
  );
}

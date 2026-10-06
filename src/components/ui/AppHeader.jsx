import { useState } from 'react';
import { canSeeBookingsNav } from '../../lib/subscriptionGating.js';
import { openBillingPortal } from '../../lib/billingPortal.js';
import NeedAssistanceButton from './NeedAssistanceButton.jsx';
import { useAlert } from './AlertProvider.jsx';

const ACG_LOGO = 'https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=200';

// Shared sticky header of the business workspace (Overview, Sites, Bookings,
// ...): the app every owner sees. Renders the brand lockup, centered nav with
// the active page highlighted, and an account avatar/dropdown. Admin pages
// have their own shell (admin/AdminShell.jsx); super admins only get the
// "Admin" switch here (onSwitchToAdmin), kept apart from the nav items.
export default function AppHeader({
  active,                  // 'overview' | 'sites' | 'inquiries' | 'bookings' | 'customers' | 'charges' | 'payments-connect' | 'profile'
  userEmail,
  profile,
  onOpenOverview,
  onMySites,
  onOpenInquiries,
  onOpenBookings,
  onOpenCustomers,
  onOpenCharges,
  onCharge,
  onOpenPaymentsConnect,
  onSwitchToAdmin,
  onOpenProfile,
  onSignOut,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const { toast } = useAlert();
  const showBookingsNav = canSeeBookingsNav(profile);
  // Only Stripe-billed subscribers have a Customer Portal to manage; legacy
  // Shopify subscribers cancel via their Shopify receipt email instead.
  const hasBilling = !!profile?.stripe_customer_id;

  const handleManageBilling = async () => {
    if (billingBusy) return;
    setBillingBusy(true);
    try { await openBillingPortal(); }
    catch (e) { toast(e.message || 'Could not open billing — please try again.', 'error'); }
    finally { setBillingBusy(false); }
  };
  const isConnected = !!profile?.stripe_connect_charges_enabled;
  const initial = userEmail ? userEmail[0].toUpperCase() : '?';
  const photoUrl = profile?.photo_url || '';

  const navItems = [
    onOpenOverview && { id: 'overview', label: 'Overview', onClick: onOpenOverview },
    onMySites && { id: 'sites', label: 'Sites', onClick: onMySites },
    onOpenInquiries && { id: 'inquiries', label: 'Inquiries', onClick: onOpenInquiries },
    showBookingsNav && onOpenBookings && { id: 'bookings', label: 'Bookings', onClick: onOpenBookings },
    showBookingsNav && onOpenCustomers && { id: 'customers', label: 'Customers', onClick: onOpenCustomers },
    showBookingsNav && onOpenCharges && { id: 'charges', label: 'Charges', onClick: onOpenCharges },
    onOpenPaymentsConnect && { id: 'payments-connect', label: 'Payments', onClick: onOpenPaymentsConnect },
  ].filter(Boolean);

  // One flex row (brand | nav | actions) rather than a nav centred on top of
  // the row: with every item showing (seven for a Pro owner, plus the Admin
  // switch) a centred nav slid under the brand and the buttons on laptop
  // widths. Below lg the hamburger menu takes over; between lg and xl the
  // brand drops its wordmark and the Admin switch its label to make room.
  return (
    <>
      <header className="border-b border-black/[0.07] bg-white px-4 sm:px-8 flex items-center gap-4 h-16 sticky top-0 z-50">
        <a
          href="https://hq.autocaregenius.com"
          aria-label="Back to Genius HQ"
          className="flex items-center gap-2.5 shrink-0"
        >
          <img src={ACG_LOGO} alt="Auto Care Genius" className="h-7" />
          <div className="w-px h-6 bg-black/[0.07] lg:hidden xl:block" />
          <span className="font-bold text-[#1a1a1a] text-[17px] tracking-[-0.5px] whitespace-nowrap lg:hidden xl:inline">
            Genius <span className="text-[#cc0000]">Websites</span>
          </span>
        </a>

        <nav className="hidden lg:flex flex-1 min-w-0 justify-center items-center gap-1 text-[13px] font-medium">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`px-2.5 xl:px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                active === item.id
                  ? 'bg-[#1a1a1a] text-white'
                  : 'text-[#1a1a1a] hover:bg-black/[0.04]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3 shrink-0">
          {onSwitchToAdmin && <AdminSwitchButton onClick={onSwitchToAdmin} compact />}
          <NeedAssistanceButton />
          {userEmail && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                className="flex items-center gap-2 text-[13px] text-[#555] hover:text-[#1a1a1a] transition-colors font-medium"
                aria-label="Account menu"
              >
                <div className="w-8 h-8 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-[12px] font-bold overflow-hidden">
                  {photoUrl ? (
                    <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : initial}
                </div>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-10 bg-white border border-black/[0.1] rounded-xl shadow-lg py-1.5 min-w-[200px] z-[100]">
                  <div className="px-4 py-2 text-[11px] text-[#888] border-b border-black/[0.05] truncate">{userEmail}</div>
                  {onSwitchToAdmin && (
                    <button
                      onClick={() => { setDropdownOpen(false); onSwitchToAdmin(); }}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-[#1a1a1a] hover:bg-[#faf9f7] transition-colors font-semibold border-b border-black/[0.05]"
                    >
                      Switch to Admin
                    </button>
                  )}
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
                  {hasBilling && (
                    <button
                      onClick={() => { setDropdownOpen(false); handleManageBilling(); }}
                      disabled={billingBusy}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-[#1a1a1a] hover:bg-[#faf9f7] transition-colors font-medium disabled:opacity-50"
                    >
                      {billingBusy ? 'Opening billing...' : 'Manage billing'}
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
          className="lg:hidden ml-auto flex items-center justify-center w-10 h-10 text-[#1a1a1a] hover:bg-black/[0.04] rounded-lg transition-colors"
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
        <div className="lg:hidden border-b border-black/[0.07] bg-white shadow-sm px-4 py-3 sticky top-16 z-40">
          {userEmail && (
            <div className="flex items-center gap-3 pb-3 mb-2 border-b border-black/[0.05]">
              <div className="w-10 h-10 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-sm font-bold overflow-hidden">
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                ) : initial}
              </div>
              <div className="text-sm text-[#1a1a1a] font-medium truncate">{userEmail}</div>
            </div>
          )}
          <nav className="flex flex-col gap-1">
            {onSwitchToAdmin && (
              <button
                onClick={() => { setMobileOpen(false); onSwitchToAdmin(); }}
                className="w-full flex items-center justify-between px-3 py-2.5 mb-1 rounded-lg text-[14px] font-semibold border border-black/[0.10] text-ink-primary hover:bg-surface-secondary"
              >
                <span className="flex items-center gap-2"><ShieldIcon /> Switch to Admin</span>
                <span aria-hidden="true">→</span>
              </button>
            )}
            <div className="px-1 pb-1">
              <NeedAssistanceButton />
            </div>
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
            {hasBilling && (
              <button
                onClick={() => { setMobileOpen(false); handleManageBilling(); }}
                disabled={billingBusy}
                className="w-full text-left px-3 py-2.5 rounded-lg text-[14px] font-medium text-[#1a1a1a] hover:bg-black/[0.04] transition-colors disabled:opacity-50"
              >
                {billingBusy ? 'Opening billing...' : 'Manage billing'}
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

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

// Super admins only: the way into the Admin workspace. Outlined and set
// apart from the nav items, so it reads as "go somewhere else", not as one
// more page of this business; the Admin header has the same button the
// other way ("Switch to my business"). `compact` shows only the shield
// below xl, where the full business nav needs the room.
export function AdminSwitchButton({ onClick, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Switch to Admin"
      title="Switch to the Admin workspace"
      className={`inline-flex items-center gap-1.5 h-9 rounded-lg border border-black/[0.10] text-[12px] font-semibold text-ink-secondary hover:bg-surface-secondary hover:text-ink-primary whitespace-nowrap transition-colors ${compact ? 'px-2.5 xl:px-3' : 'px-3'}`}
    >
      <ShieldIcon />
      <span className={compact ? 'hidden xl:inline' : ''}>Admin</span>
    </button>
  );
}

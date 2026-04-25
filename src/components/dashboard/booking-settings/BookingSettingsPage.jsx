import SchedulerSettings from './SchedulerSettings.jsx';
import AppHeader from '../../ui/AppHeader.jsx';
import { useAuth } from '../../../lib/AuthContext.jsx';

export default function BookingSettingsPage({ siteId, onExit, onOpenBookings, onOpenCustomers, onOpenAdmin, onOpenProfile, onOpenPaymentsConnect, onSignOut }) {
  const { session, profile } = useAuth();
  const userEmail = session?.user?.email;

  const headerProps = {
    active: 'bookings',
    userEmail,
    profile,
    onMySites: onExit,
    onOpenBookings,
    onOpenCustomers,
    onOpenAdmin,
    onOpenProfile,
    onOpenPaymentsConnect,
    onSignOut,
  };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader {...headerProps} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="mb-8">
          <p className="text-[12px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-2">Bookings</p>
          <h2 className="text-[clamp(24px,3.5vw,32px)] font-[900] text-[#1a1a1a] tracking-[-1px] leading-[1.1] mb-2">
            Configure your booking flow
          </h2>
          <p className="text-[#666] text-[15px] leading-[1.6] max-w-2xl">
            Control when the "Book Now" button is live, what services customers can book, your availability, and the look of the modal.
          </p>
        </div>

        <SchedulerSettings siteId={siteId} />
      </main>
    </div>
  );
}

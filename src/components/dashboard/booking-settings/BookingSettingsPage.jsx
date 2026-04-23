import SchedulerSettings from './SchedulerSettings.jsx';

export default function BookingSettingsPage({ siteId, onExit }) {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-black/[0.07] bg-white px-4 sm:px-8 h-16 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:border-[#cc0000] hover:bg-[#cc0000] hover:text-white active:scale-[0.98] transition-all shrink-0 shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">Back to dashboard</span>
            <span className="sm:hidden">Back</span>
          </button>
        </div>
        <h1 className="text-[15px] sm:text-[17px] font-black text-[#1a1a1a] tracking-[-0.3px]">Booking Settings</h1>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-10">
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

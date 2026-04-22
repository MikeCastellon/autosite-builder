import SchedulerSettings from './SchedulerSettings.jsx';

export default function BookingSettingsPage({ siteId, onExit }) {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-black/[0.07] bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-black text-[#1a1a1a]">Booking Settings</h1>
        <button onClick={onExit} className="text-sm text-gray-500 hover:text-[#1a1a1a]">← Back to dashboard</button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <SchedulerSettings siteId={siteId} />
      </main>
    </div>
  );
}

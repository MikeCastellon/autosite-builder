const ALL_STATUSES = ['pending','confirmed','declined','completed','cancelled'];

export default function BookingFilters({ statusIn, onStatusIn, search, onSearch }) {
  function toggle(s) {
    if (statusIn.includes(s)) onStatusIn(statusIn.filter((x) => x !== s));
    else onStatusIn([...statusIn, s]);
  }
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {ALL_STATUSES.map((s) => {
        const on = statusIn.includes(s);
        return (
          <button
            key={s}
            onClick={() => toggle(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${on ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
          >
            {s}
          </button>
        );
      })}
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search name or email"
        className="ml-auto w-56 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
      />
    </div>
  );
}

export default function ProgressBar({ step, labels }) {
  const total = labels.length;

  return (
    <div className="w-full">
      {/* Step dots */}
      <div className="flex items-center justify-between relative">
        {/* connecting line */}
        <div className="absolute top-3 left-0 right-0 h-px bg-gray-800 z-0" />
        <div
          className="absolute top-3 left-0 h-px bg-blue-500 z-0 transition-all duration-500"
          style={{ width: `${((step - 1) / (total - 1)) * 100}%` }}
        />
        {labels.map((label, i) => {
          const num = i + 1;
          const done = num < step;
          const active = num === step;
          return (
            <div key={label} className="flex flex-col items-center z-10">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                  ${done ? 'bg-blue-500 text-white' : active ? 'bg-blue-500 text-white ring-4 ring-blue-500/30' : 'bg-gray-800 text-gray-500'}`}
              >
                {done ? '✓' : num}
              </div>
              <span className={`mt-1.5 text-[10px] hidden sm:block font-medium transition-colors
                ${active ? 'text-blue-400' : done ? 'text-gray-400' : 'text-gray-600'}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

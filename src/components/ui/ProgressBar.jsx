export default function ProgressBar({ step, labels }) {
  const total = labels.length;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        {/* Background track */}
        <div className="absolute top-[11px] left-0 right-0 h-px bg-black/[0.07] z-0" />
        {/* Filled track */}
        <div
          className="absolute top-[11px] left-0 h-px z-0 transition-all duration-500"
          style={{ width: `${((step - 1) / (total - 1)) * 100}%`, background: '#cc0000' }}
        />
        {labels.map((label, i) => {
          const num = i + 1;
          const done = num < step;
          const active = num === step;
          return (
            <div key={label} className="flex flex-col items-center z-10">
              <div
                className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-semibold transition-all duration-300 border
                  ${done
                    ? 'border-[#cc0000] text-white'
                    : active
                      ? 'bg-white border-[#cc0000] text-[#cc0000] shadow-sm'
                      : 'bg-white border-black/[0.12] text-[#888]'}`}
                style={done ? { background: '#cc0000', borderColor: '#cc0000' } : {}}
              >
                {done
                  ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : num}
              </div>
              <span className={`mt-1.5 text-[10px] hidden sm:block font-medium transition-colors whitespace-nowrap tracking-wide
                ${active ? 'text-[#1a1a1a]' : done ? 'text-[#cc0000]' : 'text-[#888]'}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

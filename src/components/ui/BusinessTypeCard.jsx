// SVG icons for each business type — no emojis
const ICONS = {
  detailing_shop: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M3 13l2-5h12l2 5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="2" y="13" width="18" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="6.5" cy="17.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="15.5" cy="17.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 8V5M11 8V4M14 8V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  mobile_detailing: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M1 14l3-7h14l3 7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="1" y="14" width="20" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="5.5" cy="18.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="16.5" cy="18.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 14V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M15 14V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M9 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  wheel_shop: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="11" cy="11" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M11 2v6M11 14v6M2 11h6M14 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  tint_shop: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="5" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3 9h16" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 5V4M15 5V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6 12h4M12 12h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/>
      <path d="M6 14.5h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.4"/>
    </svg>
  ),
  mechanic_shop: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M14.5 2.5a4 4 0 0 1 0 5.66l-8.5 8.5a2 2 0 1 1-2.83-2.83l8.5-8.5A4 4 0 0 1 14.5 2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M17 6l-1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="4.5" cy="17.5" r="1" fill="currentColor"/>
    </svg>
  ),
};

export default function BusinessTypeCard({ type, onClick }) {
  return (
    <button
      onClick={() => onClick(type.id)}
      className="group relative flex items-center gap-4 p-5 rounded-xl border border-gray-200 bg-white hover:border-gray-900 hover:shadow-sm transition-all duration-150 text-left cursor-pointer w-full"
    >
      {/* Icon box */}
      <div className="w-11 h-11 rounded-lg bg-gray-100 group-hover:bg-gray-900 group-hover:text-white text-gray-500 flex items-center justify-center transition-all duration-150 shrink-0">
        {ICONS[type.id]}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-[15px] leading-tight">{type.label}</p>
        <p className="text-gray-400 text-[13px] mt-0.5 leading-snug">{type.description}</p>
      </div>

      {/* Arrow */}
      <svg
        className="text-gray-300 group-hover:text-gray-900 transition-colors shrink-0"
        width="16" height="16" viewBox="0 0 16 16" fill="none"
      >
        <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

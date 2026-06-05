const STYLES = {
  new:      { bg: 'bg-amber-50', fg: 'text-amber-700', border: 'border-amber-200', label: 'New' },
  read:     { bg: 'bg-blue-50',  fg: 'text-blue-700',  border: 'border-blue-200',  label: 'Read' },
  archived: { bg: 'bg-gray-100', fg: 'text-gray-500',  border: 'border-gray-200',  label: 'Archived' },
};

export default function InquiryStatusPill({ status, className = '' }) {
  const s = STYLES[status] || STYLES.new;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.bg} ${s.fg} ${s.border} ${className}`}
    >
      {s.label}
    </span>
  );
}

const STYLES = {
  pending:   { bg: 'bg-amber-50',  fg: 'text-amber-700',  border: 'border-amber-200',  label: 'Pending' },
  confirmed: { bg: 'bg-green-50',  fg: 'text-green-700',  border: 'border-green-200',  label: 'Confirmed' },
  declined:  { bg: 'bg-gray-100',  fg: 'text-gray-500',   border: 'border-gray-200',   label: 'Declined', strike: true },
  completed: { bg: 'bg-blue-50',   fg: 'text-blue-700',   border: 'border-blue-200',   label: 'Completed' },
  cancelled: { bg: 'bg-gray-100',  fg: 'text-gray-500',   border: 'border-gray-200',   label: 'Cancelled' },
};

export default function StatusPill({ status, className = '' }) {
  const s = STYLES[status] || STYLES.pending;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.bg} ${s.fg} ${s.border} ${s.strike ? 'line-through' : ''} ${className}`}
    >
      {s.label}
    </span>
  );
}

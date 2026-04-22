// src/components/help/HelpButton.jsx
export default function HelpButton({ open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? 'Close help' : 'Open help'}
      aria-expanded={open}
      className="fixed bottom-6 right-6 z-[60] w-12 h-12 rounded-full bg-[#cc0000] text-white font-semibold text-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:bg-[#b30000] transition-colors duration-150 flex items-center justify-center"
      style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
    >
      {open ? '×' : '?'}
    </button>
  );
}

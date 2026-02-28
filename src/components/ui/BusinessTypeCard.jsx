export default function BusinessTypeCard({ type, onClick }) {
  return (
    <button
      onClick={() => onClick(type.id)}
      className="group relative flex flex-col items-center gap-3 p-6 rounded-2xl border border-gray-700 bg-gray-900 hover:border-blue-500 hover:bg-gray-800 transition-all duration-200 text-center cursor-pointer"
    >
      <span className="text-4xl">{type.icon}</span>
      <div>
        <p className="font-semibold text-white text-base group-hover:text-blue-400 transition-colors">{type.label}</p>
        <p className="text-gray-500 text-sm mt-0.5">{type.description}</p>
      </div>
      <span className="absolute top-3 right-3 text-gray-700 group-hover:text-blue-500 transition-colors text-sm">→</span>
    </button>
  );
}

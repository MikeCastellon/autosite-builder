import { BUSINESS_TYPES } from '../../data/businessTypes.js';
import BusinessTypeCard from '../ui/BusinessTypeCard.jsx';

export default function StepBusinessType({ onSelect }) {
  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Step 1 of 5</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">What type of business do you run?</h1>
        <p className="text-gray-500 text-[15px]">
          We'll select the right templates and write copy specific to your industry.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {BUSINESS_TYPES.map((type) => (
          <BusinessTypeCard key={type.id} type={type} onClick={onSelect} />
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center mt-8">
        Free · No account required · Download in minutes
      </p>
    </div>
  );
}

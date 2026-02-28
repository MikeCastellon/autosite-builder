import { BUSINESS_TYPES } from '../../data/businessTypes.js';
import BusinessTypeCard from '../ui/BusinessTypeCard.jsx';

export default function StepBusinessType({ onSelect }) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">What kind of business do you run?</h1>
        <p className="text-gray-400">We'll pick the best templates and copy for your industry.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {BUSINESS_TYPES.map((type) => (
          <BusinessTypeCard key={type.id} type={type} onClick={onSelect} />
        ))}
      </div>
    </div>
  );
}

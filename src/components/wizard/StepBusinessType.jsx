import { BUSINESS_TYPES } from '../../data/businessTypes.js';
import BusinessTypeCard from '../ui/BusinessTypeCard.jsx';

export default function StepBusinessType({ onSelect }) {
  return (
    <div>
      <div className="mb-8">
        <p className="text-[12px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-3">Step 1 of 5</p>
        <h1 className="text-[clamp(24px,4vw,32px)] font-[900] text-[#1a1a1a] mb-2 tracking-[-1px] leading-[1.1]">What type of business do you run?</h1>
        <p className="text-[#555] text-[15px]">
          We'll select the right templates and write copy specific to your industry.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {BUSINESS_TYPES.map((type) => (
          <BusinessTypeCard key={type.id} type={type} onClick={onSelect} />
        ))}
      </div>

    </div>
  );
}

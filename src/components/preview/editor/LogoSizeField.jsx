// Edit > Hero > Logo size: a slider for copy.logoSize, the menu-bar logo
// at 80-200% of the design's own size (kit/logoSize.js). Shown only for a
// template that reads it (editorCapabilities: logoSize) and only once there
// is a logo to size. Back at 100% it saves null, which every reader takes
// as the design's own size.
import { Label, Help, linkButtonClass } from './fields.jsx';
import { LOGO_SIZE, logoSizeOf, logoSizeValue } from '../templates/kit/logoSize.js';

export function LogoSizeField({ value, onChange }) {
  const pct = logoSizeOf(value);
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between">
        <Label htmlFor="logo-size">Logo size</Label>
        <span className="text-[12px] font-medium tabular-nums text-gray-700">{pct}%</span>
      </div>
      <input
        id="logo-size"
        type="range"
        min={LOGO_SIZE.min}
        max={LOGO_SIZE.max}
        step={LOGO_SIZE.step}
        value={pct}
        onChange={(e) => onChange(logoSizeValue(Number(e.target.value)))}
        aria-valuetext={`${pct}%`}
        className="w-full accent-gray-900 cursor-pointer"
      />
      <div className="flex items-start justify-between gap-3">
        <Help>How big the logo shows in the menu bar, which grows to fit it. On phones it stops at the size that still fits beside Book Now.</Help>
        {pct !== LOGO_SIZE.base && (
          <button type="button" className={`${linkButtonClass} mt-1 shrink-0`} onClick={() => onChange(null)}>Reset</button>
        )}
      </div>
    </div>
  );
}

export default LogoSizeField;

// Edit > Hero > Services in the hero. The template reads copy.heroCard
// ('quote' price card, 'list' price list, 'off' none) and copy.heroServices
// (service names in the owner's order, at most 4; unset = the first 3
// services with a price). Mounted at the bottom of the Hero tab for
// templates that read those keys (editorCapabilities 'heroServices').
import { formatPrice } from '../../../lib/formatPrice.js';
import { Label, Help, Toggle, MoveButtons, linkButtonClass } from './fields.jsx';
import { serviceList, nameKey } from './serviceRefs.js';
import { HERO_CARD_MODES, MAX_HERO_SERVICES, heroCardMode, heroSelection, toggleHeroService, moveHeroService, removeStaleName, unpricedPicks } from './heroServices.js';

const MODE_OPTIONS = [
  { value: 'quote', label: 'Price card' },
  { value: 'list', label: 'Price list' },
  { value: 'off', label: 'None' },
];

const MODE_HELP = {
  quote: 'Visitors pick a package, see its price and book it.',
  list: 'A short list of packages with their prices beside your headline.',
  off: 'No services in the hero: your headline uses the full width.',
};

export function HeroServicesPanel({ copy, setCopy, businessInfo }) {
  const services = serviceList(businessInfo, copy);
  const mode = heroCardMode(copy);
  const selection = heroSelection(copy, services);
  const { names, automatic, stale } = selection;
  const pickedKeys = names.map(nameKey);
  const unpriced = new Set(unpricedPicks(selection, services).map(nameKey));
  const full = names.length >= MAX_HERO_SERVICES;

  // Picked services first, in their order, then the others in the
  // Services tab's order (one row per name).
  const byKey = new Map();
  for (const s of services) {
    const k = nameKey(s.name);
    if (k && !byKey.has(k)) byKey.set(k, s);
  }
  const rows = [
    ...pickedKeys.map((k) => byKey.get(k)).filter(Boolean),
    ...[...byKey.entries()].filter(([k]) => !pickedKeys.includes(k)).map(([, s]) => s),
  ];

  // One write per action: the whole list (null = automatic).
  const writeNames = (next) => setCopy('heroServices', next);

  return (
    <div className="mb-2">
      <Label>Services in the hero</Label>
      <Toggle value={mode} onChange={(v) => setCopy('heroCard', HERO_CARD_MODES.includes(v) ? v : 'quote')} options={MODE_OPTIONS} />
      <Help className="-mt-2 mb-3">{MODE_HELP[mode]}</Help>

      {mode !== 'off' && (
        services.length === 0 ? (
          <Help className="mb-3">Add services in the Services tab first.</Help>
        ) : (
          <>
            {automatic && names.length === 0 ? (
              // Price card, and no service has a number in its price: the
              // hero shows no card at all, which the owner should know.
              <Help tone="warn" className="mb-2">None of your services has a price yet, so no price card shows. Add prices in Services, or pick Price list.</Help>
            ) : (
              <Help className="mb-2">
                {!automatic
                  ? 'Shown in this order, up to 4.'
                  : services.some((s) => /\d/.test(s.price))
                    ? 'Showing your first 3 services with a price. Tick the ones you want (up to 4).'
                    : 'Showing your first 3 services. Tick the ones you want (up to 4).'}
              </Help>
            )}
            <div className="mb-2 border border-gray-100 rounded-lg divide-y divide-gray-100">
              {rows.map((s) => {
                const k = nameKey(s.name);
                const pos = pickedKeys.indexOf(k);
                const picked = pos >= 0;
                const price = /\S/.test(s.price) ? formatPrice(s.price) : '';
                return (
                  <div key={k} className="flex items-start gap-2 px-2.5 py-2">
                    <label className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 shrink-0 accent-gray-900"
                        checked={picked}
                        disabled={!picked && full}
                        onChange={(e) => writeNames(toggleHeroService(copy, services, s.name, e.target.checked))}
                        aria-label={`Show ${s.name} in the hero`}
                      />
                      {picked && <span className="text-[11px] font-semibold text-gray-400 tabular-nums w-3 shrink-0 mt-px">{pos + 1}</span>}
                      {/* Name and price on their own lines: side by side, a
                          long price ("Call for quote") left the name a column
                          one letter wide in this ~150px space. */}
                      <div className="flex-1 min-w-0">
                        <span className={`block text-[13px] leading-snug break-words ${!picked && full ? 'text-gray-400' : 'text-gray-800'}`}>{s.name}</span>
                        <span className={`block text-[12px] leading-snug tabular-nums break-words ${price ? 'text-gray-600' : 'text-gray-400'}`}>{price || 'no price'}</span>
                        <p className="text-[11px] text-gray-500 leading-snug">
                          {s.summary || 'No summary: add one in Services > Package details'}
                        </p>
                        {picked && mode === 'quote' && unpriced.has(k) && (
                          <Help tone="warn">No price, so the price card skips it.</Help>
                        )}
                      </div>
                    </label>
                    {picked && (
                      <div className="flex shrink-0">
                        <MoveButtons index={pos} count={names.length} onMove={(from, to) => writeNames(moveHeroService(copy, services, from, to))} label={s.name} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )
      )}

      {stale.map((name) => (
        <p key={`stale-${nameKey(name)}`} className="mb-1.5 text-[11px] leading-snug text-amber-700">
          No longer in your services: {name}{' '}
          <button type="button" className={linkButtonClass} onClick={() => writeNames(removeStaleName(copy, name))}>Remove</button>
        </p>
      ))}

      {!automatic && (
        <button type="button" className={linkButtonClass} onClick={() => writeNames(null)}>Back to automatic</button>
      )}
    </div>
  );
}

export default HeroServicesPanel;

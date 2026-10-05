import { useId, useState } from 'react';
import {
  BTN, BTN_SMALL, PALETTE_ROLES, brandAccentFor, effectivePalette, hasPalettePicks, normalizeHex,
  readabilityNote, readabilityRows, repairsContrast, resetPaletteRole, setPaletteRole,
} from './studioFields.js';

// Design Studio: the five color roles every template paints with, picked
// over the template's own colors, with a live readability check.
//
// Controlled over levers.palette:
//   value      { bg?, secondary?, text?, muted?, accent? } ('#rrggbb'; only
//              the roles the admin set; a missing role keeps the template's)
//   onChange   (nextPalette) => void
//   templateId the chosen template: only the theme-ready ones repair low
//              contrast on their own (repairsContrast), so the readability
//              check says "Auto-fixed" for those alone
//   defaults   the template's colors (TEMPLATES[id].colors)
//   brandHexes the customer's brand colors from the intake, for the
//              "Use their brand colors" helper (hidden when empty)

const STATUS = {
  pass: { text: 'OK', className: 'bg-emerald-50 text-emerald-800' },
  adjusted: { text: 'Auto-fixed', className: 'bg-amber-50 text-amber-900' },
  fail: { text: 'Low contrast', className: 'bg-[#fff5f5] text-[#cc0000]' },
};

export default function PaletteField({ value, onChange, templateId, defaults, brandHexes = [] }) {
  const palette = value || {};
  const colors = effectivePalette(palette, defaults);
  const repairs = repairsContrast(templateId);
  const rows = readabilityRows(palette, defaults, { repairs });
  const hexes = [...new Set((Array.isArray(brandHexes) ? brandHexes : []).map(normalizeHex).filter(Boolean))];
  const brand = hexes.length ? brandAccentFor(palette, defaults, hexes) : '';
  const brandInUse = !!brand && colors.accent === brand;

  return (
    <div>
      <ul className="divide-y divide-black/[0.06]">
        {PALETTE_ROLES.map(({ role, label, hint }) => (
          <RoleRow
            key={role}
            label={label}
            hint={hint}
            color={colors[role]}
            custom={!!normalizeHex(palette[role])}
            onPick={(hex) => onChange(setPaletteRole(palette, role, hex))}
            onReset={() => onChange(resetPaletteRole(palette, role))}
          />
        ))}
      </ul>

      {hasPalettePicks(palette) && (
        <button type="button" onClick={() => onChange({})} className={`${BTN_SMALL} mt-2`}>
          Reset all colors to the template's
        </button>
      )}

      {hexes.length > 0 && (
        <div className="mt-4 rounded-xl bg-[#faf9f7] border border-black/[0.06] px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[12px] font-semibold text-[#1a1a1a]">Their brand colors</span>
            <ul className="flex gap-1.5" aria-label="Their brand colors">
              {hexes.map((h) => (
                <li key={h} title={h} className="w-5 h-5 rounded border border-black/15" style={{ background: h }}>
                  <span className="sr-only">{h}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onChange(setPaletteRole(palette, 'accent', brand))}
              disabled={!brand || brandInUse}
              className={`${BTN} sm:ml-auto`}
            >
              Use their brand colors
            </button>
          </div>
          <p className="mt-1.5 text-[12px] text-[#4a4a4a]">
            {!brand
              ? 'None of their colors works as a highlight on this background (too close to it, or a neutral). Pick an accent by hand.'
              : brandInUse
                ? `In use: the accent is their ${brand}${hexes.includes(brand) ? '' : ' (adjusted)'}.`
                : hexes.includes(brand)
                  ? `Sets the accent to their ${brand}.`
                  : `Sets the accent to ${brand}: their color, adjusted just enough to stand out on this background.`}
          </p>
        </div>
      )}

      <div className="mt-5">
        <p className="text-[12px] font-semibold text-[#1a1a1a]">Readability</p>
        <p className="text-[11px] text-ink-tertiary">Text needs 4.5:1 against what it sits on; buttons and highlights need 3:1 against the page.</p>
        {!repairs && (
          <p className="mt-1 text-[11px] text-amber-800">
            This template paints these colors exactly as picked and sets its own button text color, so nothing low-contrast gets fixed. Check the buttons in the preview.
          </p>
        )}
        <ul className="mt-2 space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-2.5">
              <span
                aria-hidden="true"
                className="shrink-0 w-12 h-8 rounded-md border border-black/10 flex items-center justify-center text-[14px] font-bold"
                style={{ background: r.shown.bg, color: r.shown.fg }}
              >
                {r.id === 'accent' ? <span className="block w-7 h-3 rounded-sm" style={{ background: r.shown.fg }} /> : 'Aa'}
              </span>
              <span className="min-w-0 text-[12px] leading-snug">
                <span className="font-semibold text-[#1a1a1a]">{r.label}</span>
                <span className={`ml-2 inline-flex px-1.5 py-px rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS[r.status].className}`}>
                  {STATUS[r.status].text}
                </span>
                <span className="block text-[#4a4a4a]">{readabilityNote(r)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RoleRow({ label, hint, color, custom, onPick, onReset }) {
  const id = useId();
  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5" role="group" aria-labelledby={`${id}-name`}>
        <div className="min-w-0 flex-1 basis-40">
          <p className="text-[13px] font-semibold text-[#1a1a1a]">
            <span id={`${id}-name`}>{label}</span>
            <span className={`ml-2 inline-flex px-1.5 py-px rounded-full text-[10px] font-bold uppercase tracking-wide ${custom ? 'bg-[#cc0000]/[0.08] text-[#cc0000]' : 'bg-black/[0.05] text-ink-tertiary'}`}>
              {custom ? 'Custom' : 'Template'}
            </span>
          </p>
          <p className="text-[11px] text-ink-tertiary">{hint}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => onPick(e.target.value)}
            aria-label={`${label} color`}
            className="w-10 h-10 shrink-0 rounded-lg border border-black/[0.12] bg-white p-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40"
          />
          <HexInput value={color} label={`${label} hex code`} onCommit={onPick} />
          <button type="button" onClick={onReset} disabled={!custom} className={BTN_SMALL} aria-label={`Reset ${label} to the template's color`}>
            Reset
          </button>
        </div>
      </div>
    </li>
  );
}

// A hex box that lets the admin type freely: it passes a color on as soon
// as the text is one ('#abc' counts), and goes back to the current color
// when they leave it half-typed.
function HexInput({ value, label, onCommit }) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  // A pick from the swatch (or a reset) replaces what is typed, unless
  // the typed text already is that color.
  if (value !== seen) {
    setSeen(value);
    if (normalizeHex(draft) !== value) setDraft(value);
  }
  const invalid = draft.trim() !== '' && !normalizeHex(draft);
  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        const hex = normalizeHex(e.target.value);
        if (hex && hex !== value) onCommit(hex);
      }}
      onBlur={() => setDraft(value)}
      aria-label={label}
      aria-invalid={invalid || undefined}
      maxLength={9}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      className={`w-[104px] px-3 py-2 rounded-lg border text-sm font-mono bg-white focus:outline-none focus:border-[#cc0000] ${invalid ? 'border-[#cc0000]' : 'border-black/[0.12]'}`}
    />
  );
}

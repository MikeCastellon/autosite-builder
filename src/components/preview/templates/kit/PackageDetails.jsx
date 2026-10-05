// Package-card details (Edit > Services > Package details), Redline's markup
// shared by every theme that offers them: the badge ("Most Popular"), the
// package photo and the "See What's Included" list. Each part renders only
// what the owner set; the template decides where it sits in its own card.
// Every class is `${ns}-<name>`: Redline passes ns="rl" (its own CSS styles
// them); other themes pass "<prefix>-pk" and append packageDetailsCss(ns)
// while any card shows a detail. No hooks: the editor flag comes in as a prop.
import { PhotoSlot } from './PhotoSlot.jsx';
import { LucideIcon as Icon } from './icons.jsx';

export function PackageBadge({ ns, text }) {
  return <span className={`${ns}-badge`}>{text}</span>;
}

// The package photo. With no photo on any package: nothing. Once one package
// has a photo, the others keep the same space so rows stay level: the editor
// marks the empty slot (where to upload), the published page shows a quiet
// car mark in an empty well (.<ns>-card-well, which the theme shows only where
// cards share a row).
export function PackagePhoto({ ns, src, alt, anyPhoto, editor }) {
  if (src) {
    return (
      <div className={`${ns}-card-photo`}>
        <PhotoSlot src={src} alt={alt} style={{ height: 'auto' }} />
      </div>
    );
  }
  if (!anyPhoto) return null;
  if (editor) {
    return (
      <div className={`${ns}-card-photo`}>
        <PhotoSlot slot="service" style={{ aspectRatio: '4 / 3' }} />
      </div>
    );
  }
  return <div className={`${ns}-card-photo ${ns}-card-well`} aria-hidden="true"><Icon name="car" size={40} stroke={1.5} /></div>;
}

// items: kit/content.js serviceIncludes() output, [{ text, heading,
// highlight }] (a heading is a group title like "Interior:"; highlight marks
// what this package adds). An open <details>, so the list needs no script.
export function PackageIncludes({ ns, items, label = "See What's Included", checkStroke = 3 }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <details className={`${ns}-inc`} open>
      <summary>{label}<Icon name="chevronUp" className={`${ns}-chev`} /></summary>
      <ul>
        {list.map((it, k) => (it.heading ? (
          <li key={k} className={`${ns}-inc-h`}>{it.text}</li>
        ) : (
          <li key={k} className={`${ns}-inc-i`}>
            <Icon name="check" stroke={checkStroke} />
            <span className={it.highlight ? `${ns}-inc-hl` : undefined}>{it.text}</span>
          </li>
        )))}
      </ul>
    </details>
  );
}

// CSS for a theme other than Redline (Redline's rules, `rl-` -> `${ns}-`).
// The badge is an inline block the theme places (Redline pins its own to the
// card's top edge); the photo well is hidden until the theme shows it
// (`.xx-cards .xx-pk-card-well{display:flex}` where cards share a row).
// Block variables (fallbacks in parentheses):
//   --ns-text / -accent / -line         list text, check marks + summary, rule
//   --ns-badge-bg / -badge-text         the badge
//   --ns-well-bg / -well-ink            the photo slot's backdrop / the car mark
//   --ns-r (6px) photo radius   --ns-r-badge (4px)   --ns-head (inherit) group
//   headings   --ns-case (uppercase)   --ns-focus (accent)
export function packageDetailsCss(ns) {
  const p = `.${ns}`;
  const v = (name, fb) => (fb === undefined ? `var(--${ns}-${name})` : `var(--${ns}-${name},${fb})`);
  const tcase = v('case', 'uppercase');
  return `
${p}-badge{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:top;padding:6px 16px;border-radius:${v('r-badge', '4px')};background:${v('badge-bg')};color:${v('badge-text')};font-size:12px;line-height:16px;font-weight:700;text-transform:${tcase}}
${p}-card-photo{overflow:hidden;margin-bottom:28px;border-radius:${v('r', '6px')};background:${v('well-bg')}}
${p}-card-photo img{aspect-ratio:4/3}
${p}-card-well{display:none;align-items:center;justify-content:center;aspect-ratio:4/3;color:${v('well-ink')}}
${p}-inc{margin-top:24px;padding-top:16px;border-top:1px solid ${v('line')};text-align:left}
${p}-inc>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;list-style:none;cursor:pointer;text-align:center;font-size:14px;line-height:20px;font-weight:700;letter-spacing:.18em;text-transform:${tcase};color:${v('accent')}}
${p}-inc>summary::-webkit-details-marker{display:none}
${p}-inc>summary::marker{content:''}
${p}-inc>summary:focus-visible{outline:2px solid ${v('focus', v('accent'))};outline-offset:3px}
${p}-inc:not([open]) ${p}-chev{transform:rotate(180deg)}
${p}-inc ul{display:flex;flex-direction:column;gap:14px;margin:20px 0 0;padding:0;list-style:none}
${p}-inc-h{padding-top:4px;font-family:${v('head', 'inherit')};font-size:16px;line-height:24px;font-weight:700;letter-spacing:.025em;text-transform:${tcase};color:${v('text')}}
${p}-inc-h:first-child{padding-top:0}
${p}-inc-i{display:flex;align-items:flex-start;gap:12px;font-size:15px;line-height:20.625px;font-weight:500;color:${v('text')}}
${p}-inc-i svg{flex:none;margin-top:2px;color:${v('accent')}}
${p}-inc-hl{font-weight:600;color:${v('accent')}}
@media (prefers-reduced-motion:no-preference){
${p}-chev{transition:transform .2s cubic-bezier(.4,0,.2,1)}
}
`;
}

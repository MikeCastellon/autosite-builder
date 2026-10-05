// The featured-service band's body (Edit > Featured Service), Redline's
// markup shared by every theme that offers it: an optional photo beside the
// copy, the theme's own heading, an intro line, the price, the benefit list,
// then the theme's own button and editor hints. The template renders the
// <section data-section="featured"> around it and decides whether the band
// shows (features.js featuredServiceOf / featuredHasBody).
// Every class is `${ns}-<name>`: Redline passes ns="rl" (its own CSS styles
// them); other themes pass "<prefix>-ft" and append featuredBandCss(ns)
// while the band renders. No hooks, no browser globals.
import { PhotoSlot } from './PhotoSlot.jsx';
import { LucideIcon as Icon } from './icons.jsx';

// heading / button / hints: nodes the template renders in its own style
// (eyebrow + <h2>; an <a> that books or follows buttonUrl; <EditorOnly> hints).
// "Starting at " (fromLabel) only before a number: "Call for quote" reads as
// written. Without a photo the band is one centered column (<ns>-feat-solo),
// in the editor too.
export function FeaturedBand({
  ns, image, alt, heading, intro, priceFrom, price, bullets, button, hints,
  fromLabel = 'Starting at ', photoStyle = { height: 'auto', aspectRatio: '3 / 4' }, checkSize = 20,
}) {
  const list = Array.isArray(bullets) ? bullets : [];
  return (
    <div className={`${ns}-in ${ns}-feat-grid${image ? ` ${ns}-duo` : ` ${ns}-feat-solo`}`}>
      {image && (
        <div className={`${ns}-feat-photo`}>
          <PhotoSlot src={image} alt={alt} style={photoStyle} />
        </div>
      )}
      <div>
        {heading}
        {intro && <p className={`${ns}-feat-price`}>{intro}</p>}
        {priceFrom ? (
          <p className={`${ns}-feat-price`}>{/\d/.test(priceFrom) && fromLabel}<strong>{priceFrom}</strong></p>
        ) : price && <p className={`${ns}-feat-price`}><strong>{price}</strong></p>}
        {list.length > 0 && (
          <ul className={`${ns}-feat-list`}>
            {list.map((b, i) => <li key={i}><Icon name="check" size={checkSize} />{b}</li>)}
          </ul>
        )}
        {button}
        {hints}
      </div>
    </div>
  );
}

// CSS for a theme other than Redline (Redline's rules, `rl-` -> `${ns}-`).
// The theme styles the section, the heading and the button itself.
// Block variables (fallbacks in parentheses):
//   --ns-text / -muted / -accent    strong price + list / intro + price line / checks
//   --ns-r (6px) photo radius   --ns-photo-max (320px)   --ns-max (1280px) band width
export function featuredBandCss(ns) {
  const p = `.${ns}`;
  const v = (name, fb) => (fb === undefined ? `var(--${ns}-${name})` : `var(--${ns}-${name},${fb})`);
  return `
${p}-in{max-width:${v('max', '1280px')};margin:0 auto}
${p}-feat-grid{display:grid;align-items:center;gap:40px}
${p}-feat-solo{max-width:760px}
${p}-feat-photo{width:100%;max-width:${v('photo-max', '320px')};overflow:hidden;border-radius:${v('r', '6px')}}
${p}-feat-price{margin:20px 0 0;font-size:18px;line-height:28px;color:${v('muted')}}
${p}-feat-price strong{font-weight:700;color:${v('text')}}
${p}-feat-list{display:flex;flex-direction:column;gap:12px;margin:28px 0 0;padding:0;list-style:none;font-size:14px;line-height:20px;color:${v('text')}}
${p}-feat-list li{display:flex;align-items:flex-start;gap:12px}
${p}-feat-list svg{flex:none;margin-top:2px;color:${v('accent')}}
@container (min-width:640px){
${p}-feat-list{font-size:16px;line-height:24px}
}
@container (min-width:768px){
${p}-feat-grid${p}-duo{grid-template-columns:repeat(2,minmax(0,1fr));gap:56px}
}
`;
}

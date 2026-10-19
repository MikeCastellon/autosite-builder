// The Genius Store band (copy.store, kit/store.js), shared by every theme
// that offers it: a heading, the owner's Genius Storefronts iframe, and the
// commission disclosure. The iframe is the store itself (served by Genius
// Storefronts, which also reports its height: SITE_STORE_JS on the published
// page, storePreview.js in the editor), so this band is static markup with
// no script of its own.
//
// The band renders its own <section data-section="shop">; the theme passes
// its section / wrapper classes and, for its own look, its heading node (as
// with FaqBand); without one the band prints a plain heading. Every class is
// `${ns}-<name>` (themes pass "<prefix>-st") and the theme appends
// storeCss(ns) while the band renders. Renders nothing without a valid
// copy.store, in the editor too: the Genius Store tab is where it starts.
import { storeOf, storeDisclosure, STORE_FRAME_HEIGHT } from './store.js';

export function StoreBand({
  ns, store, order, businessName, heading, className, wrapClassName, labelledBy, id = 'shop',
}) {
  const s = storeOf(store);
  if (!s) return null;
  const headId = labelledBy || `${ns}-h`;
  return (
    <section
      data-section="shop"
      id={id}
      className={className ? `${ns}-band ${className}` : `${ns}-band`}
      aria-labelledby={headId}
      style={{ order }}
    >
      <div className={wrapClassName}>
        {heading === undefined ? (
          <div className={`${ns}-head`} data-acg-reveal="">
            <p className={`${ns}-eyebrow`}>{s.eyebrow}</p>
            <h2 id={headId} className={`${ns}-title`}>{s.title}</h2>
            <p className={`${ns}-intro`}>{s.intro}</p>
          </div>
        ) : heading}
        <div className={`${ns}-frame`}>
          <iframe
            data-acg-store=""
            className={`${ns}-iframe`}
            src={s.src}
            title={businessName ? `${businessName} store` : 'Online store'}
            width="100%"
            height={STORE_FRAME_HEIGHT}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <p className={`${ns}-note`}>{storeDisclosure(businessName)}</p>
      </div>
    </section>
  );
}

// CSS for the band (classes `${ns}-<name>`; the theme styles the section and
// the wrapper, and its own heading when it passes one). Block variables
// (fallbacks in parentheses), each aliased by the theme to a token it
// already repairs for the section's background:
//   --ns-text / -muted / -accent   title / intro and note / eyebrow
//   --ns-line (muted)              the frame's border
//   --ns-frame-bg (transparent)    behind the iframe while it loads
//   --ns-r (8px)                   the frame's radius
//   --ns-head (inherit) / -head-w (800) / -title-case (none)   the title
// The iframe keeps its height attribute (the store's reported height), so
// no CSS height here: a CSS height would win over the attribute.
export function storeCss(ns) {
  const p = `.${ns}`;
  const v = (name, fb) => (fb === undefined ? `var(--${ns}-${name})` : `var(--${ns}-${name},${fb})`);
  return `
${p}-head{max-width:760px;margin-bottom:clamp(24px,3.5cqi,40px)}
${p}-eyebrow{margin:0;font-size:12px;font-weight:700;line-height:1.4;letter-spacing:.2em;text-transform:uppercase;color:${v('accent')}}
${p}-title{margin:12px 0 0;font-family:${v('head', 'inherit')};font-size:clamp(30px,4.4cqi,48px);font-weight:${v('head-w', '800')};line-height:1.05;letter-spacing:-.01em;text-transform:${v('title-case', 'none')};color:${v('text')};text-wrap:balance;overflow-wrap:break-word}
${p}-intro{margin:16px 0 0;max-width:620px;font-size:17px;line-height:1.65;color:${v('muted')};text-wrap:pretty}
${p}-frame{overflow:hidden;border:1px solid ${v('line', v('muted'))};border-radius:${v('r', '8px')};background:${v('frame-bg', 'transparent')}}
${p}-iframe{display:block;width:100%;min-height:420px;border:0}
${p}-note{margin:14px 0 0;font-size:13px;line-height:1.5;color:${v('muted')}}
`;
}

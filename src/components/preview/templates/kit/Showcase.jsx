// The Detail Showcase band (copy.showcase + images.showcase<i>,
// kit/showcase.js), shared by every theme that offers it: large photo cards,
// each the owner's photo with a short title ("Hand Wash", "Ceramic
// Coating") and an optional caption under it. Two cards to a row on wide
// screens, the right-hand column set lower than the left (a staggered
// layout); one column at 600px and under.
//
// Static markup with no script of its own: the published page needs only the
// runtime's reveal-on-scroll (data-acg-reveal), and everything reads without
// it. The band renders its own <section data-section="showcase">; the theme
// passes its section / wrapper classes and either its own heading or the
// words it wants in the band's built-in one (eyebrow, <h2>, intro). Every
// class is `${ns}-<name>` (themes pass "<prefix>-sc") and the theme appends
// showcaseCss(ns) while the band renders. No hooks, no browser globals.
import { PhotoSlot } from './PhotoSlot.jsx';
import { showcaseItems, showcaseItemHint, SHOWCASE_DEFAULTS, SHOWCASE_HINTS } from './showcase.js';

// PhotoSlot fills its box (img and editor placeholder alike); the box keeps
// the aspect ratio, so an empty slot holds the card's place in the editor.
const FILL = { position: 'absolute', inset: 0, height: '100%', minHeight: 0 };

// "01", "02": the card's place on the page (decorative, aria-hidden).
const num = (n) => String(n).padStart(2, '0');

// showcase / images: copy.showcase and the flat images map. editor: true in
// the editor preview (useEditorMode in the template), where every item
// shows. Renders nothing while the band is off, or on the published page
// without a complete item; in the editor with none the whole section is
// editor-only, so the Sections tab can say it is not on the page yet.
// heading: the theme's node (eyebrow + <h2>); left out (undefined), the band
// prints its own from `defaults` ({ eyebrow, title, intro }, over
// SHOWCASE_DEFAULTS; the owner's copy.showcase title / intro win), with the
// <h2> id `${id}-h` that labels the section. hints: the theme's
// <EditorOnly> nodes; left out, an editor with no item at all shows a
// placeholder naming where to add them.
export function ShowcaseBand({
  ns, showcase, images, editor = false, order, heading, defaults, hints,
  className, wrapClassName, labelledBy, id = 'showcase',
}) {
  const sc = showcaseItems(showcase, images, { editor });
  if (!sc || (!editor && sc.items.length === 0)) return null;
  const n = sc.items.length;
  const own = heading === undefined;
  const d = { ...SHOWCASE_DEFAULTS, ...(defaults && typeof defaults === 'object' ? defaults : {}) };
  const headId = `${id}-h`;
  const intro = sc.intro || d.intro;
  const head = own ? (
    <div className={`${ns}-head`} data-acg-reveal="">
      {d.eyebrow && <p className={`${ns}-eyebrow`}>{d.eyebrow}</p>}
      <h2 id={headId} className={`${ns}-title`}>{sc.title || d.title || SHOWCASE_DEFAULTS.title}</h2>
      {intro && <p className={`${ns}-intro`}>{intro}</p>}
    </div>
  ) : heading;
  return (
    <section
      data-section="showcase"
      id={id}
      className={className ? `${ns}-band ${className}` : `${ns}-band`}
      aria-labelledby={labelledBy || (own ? headId : undefined)}
      style={{ order }}
      {...(editor && sc.complete === 0 ? { 'data-acg-editor-only': '' } : {})}
    >
      <div className={wrapClassName}>
        {head}
        {n > 0 && (
          <ul className={n === 1 ? `${ns}-grid ${ns}-solo` : `${ns}-grid`}>
            {/* The lower (right-hand) column follows its neighbour in. An
                incomplete item (editor only) is also `${ns}-todo`, so the
                theme can leave its decorations off the placeholder. */}
            {sc.items.map((it, i) => (
              <li
                key={it.index}
                className={it.complete ? `${ns}-item` : `${ns}-item ${ns}-todo`}
                data-acg-reveal=""
                style={{ '--acg-delay': `${(i % 2) * 120}ms` }}
                {...(it.complete ? {} : { 'data-acg-editor-only': '' })}
              >
                <figure className={`${ns}-card`}>
                  <div className={`${ns}-photo`}>
                    <PhotoSlot src={it.photo} alt={it.title} hint={showcaseItemHint('photo', it.index)} style={FILL} />
                  </div>
                  <figcaption className={`${ns}-body`}>
                    <span className={`${ns}-num`} aria-hidden="true">{num(i + 1)}</span>
                    <div className={`${ns}-text`}>
                      {it.title
                        ? <h3 className={`${ns}-name`}>{it.title}</h3>
                        : <p className={`${ns}-hint`}>{showcaseItemHint('title', it.index)}</p>}
                      {it.caption && <p className={`${ns}-cap`}>{it.caption}</p>}
                    </div>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        )}
        {n === 0 && hints === undefined
          ? <PhotoSlot hint={SHOWCASE_HINTS.empty} style={{ minHeight: 220 }} />
          : hints}
      </div>
    </section>
  );
}

// CSS for the band (classes `${ns}-<name>`; the theme styles the section and,
// when it passes one, its own heading). Block variables (fallbacks in
// parentheses):
//   --ns-text / -muted / -accent   titles / captions + intro / eyebrow + numbers
//   --ns-photo-bg (neutral gray)   the photo box while its image loads
//   --ns-head (inherit) / -head-w (700) / -case (none)   heading font, weight, case
//   --ns-r (8px) photo radius
//   --ns-ratio (4 / 3) phones, --ns-ratio-wide (4 / 5) from 601px,
//   --ns-ratio-solo (16 / 9) a lone card from 601px
//   --ns-gap (clamp(28px,4cqi,64px)) between the columns, --ns-row-gap (24px)
//   --ns-stagger (clamp(56px,8cqi,120px)) how much lower the right column sits
// The stagger is a top margin on every right-hand card, so the grid's rows
// grow with it and nothing overlaps the next section (no transform: the
// reveal runtime animates transform on the same cards). Each column keeps
// the same rhythm: right cards start --ns-stagger below their left
// neighbours, and cards in a column sit --ns-stagger + --ns-row-gap apart.
export function showcaseCss(ns) {
  const p = `.${ns}`;
  const v = (name, fb) => (fb === undefined ? `var(--${ns}-${name})` : `var(--${ns}-${name},${fb})`);
  const head = v('head', 'inherit');
  const headW = v('head-w', '700');
  const tcase = v('case', 'none');
  return `
${p}-head{max-width:760px;margin-bottom:clamp(36px,5cqi,64px)}
${p}-eyebrow{margin:0;font-size:12px;font-weight:700;line-height:1.4;letter-spacing:.22em;text-transform:uppercase;color:${v('accent')}}
${p}-title{margin:14px 0 0;font-family:${head};font-size:clamp(32px,4.4cqi,56px);font-weight:${headW};line-height:1.04;letter-spacing:-.01em;text-transform:${tcase};color:${v('text')};text-wrap:balance;overflow-wrap:break-word}
${p}-intro{margin:18px 0 0;max-width:560px;font-size:17px;line-height:1.7;color:${v('muted')};text-wrap:pretty}
${p}-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:36px;margin:0;padding:0;list-style:none}
${p}-item{min-width:0}
${p}-card{margin:0}
${p}-photo{position:relative;overflow:hidden;aspect-ratio:${v('ratio', '4 / 3')};border-radius:${v('r', '8px')};background:${v('photo-bg', 'rgba(128,128,128,.14)')}}
${p}-photo img{position:absolute;inset:0}
${p}-body{display:flex;align-items:baseline;gap:14px;margin-top:18px}
${p}-num{flex:none;font-family:${head};font-size:13px;font-weight:${headW};line-height:1;letter-spacing:.14em;font-variant-numeric:tabular-nums;color:${v('accent')}}
${p}-text{flex:1;min-width:0}
${p}-name{margin:0;font-family:${head};font-size:clamp(20px,2cqi,26px);font-weight:${headW};line-height:1.2;text-transform:${tcase};color:${v('text')};overflow-wrap:break-word}
${p}-cap{margin:8px 0 0;font-size:15.5px;line-height:1.6;color:${v('muted')};text-wrap:pretty}
${p}-hint{margin:0;font-size:14px;font-weight:600;line-height:1.45;color:${v('muted')}}
@container (min-width:601px){
${p}-grid{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:${v('gap', 'clamp(28px,4cqi,64px)')};row-gap:${v('row-gap', '24px')}}
${p}-item:nth-child(even){margin-top:${v('stagger', 'clamp(56px,8cqi,120px)')}}
${p}-photo{aspect-ratio:${v('ratio-wide', '4 / 5')}}
${p}-grid${p}-solo{grid-template-columns:minmax(0,1fr)}
${p}-solo ${p}-photo{aspect-ratio:${v('ratio-solo', '16 / 9')}}
}
@media (hover:hover){
${p}-card:hover ${p}-photo img{transform:scale(1.04)}
}
@media (prefers-reduced-motion:no-preference){
${p}-photo img{transition:transform .8s cubic-bezier(.2,.7,.2,1)}
}
`;
}

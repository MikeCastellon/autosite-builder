// The Before & After band (copy.beforeAfter + images.baBefore<i> /
// baAfter<i>, kit/beforeAfter.js), shared by every theme that offers it.
// Each pair is a comparison: the before photo, the after photo over it
// shown from a vertical divider with a round handle, "Before" / "After"
// tags in the top corners and the owner's caption under it. A transparent
// range input lies over the photos, so the divider moves by mouse, touch
// or keyboard. Pairs sit one per slide on a swipeable scroll-snap track,
// with prev / next arrows and an "01 / 02" counter from two pairs on.
//
// Static markup (renderToStaticMarkup on the published page): the page's
// SITE_BA_JS (siteRuntime.js) moves the divider (--acg-ba on the
// [data-acg-ba] figure) and the track; the editor preview mirrors it
// (beforeAfterPreview.js). Without either the photos show split 50/50 and
// the track still swipes.
//
// The band renders its own <section data-section="beforeAfter">; the theme
// passes its section / wrapper classes, its heading and its editor hints.
// Every class is `${ns}-<name>` (themes pass "<prefix>-ba") and the theme
// appends beforeAfterCss(ns) while the band renders. No hooks, no browser
// globals.
import { PhotoSlot, PHOTO_HINTS } from './PhotoSlot.jsx';
import { LucideIcon } from './icons.jsx';
import { beforeAfterPairs, baCounter } from './beforeAfter.js';

export const BA_LABELS = {
  before: 'Before',
  after: 'After',
  range: 'Compare before and after',
  prev: 'Previous before and after',
  next: 'Next before and after',
};

// PhotoSlot fills its box (img and editor placeholder alike).
const FILL = { position: 'absolute', inset: 0, height: '100%', minHeight: 0 };

const altFor = (label, caption) => (caption ? `${label}: ${caption}` : label);

// One complete pair: the comparison figure.
function Compare({ ns, pair, labels }) {
  return (
    <figure className={`${ns}-pair`} data-acg-ba="" style={{ '--acg-ba': '50%' }}>
      <div className={`${ns}-frame`}>
        <PhotoSlot src={pair.before} alt={altFor(labels.before, pair.caption)} style={FILL} />
        <div className={`${ns}-after`}>
          <PhotoSlot src={pair.after} alt={altFor(labels.after, pair.caption)} style={FILL} />
        </div>
        {/* The tags repeat what the photos' alt text says. */}
        <span className={`${ns}-tag ${ns}-tag-before`} aria-hidden="true">{labels.before}</span>
        <span className={`${ns}-tag ${ns}-tag-after`} aria-hidden="true">{labels.after}</span>
        <input className={`${ns}-range`} type="range" min="0" max="100" defaultValue={50} data-acg-ba-range="" aria-label={labels.range} />
        {/* After the input, so its :focus-visible can ring the handle. */}
        <span className={`${ns}-line`} aria-hidden="true">
          <span className={`${ns}-knob`}><LucideIcon name="chevronsLeftRight" size={22} stroke={2.25} /></span>
        </span>
      </div>
      {pair.caption && <figcaption className={`${ns}-cap`}>{pair.caption}</figcaption>}
    </figure>
  );
}

// An incomplete pair (editor only): both photos side by side, each missing
// one as a placeholder that says where to add it.
function Todo({ ns, pair, labels }) {
  const half = (src, label, slot, side) => (
    <div className={`${ns}-half`}>
      <PhotoSlot src={src} alt={altFor(label, pair.caption)} hint={`${PHOTO_HINTS[slot]} (pair ${pair.index + 1})`} style={FILL} />
      <span className={`${ns}-tag ${ns}-tag-${side}`}>{label}</span>
    </div>
  );
  return (
    <figure className={`${ns}-pair ${ns}-todo`} data-acg-editor-only="">
      <div className={`${ns}-frame`}>
        {half(pair.before, labels.before, 'baBefore', 'before')}
        {half(pair.after, labels.after, 'baAfter', 'after')}
      </div>
      {pair.caption && <figcaption className={`${ns}-cap`}>{pair.caption}</figcaption>}
    </figure>
  );
}

// beforeAfter / images: copy.beforeAfter and the flat images map. editor:
// true in the editor preview (useEditorMode in the template), where every
// pair shows. Renders nothing while the band is off, or on the published
// page without a complete pair; in the editor with none the whole section
// is editor-only, so the Sections tab can say it is not on the page yet.
// heading / hints: the theme's nodes (eyebrow + <h2>, <EditorOnly> hints).
export function BeforeAfterBand({
  ns, beforeAfter, images, editor = false, order, heading = null, hints = null,
  className, wrapClassName, labelledBy, id = 'before-after', labels: ownLabels,
}) {
  const ba = beforeAfterPairs(beforeAfter, images, { editor });
  if (!ba || (!editor && ba.pairs.length === 0)) return null;
  const labels = { ...BA_LABELS, ...ownLabels };
  const n = ba.pairs.length;
  return (
    <section
      data-section="beforeAfter"
      id={id}
      className={className ? `${ns}-band ${className}` : `${ns}-band`}
      aria-labelledby={labelledBy}
      style={{ order }}
      {...(editor && ba.complete === 0 ? { 'data-acg-editor-only': '' } : {})}
    >
      <div className={wrapClassName}>
        {heading}
        {n > 0 && (
          <div className={`${ns}-slider`} data-acg-ba-slider="" data-acg-reveal="">
            <div className={`${ns}-track`} data-acg-ba-track="">
              {ba.pairs.map((pair, i) => (
                <div key={pair.index} className={`${ns}-slide`} role="group" aria-label={`${labels.before} and ${labels.after.toLowerCase()} ${i + 1} of ${n}`}>
                  {pair.complete ? <Compare ns={ns} pair={pair} labels={labels} /> : <Todo ns={ns} pair={pair} labels={labels} />}
                </div>
              ))}
            </div>
            {n > 1 && (
              <div className={`${ns}-nav`}>
                <button type="button" className={`${ns}-btn`} data-acg-ba-prev="" aria-label={labels.prev}><LucideIcon name="arrowLeft" size={20} /></button>
                <p className={`${ns}-count`} data-acg-ba-count="" aria-hidden="true">{`${baCounter(1)} / ${baCounter(n)}`}</p>
                <button type="button" className={`${ns}-btn`} data-acg-ba-next="" aria-label={labels.next}><LucideIcon name="arrowRight" size={20} /></button>
              </div>
            )}
          </div>
        )}
        {hints}
      </div>
    </section>
  );
}

// CSS for the band (classes `${ns}-<name>`; the theme styles the section and
// heading). Block variables (fallbacks in parentheses):
//   --ns-text / -muted / -line / -focus   counter + arrows / caption / arrow
//                                         borders / focus ring
//   --ns-tag-bg / -tag-text               the Before tag
//   --ns-tag2-bg / -tag2-text             the After tag
//   --ns-knob-bg / -knob-text             the handle
//   --ns-r (8px) photo radius   --ns-tag-r (4px)   --ns-btn-r (50%)
//   --ns-ratio (4 / 3) phones, --ns-ratio-wide (16 / 9) from 601px
// --acg-ba (50%) is the divider, set on [data-acg-ba] by the runtime. The
// tags sit above the divider line, so it never cuts through their text.
// The range input spills 22px past each side, so its 44px thumb sits on
// the divider at every value (0% = the left edge). Where a device can hover
// the whole photo moves the divider; on touch only the handle does, so a
// swipe across the photo changes the pair.
export function beforeAfterCss(ns) {
  const p = `.${ns}`;
  const v = (name, fb) => (fb === undefined ? `var(--${ns}-${name})` : `var(--${ns}-${name},${fb})`);
  const at = 'var(--acg-ba,50%)';
  return `
${p}-slider{position:relative}
${p}-track{display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;overscroll-behavior-x:contain;scrollbar-width:none;-webkit-overflow-scrolling:touch}
${p}-track::-webkit-scrollbar{display:none}
${p}-slide{flex:0 0 100%;min-width:0;scroll-snap-align:start;scroll-snap-stop:always}
${p}-pair{margin:0}
${p}-frame{position:relative;overflow:hidden;aspect-ratio:${v('ratio', '4 / 3')};border-radius:${v('r', '8px')};background:rgba(128,128,128,.14);-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
${p}-frame img{position:absolute;inset:0;pointer-events:none;-webkit-user-drag:none}
${p}-after{position:absolute;inset:0;-webkit-clip-path:inset(0 0 0 ${at});clip-path:inset(0 0 0 ${at})}
${p}-tag{position:absolute;top:12px;z-index:4;max-width:calc(50% - 24px);overflow:hidden;padding:5px 10px;border-radius:${v('tag-r', '4px')};font-size:12px;font-weight:700;line-height:16px;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;text-overflow:ellipsis;pointer-events:none}
${p}-tag-before{left:12px;background:${v('tag-bg')};color:${v('tag-text')}}
${p}-tag-after{right:12px;background:${v('tag2-bg')};color:${v('tag2-text')}}
${p}-range{position:absolute;top:0;left:-22px;z-index:2;width:calc(100% + 44px);height:100%;margin:0;padding:0;border:0;opacity:0;cursor:ew-resize;-webkit-appearance:none;appearance:none;background:none;pointer-events:none;touch-action:pan-y}
${p}-range::-webkit-slider-thumb{width:44px;height:44px;-webkit-appearance:none;appearance:none;pointer-events:auto;cursor:ew-resize}
${p}-range::-moz-range-thumb{width:44px;height:44px;border:0;pointer-events:auto;cursor:ew-resize}
${p}-line{position:absolute;top:0;bottom:0;left:${at};z-index:3;width:2px;margin-left:-1px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.2);pointer-events:none}
${p}-knob{position:absolute;top:50%;left:50%;display:flex;align-items:center;justify-content:center;width:44px;height:44px;margin:-22px 0 0 -22px;border:2px solid #fff;border-radius:50%;background:${v('knob-bg')};color:${v('knob-text')};box-shadow:0 4px 14px rgba(0,0,0,.35)}
${p}-range:focus-visible~${p}-line ${p}-knob{outline:3px solid ${v('focus')};outline-offset:3px}
${p}-cap{margin:14px 0 0;font-size:15px;line-height:1.5;color:${v('muted')}}
${p}-nav{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:20px}
${p}-btn{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;margin:0;padding:0;border:1px solid ${v('line')};border-radius:${v('btn-r', '50%')};background:none;color:${v('text')};cursor:pointer}
${p}-btn:focus-visible{outline:2px solid ${v('focus')};outline-offset:2px}
${p}-count{margin:0;min-width:5.5em;font-size:13px;font-weight:700;line-height:20px;letter-spacing:.12em;text-align:center;font-variant-numeric:tabular-nums;color:${v('text')}}
${p}-todo ${p}-frame{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;background:none}
${p}-half{position:relative;min-width:0}
${p}-todo ${p}-tag{max-width:calc(100% - 24px)}
@container (min-width:601px){
${p}-frame{aspect-ratio:${v('ratio-wide', '16 / 9')}}
${p}-tag{top:16px;padding:6px 12px;font-size:13px}
${p}-tag-before{left:16px}
${p}-tag-after{right:16px}
}
@media (hover:hover){
${p}-range{pointer-events:auto}
${p}-btn:hover{border-color:${v('text')}}
}
@media (prefers-reduced-motion:no-preference){
${p}-track{scroll-behavior:smooth}
${p}-btn{transition:border-color .2s,background-color .2s,color .2s}
}
`;
}

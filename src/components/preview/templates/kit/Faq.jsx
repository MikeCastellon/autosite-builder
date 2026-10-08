// The FAQ band (copy.faq, kit/faq.js), shared by every theme that offers
// it: an eyebrow, a title and an optional intro, then the owner's
// questions, each a <details> whose <summary> is the question, with a +
// that turns into a − as it opens. Native disclosure, so the questions open
// and close on the published page (static markup, no React) with no
// script at all, by mouse, touch or keyboard, and screen readers announce
// each one as expanded or collapsed. From faqCss's `twoFrom` container
// width the questions sit in two columns that open independently: the
// first half on the left, the rest on the right, so the reading order stays
// question 1, 2, 3 and opening one never shuffles the others between
// columns.
//
// The published page also carries the questions as schema.org FAQPage
// JSON-LD, built from exactly the items it prints. The editor never does:
// an incomplete question must not reach search data.
//
// The band renders its own <section data-section="faq">; the theme passes
// its section / wrapper classes and, for its own look, its heading and
// editor hints (as with BeforeAfterBand); without them the band prints a
// plain heading of its own and the kit's hints. Every class is
// `${ns}-<name>` (themes pass "<prefix>-faq") and the theme appends
// faqCss(ns) while the band renders. No browser globals.
import { useEditorMode } from './EditorMode.jsx';
import { Accented } from './Accented.jsx';
import { faqItems, faqHeading, faqJsonLd, scriptSafeJson, FAQ_DEFAULTS, FAQ_HINTS } from './faq.js';

// An answer: a blank line in the owner's text starts a new paragraph, a
// single line break stays a break (white-space: pre-line in faqCss).
function Answer({ text }) {
  return text.split(/\n\n+/).map((para, i) => <p key={i}>{para}</p>);
}

function Question({ ns, text }) {
  return (
    <summary className={`${ns}-q`}>
      <span className={`${ns}-q-text`}>{text}</span>
      {/* The +/− repeats the expanded state the summary already reports. */}
      <span className={`${ns}-icon`} aria-hidden="true" />
    </summary>
  );
}

// What an incomplete item still needs (editor only).
const todoHint = (item) => (!item.q && !item.a ? FAQ_HINTS.blank : item.q ? FAQ_HINTS.noAnswer : FAQ_HINTS.noQuestion);

function Item({ ns, item }) {
  if (item.complete) {
    return (
      <details className={`${ns}-item`}>
        <Question ns={ns} text={item.q} />
        <div className={`${ns}-a`}><Answer text={item.a} /></div>
      </details>
    );
  }
  // Only the editor gets incomplete items. Open, so the hint saying what is
  // missing shows without a click; the number matches the FAQ tab's list.
  return (
    <details className={`${ns}-item ${ns}-todo`} data-acg-editor-only="" open>
      <Question ns={ns} text={item.q || `Question ${item.index + 1}`} />
      <div className={`${ns}-a`}>
        {item.a && <Answer text={item.a} />}
        <p className={`${ns}-hint`}>{todoHint(item)}</p>
      </div>
    </details>
  );
}

// faq: copy.faq. editor: true in the editor preview; a template passes
// useEditorMode()'s value like it does for BeforeAfterBand, and without the
// prop the band reads the same context itself. Renders nothing while the
// band is off (no copy.faq object), or on the published page without a
// complete item; in the editor with none the whole section is editor-only,
// so the Sections tab can say it is not on the page yet.
// heading: the theme's node (eyebrow + <h2>, with labelledBy naming its id);
// left out, the band prints faqHeading() (owner's text, sectionTitles,
// then labels / FAQ_DEFAULTS). hints: the theme's editor-only node for an
// empty FAQ; left out, the kit's own placeholder. jsonLd={false} keeps the
// FAQPage data off (a page that prints it elsewhere).
export function FaqBand({
  ns, faq, editor, order, sectionTitles, heading, hints, className, wrapClassName,
  labelledBy, id = 'faq', labels, jsonLd = true,
}) {
  const fromContext = useEditorMode();
  const ed = typeof editor === 'boolean' ? editor : fromContext;
  const data = faqItems(faq, { editor: ed });
  if (!data || (!ed && data.items.length === 0)) return null;
  const own = heading === undefined ? faqHeading(faq, sectionTitles, { ...FAQ_DEFAULTS, ...labels }) : null;
  const headId = labelledBy || `${ns}-h`;
  const items = data.items;
  const half = Math.ceil(items.length / 2);
  const cols = items.length > 1 ? [items.slice(0, half), items.slice(half)] : [items];
  const ld = !ed && jsonLd ? faqJsonLd(faq) : null;
  return (
    <section
      data-section="faq"
      id={id}
      className={className ? `${ns}-band ${className}` : `${ns}-band`}
      aria-labelledby={own ? headId : labelledBy}
      style={{ order }}
      {...(ed && data.complete === 0 ? { 'data-acg-editor-only': '' } : {})}
    >
      <div className={wrapClassName}>
        {own ? (
          <div className={`${ns}-head`} data-acg-reveal="">
            {own.eyebrow && <p className={`${ns}-eyebrow`}>{own.eyebrow}</p>}
            <h2 id={headId} className={`${ns}-title`}>
              <Accented title={own.title} accent={own.accent} className={`${ns}-em`} />
            </h2>
            {own.intro && <p className={`${ns}-intro`}>{own.intro}</p>}
          </div>
        ) : heading}
        {items.length > 0 && (
          <div className={`${ns}-list${cols.length === 1 ? ` ${ns}-solo` : ''}`} data-acg-reveal="">
            {cols.map((col, c) => (
              <div key={c} className={`${ns}-col`}>
                {col.map((item) => <Item key={item.index} ns={ns} item={item} />)}
              </div>
            ))}
          </div>
        )}
        {hints !== undefined ? hints : ed && items.length === 0 && (
          <p className={`${ns}-hint`} data-acg-editor-only="">{FAQ_HINTS.empty}</p>
        )}
      </div>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptSafeJson(ld) }} />}
    </section>
  );
}

// CSS for the band (classes `${ns}-<name>`; the theme styles the section
// and the wrapper, and its own heading when it passes one). twoFrom: the
// container width (px) from which the questions sit in two columns; below
// it they are one column (phones always). Block variables (fallbacks in
// parentheses), each aliased by the theme to a token it already repairs
// for the background it sits on:
//   on the section's background (the band's own heading):
//   --ns-text / -muted / -accent   title / intro / eyebrow (-eyebrow
//                                  overrides) and highlighted words
//   on each question's fill, --ns-item-bg (transparent; -open-bg while open):
//   --ns-item-text (text)          the question
//   --ns-item-muted (muted)        the answer
//   --ns-item-accent (accent)      the +/− mark and the hovered question
//                                  (-hover overrides)
//   --ns-line / -line-open (line)  item border, closed / open
//   --ns-focus                     the question's focus ring (inside the item)
//   --ns-r (8px) item radius
//   --ns-head (inherit) / -head-w (800) / -title-case (none)   the title
//   --ns-q-font (inherit) / -q-w (600) / -q-case (none)        questions
// The question is a block with the mark parked in its right padding, so the
// layout holds in every engine (a flex <summary> is not safe in older
// Safari); the browser's own triangle is removed both ways (display:block
// drops the list-item marker, ::-webkit-details-marker the WebKit one).
export function faqCss(ns, { twoFrom = 768 } = {}) {
  const p = `.${ns}`;
  const v = (name, fb) => (fb === undefined ? `var(--${ns}-${name})` : `var(--${ns}-${name},${fb})`);
  return `
${p}-head{max-width:760px;margin-bottom:clamp(28px,4cqi,48px)}
${p}-eyebrow{margin:0;font-size:12px;font-weight:700;line-height:1.4;letter-spacing:.2em;text-transform:uppercase;color:${v('eyebrow', v('accent'))}}
${p}-title{margin:12px 0 0;font-family:${v('head', 'inherit')};font-size:clamp(30px,4.4cqi,48px);font-weight:${v('head-w', '800')};line-height:1.05;letter-spacing:-.01em;text-transform:${v('title-case', 'none')};color:${v('text')};text-wrap:balance;overflow-wrap:break-word}
${p}-em{color:${v('accent')}}
${p}-intro{margin:16px 0 0;max-width:620px;font-size:17px;line-height:1.65;color:${v('muted')};text-wrap:pretty}
${p}-list{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
${p}-col{display:flex;flex-direction:column;gap:12px;min-width:0}
${p}-item{min-width:0;border:1px solid ${v('line')};border-radius:${v('r', '8px')};background:${v('item-bg', 'transparent')}}
${p}-item[open]{border-color:${v('line-open', v('line'))};background:${v('open-bg', v('item-bg', 'transparent'))}}
${p}-q{position:relative;display:block;padding:18px 58px 18px 20px;border-radius:inherit;list-style:none;cursor:pointer;font-family:${v('q-font', 'inherit')};font-size:17px;font-weight:${v('q-w', '600')};line-height:1.45;text-transform:${v('q-case', 'none')};color:${v('item-text', v('text'))}}
${p}-q::-webkit-details-marker{display:none}
${p}-q-text{display:block;overflow-wrap:break-word}
${p}-icon{position:absolute;top:18px;right:18px;width:24px;height:24px;color:${v('item-accent', v('accent'))}}
${p}-icon::before,${p}-icon::after{content:'';position:absolute;top:11px;left:5px;width:14px;height:2px;border-radius:1px;background:currentColor}
${p}-icon::after{transform:rotate(90deg)}
${p}-item[open] ${p}-icon::after{transform:rotate(180deg)}
${p}-q:focus-visible{outline:2px solid ${v('focus')};outline-offset:-3px}
${p}-a{padding:0 20px 20px;font-size:16px;line-height:1.7;color:${v('item-muted', v('muted'))}}
${p}-a p{margin:0;white-space:pre-line;overflow-wrap:break-word}
${p}-a p+p{margin-top:12px}
${p}-todo{border-style:dashed}
${p}-hint{width:fit-content;max-width:100%;margin:12px 0 0;padding:10px 14px;border:1.5px dashed rgba(128,128,128,.55);border-radius:6px;font-size:13px;font-weight:500;line-height:1.45;color:inherit;opacity:.85}
${p}-a ${p}-hint:first-child{margin-top:0}
@container (min-width:${twoFrom}px){
${p}-list{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;column-gap:20px}
${p}-solo{grid-template-columns:minmax(0,1fr);max-width:820px}
}
@media (hover:hover){
${p}-q:hover{color:${v('hover', v('item-accent', v('accent')))}}
}
@media (prefers-reduced-motion:no-preference){
${p}-icon::after{transition:transform .25s ease}
${p}-q{transition:color .2s}
}
`;
}

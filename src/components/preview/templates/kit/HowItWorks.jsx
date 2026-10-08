// The How It Works band (copy.howSteps, kit/howItWorks.js), shared by every
// theme that offers it: an eyebrow, a title and an optional intro, then the
// owner's steps in order, each a big two-digit number with the step's emoji
// or line icon beside it and a rule running to the column's edge, then the
// step's title and short text. The steps stack in one column (phones, and
// up to howItWorksCss's `rowFrom` container width) and sit in a row from
// there: up to four across, longer lists in even rows (howColumns).
//
// The steps are an <ol>, so assistive tech already says "1 of 3": the
// printed number, emoji and rule are decoration (aria-hidden). role="list"
// keeps that list in Safari, which drops the role of a list styled
// list-style:none (Tailwind's preflight styles every list that way).
//
// The band renders its own <section data-section="process">; the theme
// passes its section / wrapper classes and, for its own look, its heading
// and editor hints (as with BeforeAfterBand); without them the band prints
// a plain heading of its own and the kit's hint. Every class is
// `${ns}-<name>` (themes pass "<prefix>-how") and the theme appends
// howItWorksCss(ns) while the band renders. No browser globals.
import IconOrEmoji from '../IconOrEmoji.jsx';
import { useEditorMode } from './EditorMode.jsx';
import { Accented } from './Accented.jsx';
import { howItWorksSteps, howItWorksHeading, HOW_DEFAULTS, HOW_HINTS } from './howItWorks.js';

// howSteps: copy.howSteps. editor: true in the editor preview; a template
// passes useEditorMode()'s value like it does for BeforeAfterBand, and
// without the prop the band reads the same context itself. Renders nothing
// while the band is off (copy.howSteps missing or empty), or on the
// published page when no step has a title or a description; in the editor
// that last case is an editor-only section with a hint, so the Sections tab
// can say it is not on the page yet.
// heading: the theme's node (eyebrow + <h2>, with labelledBy naming its id);
// left out, the band prints howItWorksHeading() (copy.sectionTitles.process,
// then labels / HOW_DEFAULTS). hints: the theme's editor-only node for the
// empty band; left out, the kit's own. emojiSize: the emoji / icon size (px).
export function HowItWorksBand({
  ns, howSteps, editor, order, sectionTitles, heading, hints, className, wrapClassName,
  labelledBy, id = 'process', labels, emojiSize = 28,
}) {
  const fromContext = useEditorMode();
  const ed = typeof editor === 'boolean' ? editor : fromContext;
  const data = howItWorksSteps(howSteps);
  if (!data || (!ed && data.steps.length === 0)) return null;
  const own = heading === undefined ? howItWorksHeading(sectionTitles, { ...HOW_DEFAULTS, ...labels }) : null;
  const headId = labelledBy || `${ns}-h`;
  const { steps, cols } = data;
  return (
    <section
      data-section="process"
      id={id}
      className={className ? `${ns}-band ${className}` : `${ns}-band`}
      aria-labelledby={own ? headId : labelledBy}
      style={{ order }}
      {...(ed && steps.length === 0 ? { 'data-acg-editor-only': '' } : {})}
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
        {steps.length > 0 && (
          <ol className={`${ns}-steps`} role="list" style={{ [`--${ns}-cols`]: cols }}>
            {steps.map((s, i) => (
              <li key={i} className={`${ns}-step`} data-acg-reveal="" style={{ '--acg-delay': `${(i % 4) * 90}ms` }}>
                <div className={`${ns}-mark`} aria-hidden="true">
                  <span className={`${ns}-num`}>{s.number}</span>
                  {s.emoji && <span className={`${ns}-emo`}><IconOrEmoji value={s.emoji} size={emojiSize} /></span>}
                  <span className={`${ns}-rule`} />
                </div>
                {s.title && <h3 className={`${ns}-step-title`}>{s.title}</h3>}
                {s.desc && <p className={`${ns}-desc`}>{s.desc}</p>}
              </li>
            ))}
          </ol>
        )}
        {hints !== undefined ? hints : ed && steps.length === 0 && (
          <p className={`${ns}-hint`} data-acg-editor-only="">{HOW_HINTS.empty}</p>
        )}
      </div>
    </section>
  );
}

// CSS for the band (classes `${ns}-<name>`; the theme styles the section
// and the wrapper, and its own heading when it passes one). rowFrom: the
// container width (px) from which the steps sit in a row; below it they
// stack, at most --ns-stack-max wide. Block variables (fallbacks in
// parentheses), each aliased by the theme to a token it already repairs
// for the background it sits on:
//   on the section's background:
//   --ns-text / -muted    band title + step titles / intro + step text
//   --ns-accent           the numbers (-num overrides), emoji / icons, the
//                         highlighted words and the eyebrow (-eyebrow
//                         overrides)
//   --ns-line             the rule beside each number
//   a card behind each step, for themes that want one (its outline is an
//   inset shadow, so a theme without cards keeps the steps flush with the
//   heading):
//   --ns-card-bg / -card-line (transparent) / -pad (0px) / -r (0px), and
//   --ns-card-text / -card-muted / -card-accent (text / muted / accent),
//                         the step's colors repaired for --ns-card-bg
//   --ns-cols (3)         steps per row, set inline from howColumns()
//   --ns-num-size (clamp 40-56px)   --ns-stack-max (720px)
//   --ns-head (inherit) / -head-w (800) / -title-case (none)
//                         numbers, step titles and the band title
export function howItWorksCss(ns, { rowFrom = 900 } = {}) {
  const p = `.${ns}`;
  const v = (name, fb) => (fb === undefined ? `var(--${ns}-${name})` : `var(--${ns}-${name},${fb})`);
  return `
${p}-head{max-width:760px;margin-bottom:clamp(32px,4.4cqi,56px)}
${p}-eyebrow{margin:0;font-size:12px;font-weight:700;line-height:1.4;letter-spacing:.2em;text-transform:uppercase;color:${v('eyebrow', v('accent'))}}
${p}-title{margin:12px 0 0;font-family:${v('head', 'inherit')};font-size:clamp(30px,4.4cqi,48px);font-weight:${v('head-w', '800')};line-height:1.05;letter-spacing:-.01em;text-transform:${v('title-case', 'none')};color:${v('text')};text-wrap:balance;overflow-wrap:break-word}
${p}-em{color:${v('accent')}}
${p}-intro{margin:16px 0 0;max-width:620px;font-size:17px;line-height:1.65;color:${v('muted')};text-wrap:pretty}
${p}-steps{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(30px,4cqi,44px);max-width:${v('stack-max', '720px')};margin:0;padding:0;list-style:none}
${p}-step{display:flex;flex-direction:column;min-width:0;padding:${v('pad', '0px')};border-radius:${v('r', '0px')};background:${v('card-bg', 'transparent')};box-shadow:inset 0 0 0 1px ${v('card-line', 'transparent')}}
${p}-mark{display:flex;align-items:center;gap:14px;min-width:0}
${p}-num{flex:none;font-family:${v('head', 'inherit')};font-size:${v('num-size', 'clamp(40px,4.4cqi,56px)')};font-weight:${v('head-w', '800')};line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:${v('num', v('card-accent', v('accent')))}}
${p}-emo{flex:none;display:inline-flex;align-items:center;line-height:1;color:${v('card-accent', v('accent'))}}
${p}-emo svg{display:block}
${p}-rule{flex:1 1 auto;min-width:24px;height:2px;background:${v('line')}}
${p}-step-title{margin:20px 0 0;font-family:${v('head', 'inherit')};font-size:clamp(20px,2.1cqi,24px);font-weight:${v('head-w', '800')};line-height:1.2;letter-spacing:-.005em;text-transform:${v('title-case', 'none')};color:${v('card-text', v('text'))};overflow-wrap:break-word}
${p}-desc{margin:10px 0 0;font-size:16px;line-height:1.65;color:${v('card-muted', v('muted'))};white-space:pre-line;overflow-wrap:break-word;text-wrap:pretty}
${p}-mark+${p}-desc{margin-top:20px}
${p}-hint{width:fit-content;max-width:100%;margin:0;padding:10px 14px;border:1.5px dashed rgba(128,128,128,.55);border-radius:6px;font-size:13px;font-weight:500;line-height:1.45;color:inherit;opacity:.85}
@container (min-width:${rowFrom}px){
${p}-steps{grid-template-columns:repeat(${v('cols', '3')},minmax(0,1fr));max-width:none}
}
`;
}

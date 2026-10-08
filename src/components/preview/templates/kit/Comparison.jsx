// The Comparison band (copy.comparison, kit/comparison.js), shared by every
// theme that offers it: the business next to an alternative (an automated
// car wash by default), row by row, as a real <table>. Its <caption> holds
// the heading, so the visible heading is the table's caption and nothing is
// read twice; the table's name is the title alone (aria-labelledby). Column
// and row headers carry scope; a check or a dash is an icon with visually
// hidden "Yes" / "No". The business's column is outlined and tinted with
// the accent. On a container of 600px or less the table stays three
// columns, with smaller type and tighter cells (fixed layout and breakable
// words, so it never scrolls the page sideways).
//
// The band renders its own <section data-section="comparison">; the theme
// passes its section / wrapper classes and, for a look of its own, its
// heading (it goes inside the caption: leave data-acg-reveal off it, the
// table reveals as a whole) and editor hints. Every class is `${ns}-<name>`
// (themes pass "<prefix>-cmp") and the theme appends comparisonCss(ns)
// while the band renders. Static markup: no hooks, no browser globals.
import { LucideIcon } from './icons.jsx';
import { Accented } from './Accented.jsx';
import { comparisonOf, comparisonHeading, CMP_HINTS } from './comparison.js';

// What a screen reader hears for the marks.
export const CMP_LABELS = Object.freeze({ yes: 'Yes', no: 'No' });

// The "no" mark: lucide's minus, drawn like LucideIcon.
function Dash({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
    </svg>
  );
}

function Cell({ ns, cell, labels }) {
  if (cell.kind === 'yes') return <><LucideIcon name="check" size={22} stroke={2.5} className={`${ns}-yes`} /><span className={`${ns}-sr`}>{labels.yes}</span></>;
  if (cell.kind === 'no') return <><Dash className={`${ns}-no`} /><span className={`${ns}-sr`}>{labels.no}</span></>;
  if (cell.kind === 'text') return <span className={`${ns}-txt`}>{cell.text}</span>;
  return null;
}

// The band's own heading (comparisonHeading): eyebrow, <h2> with the
// highlighted words, intro.
function Heading({ ns, h }) {
  return (
    <div className={`${ns}-head`}>
      {h.eyebrow && <p className={`${ns}-eyebrow`}>{h.eyebrow}</p>}
      <h2 id={`${ns}-h`} className={`${ns}-title`}><Accented title={h.title} accent={h.accent} className={`${ns}-em`} /></h2>
      {h.intro && <p className={`${ns}-intro`}>{h.intro}</p>}
    </div>
  );
}

// comparison / sectionTitles: copy.comparison and copy.sectionTitles.
// businessName: the business's column label while the owner gave none.
// editor: true in the editor preview (useEditorMode in the template), where
// every row shows and an unlabelled one is an editor-only row saying what
// it needs. Renders nothing while the band is off, or on the published page
// without a labelled row; in the editor with none the whole section is
// editor-only, so the Sections tab can say it is not on the page yet.
// heading: the theme's node (eyebrow + <h2>; pass labelledBy with its id);
// left out, the band prints comparisonHeading(comparison, sectionTitles,
// defaults) itself. hints: the theme's <EditorOnly> hints; left out, the
// band says CMP_HINTS.empty while the editor has no row at all. labels:
// replacements for CMP_LABELS / CMP_HINTS.
export function ComparisonBand({
  ns, comparison, businessName, sectionTitles, defaults, editor = false, order, heading, hints, labels: ownLabels,
  className, wrapClassName, labelledBy, id = 'comparison',
}) {
  const cmp = comparisonOf(comparison, { editor, businessName });
  if (!cmp || (!editor && cmp.rows.length === 0)) return null;
  const labels = { ...CMP_HINTS, ...CMP_LABELS, ...ownLabels };
  const ownHeading = heading === undefined;
  const nameId = labelledBy || (ownHeading ? `${ns}-h` : undefined);
  const head = ownHeading ? <Heading ns={ns} h={comparisonHeading(comparison, sectionTitles, defaults)} /> : heading;
  return (
    <section
      data-section="comparison"
      id={id}
      className={className ? `${ns}-band ${className}` : `${ns}-band`}
      aria-labelledby={nameId}
      style={{ order }}
      {...(editor && cmp.labelled === 0 ? { 'data-acg-editor-only': '' } : {})}
    >
      <div className={wrapClassName}>
        {cmp.rows.length > 0 ? (
          <table className={`${ns}-table`} aria-labelledby={nameId} data-acg-reveal="">
            {/* heading={null}: no heading, so no empty caption either. */}
            {head ? <caption className={`${ns}-caption`}>{head}</caption> : null}
            <thead>
              <tr>
                <td className={`${ns}-corner`} />
                <th scope="col" className={`${ns}-col ${ns}-us`}>{cmp.usLabel}</th>
                <th scope="col" className={`${ns}-col ${ns}-them`}>{cmp.themLabel}</th>
              </tr>
            </thead>
            <tbody>
              {cmp.rows.map((row) => (
                <tr key={row.index} {...(row.labelled ? {} : { className: `${ns}-todo`, 'data-acg-editor-only': '' })}>
                  <th scope="row" className={`${ns}-row`}>{row.labelled ? row.label : labels.noLabel}</th>
                  <td className={`${ns}-cell ${ns}-us`}><Cell ns={ns} cell={row.us} labels={labels} /></td>
                  <td className={`${ns}-cell ${ns}-them`}><Cell ns={ns} cell={row.them} labels={labels} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : head}
        {hints !== undefined ? hints : editor && cmp.rows.length === 0 && <p className={`${ns}-hint`} data-acg-editor-only="">{labels.empty}</p>}
      </div>
    </section>
  );
}

// CSS for the band (classes `${ns}-<name>`; the theme styles the section and
// wrapper it passes). Block variables (fallbacks in parentheses):
//   --ns-text / -muted / -accent   row labels + title / the other column +
//                                  intro / eyebrow + highlighted words, on
//                                  the section's background
//   --ns-line                      row rules
//   --ns-us-head-bg / -us-head-text   the business's column header (the
//                                  accent fill and its ink)
//   --ns-us-bg / -us-text          the business's cells (an accent tint and
//                                  the text repaired for it)
//   --ns-us-line                   the outline around that column
//   --ns-us-yes (-us-text)         its checks (3:1 on --ns-us-bg)
//   --ns-us-sep (-line)            rules between its cells
//   --ns-yes (-text) / -no (-muted)   the other column's check / any dash
//   --ns-head-font (inherit) / -head-w (800) / -head-case (none)   title
//   --ns-col-w (700) / -col-case (none)   column labels (in --ns-head-font)
//   --ns-r (8px) the column's corners   --ns-max (1000px) table width
// The table holds no link, so it gets no hover state.
export function comparisonCss(ns) {
  const p = `.${ns}`;
  const v = (name, fb) => (fb === undefined ? `var(--${ns}-${name})` : `var(--${ns}-${name},${fb})`);
  const head = v('head-font', 'inherit');
  const r = v('r', '8px');
  const usLine = `2px solid ${v('us-line')}`;
  return `
${p}-head{max-width:760px}
${p}-eyebrow{margin:0 0 14px;font-size:12px;font-weight:700;line-height:1.4;letter-spacing:.2em;text-transform:uppercase;color:${v('accent')}}
${p}-title{margin:0;font-family:${head};font-size:clamp(30px,4.6cqi,52px);font-weight:${v('head-w', '800')};line-height:1.05;letter-spacing:-.01em;text-transform:${v('head-case', 'none')};color:${v('text')};text-wrap:balance;overflow-wrap:break-word}
${p}-em{color:${v('accent')}}
${p}-intro{margin:18px 0 0;max-width:600px;font-size:17px;line-height:1.7;color:${v('muted')};text-wrap:pretty}
${p}-table{width:100%;max-width:${v('max', '1000px')};margin:0;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:14px;line-height:1.4;color:${v('text')}}
${p}-caption{caption-side:top;padding:0 0 clamp(28px,4cqi,48px);text-align:left}
${p}-corner{width:40%;padding:0;border-bottom:1px solid ${v('line')}}
${p}-col{width:30%;padding:12px 6px;font-family:${head};font-size:12px;font-weight:${v('col-w', '700')};line-height:1.25;letter-spacing:.02em;text-align:center;text-transform:${v('col-case', 'none')};vertical-align:middle;overflow-wrap:anywhere}
${p}-col${p}-us{border:${usLine};border-bottom:0;border-radius:${r} ${r} 0 0;background:${v('us-head-bg')};color:${v('us-head-text')}}
${p}-col${p}-them{border-bottom:1px solid ${v('line')};color:${v('muted')}}
${p}-row{padding:14px 10px 14px 0;font-weight:600;text-align:left;vertical-align:middle;overflow-wrap:anywhere;border-bottom:1px solid ${v('line')}}
${p}-cell{padding:14px 6px;text-align:center;vertical-align:middle;border-bottom:1px solid ${v('line')}}
${p}-cell${p}-us{border-right:${usLine};border-left:${usLine};border-bottom-color:${v('us-sep', v('line'))};background:${v('us-bg')};color:${v('us-text')}}
${p}-table tbody tr:last-child ${p}-cell${p}-us{border-bottom:${usLine};border-radius:0 0 ${r} ${r}}
${p}-cell svg{display:inline-block;vertical-align:middle}
${p}-yes{color:${v('yes', v('text'))}}
${p}-us ${p}-yes{color:${v('us-yes', v('us-text'))}}
${p}-no{color:${v('no', v('muted'))}}
${p}-txt{display:block;font-size:13px;font-weight:600;line-height:1.35;overflow-wrap:anywhere}
${p}-them ${p}-txt{font-weight:500;color:${v('muted')}}
${p}-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
${p}-todo ${p}-row{font-size:13px;font-weight:500;opacity:.85}
${p}-todo ${p}-row,${p}-todo ${p}-cell{border-bottom-style:dashed}
${p}-hint{display:flex;width:fit-content;max-width:100%;margin:28px 0 0;padding:10px 14px;border:1.5px dashed rgba(128,128,128,.55);border-radius:6px;font-size:13px;font-weight:500;line-height:1.45;color:inherit;opacity:.85}
@container (min-width:601px){
${p}-table{font-size:16px;line-height:1.45}
${p}-corner{width:50%}
${p}-col{width:25%;padding:18px 16px;font-size:15px}
${p}-row{padding:20px 24px 20px 0}
${p}-cell{padding:20px 16px}
${p}-txt{font-size:15px}
}
`;
}

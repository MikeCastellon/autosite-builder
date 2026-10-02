// Footer builder, under the Footer tab's tagline and social icons: which
// footer columns show and in what order, their titles, the footer button and
// the bottom line (copy.footer). Every change is one setCopy('footer', next)
// with a cleaned object (null = the design's own footer). The Google rating
// line is not here: it is a placement of the Google Rating tab, so there is
// one switch for it, not two that could disagree.
import { Label, Help, Field, Switch, SwitchRow, MoveButtons, Divider, smallInputClass, linkButtonClass } from './fields.jsx';
import {
  FOOTER_LABELS, FOOTER_DEFAULT_TITLES, footerColumns, setColumn, moveColumn, setFooterField, hoursMerged, emptyColumns,
} from './footerBuilder.js';
import { normalizeLink, linkProblem } from './links.js';

// Where each column's content comes from, so the owner knows which tab
// fills it. The footer's Google rating sits in the logo column (and moves
// to the bottom line when that column is off).
function columnNote(type, merged, hasGoogleTab) {
  switch (type) {
    case 'brand': return hasGoogleTab
      ? 'Your logo, name, Footer Tagline and Google rating. Switched off, the rating moves to the bottom line.'
      : 'Your logo, name and Footer Tagline.';
    case 'links': return 'Links to your main sections. Switch a section off in Sections to drop its link.';
    case 'areas': return 'Your Areas served from Business Info.';
    case 'contact': return 'Phone, email and social links from Business Info.';
    case 'hours': return merged ? 'Shown under Get in touch, because it comes right after it.' : 'Shown as its own column.';
    default: return '';
  }
}

// A shown column with nothing in it is left off the page; say what fills it.
const EMPTY_NOTES = {
  areas: 'Nothing to list yet: add your city or areas in Edit > Business Info.',
  contact: 'Nothing to list yet: add a phone, email or social link in Edit > Business Info.',
  hours: 'No hours yet: add them in Edit > Business Info.',
};

export function FooterBuilderFields({ copy, setCopy, hasGoogleTab = false, businessInfo }) {
  const footer = copy?.footer;
  const write = (next) => setCopy('footer', next);
  const cols = footerColumns(footer);
  const merged = hoursMerged(cols);
  const showCta = footer?.showCta !== false;
  const contactShown = cols.some((c) => c.type === 'contact' && c.show);
  const text = (key) => (typeof footer?.[key] === 'string' ? footer[key] : '');
  // Without businessInfo (older callers) nothing is flagged as empty.
  const empty = businessInfo ? emptyColumns(businessInfo) : new Set();

  return (
    <>
      <Divider />
      <Label>Footer columns</Label>
      <Help className="mb-2">Switch columns on or off and use the arrows to reorder them.</Help>
      {cols.map((c, i) => {
        const label = FOOTER_LABELS[c.type];
        return (
          <div key={c.type} className="py-2 border-b border-gray-100">
            {/* Same row layout as the Sections tab: name, arrows, switch. */}
            <div className="flex items-center gap-1">
              <span className={`flex-1 min-w-0 text-[13px] font-medium ${c.show ? 'text-gray-700' : 'text-gray-400 line-through'}`}>{label}</span>
              <MoveButtons index={i} count={cols.length} onMove={(from, to) => write(moveColumn(footer, from, to))} label={label} />
              <span className="ml-1 flex">
                <Switch on={c.show} onChange={(on) => write(setColumn(footer, c.type, { show: on }))} label={`Show ${label}`} />
              </span>
            </div>
            {c.show && c.type !== 'brand' && (
              <input
                type="text"
                value={c.title}
                placeholder={`Title (default: ${FOOTER_DEFAULT_TITLES[c.type]})`}
                aria-label={`${label} title`}
                maxLength={30}
                onChange={(e) => write(setColumn(footer, c.type, { title: e.target.value }))}
                className={`${smallInputClass} mt-1.5`}
              />
            )}
            <p className="mt-1 text-[11px] text-gray-500 leading-snug">{columnNote(c.type, merged, hasGoogleTab)}</p>
            {c.show && empty.has(c.type) && <Help tone="warn" className="mt-0.5">{EMPTY_NOTES[c.type]}</Help>}
          </div>
        );
      })}

      <div className="mt-4">
        <Label>Footer button</Label>
        <SwitchRow
          label="Show the button"
          on={showCta}
          onChange={(on) => write(setFooterField(footer, 'showCta', on))}
          help={showCta && !contactShown ? 'Get in touch is switched off above, so the button is hidden.' : undefined}
          helpTone="warn"
        />
        {showCta && (
          <>
            <Field label="Button text" value={text('ctaText')} onChange={(v) => write(setFooterField(footer, 'ctaText', v))}
              placeholder="Request Appointment" maxLength={30} />
            <Field label="Button link" value={text('ctaUrl')} onChange={(v) => write(setFooterField(footer, 'ctaUrl', v))}
              onBlur={(v) => { if (normalizeLink(v) !== v) write(setFooterField(footer, 'ctaUrl', normalizeLink(v))); }}
              placeholder="Leave empty for your booking form"
              help={linkProblem(text('ctaUrl')) || 'Sits in the Get in touch column, so it hides when that column is off. Left empty, it opens your booking form, or goes to your contact section while booking is off.'}
              helpTone={linkProblem(text('ctaUrl')) ? 'error' : undefined} />
          </>
        )}
      </div>

      <Field label="Bottom line" value={text('bottomText')} onChange={(v) => write(setFooterField(footer, 'bottomText', v))}
        placeholder="Leave empty for your city and service facts" maxLength={80}
        help="Only things that are true, e.g. 'Licensed & insured'." />

      {hasGoogleTab && <Help className="-mt-2 mb-3">The Google rating line is set in Edit &gt; Google Rating.</Help>}

      {footer != null && (
        <button type="button" className={linkButtonClass} onClick={() => setCopy('footer', null)}>
          Use the design&apos;s footer
        </button>
      )}
    </>
  );
}

export default function FooterBuilderPanel(props) {
  return <FooterBuilderFields {...props} />;
}

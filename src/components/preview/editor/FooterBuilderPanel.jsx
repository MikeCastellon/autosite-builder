// Footer builder, under the Footer tab's tagline and social icons: which
// footer columns show and in what order, their titles, the footer button and
// the bottom line (copy.footer). Every change is one setCopy('footer', next)
// with a cleaned object (null = the design's own footer). The Google rating
// line is not here: it is a placement of the Google Rating tab, so there is
// one switch for it, not two that could disagree. `spec` is the template's
// footerSpec (useTemplateInfo): its columns, titles, button default and
// column notes; without one, Redline's (footerBuilder DEFAULT_SPEC).
import { Label, Help, Field, Switch, SwitchRow, MoveButtons, Divider, smallInputClass, linkButtonClass } from './fields.jsx';
import {
  FOOTER_LABELS, footerSpecOf, footerColumns, setColumn, moveColumn, setFooterField, footerShowsCta, hoursMerged, emptyColumns,
} from './footerBuilder.js';
import { normalizeLink, linkProblem } from './links.js';

// Where each column's content comes from, so the owner knows which tab
// fills it. The footer's Google rating sits in the logo column (and moves
// to the bottom line when that column is off).
function columnNote(type, merged, hasGoogleTab, notes, contactName = 'Get in touch') {
  if (type !== 'hours' && typeof notes?.[type] === 'string' && notes[type]) return notes[type];
  switch (type) {
    case 'brand': return hasGoogleTab
      ? 'Your logo, name, Footer Tagline and Google rating. Switched off, the rating moves to the bottom line.'
      : 'Your logo, name and Footer Tagline.';
    case 'links': return 'Links to your main sections. Switch a section off in Sections to drop its link.';
    case 'services': return 'Your services, linking to your Services section.';
    case 'areas': return 'Your Areas served from Business Info.';
    case 'contact': return 'Phone, email and social links from Business Info.';
    case 'hours': return merged ? `Shown under ${contactName}, because it comes right after it.` : 'Shown as its own column.';
    default: return '';
  }
}

// A shown column with nothing in it is left off the page; say what fills it.
const EMPTY_NOTES = {
  areas: 'Nothing to list yet: add your city or areas in Edit > Business Info.',
  contact: 'Nothing to list yet: add a phone, email or social link in Edit > Business Info.',
  contactNoSocial: 'Nothing to list yet: add a phone or email in Edit > Business Info.',
  hours: 'No hours yet: add them in Edit > Business Info.',
  services: 'Nothing to list yet: add services in Edit > Services, or switch the Services section on in Edit > Sections.',
};

export function FooterBuilderFields({ copy, setCopy, hasGoogleTab = false, businessInfo, spec = null }) {
  const footer = copy?.footer;
  const write = (next) => setCopy('footer', next);
  const sp = footerSpecOf(spec);
  const cols = footerColumns(footer, spec);
  const merged = hoursMerged(cols, spec);
  const showCta = footerShowsCta(footer, spec);
  const contactShown = cols.some((c) => c.type === 'contact' && c.show);
  const text = (key) => (typeof footer?.[key] === 'string' ? footer[key] : '');
  // Without businessInfo (older callers) nothing is flagged as empty. The
  // footer button keeps the contact column on the page by itself, while it
  // has somewhere to go (its link, else the contact section).
  const empty = businessInfo ? emptyColumns(businessInfo, spec, { copy, cols }) : new Set();
  const ctaGoes = Boolean(text('ctaUrl')) || !(Array.isArray(copy?.hiddenSections) && copy.hiddenSections.includes('cta'));
  if (showCta && ctaGoes) empty.delete('contact');
  // The contact column by the name the page gives it ("Contact", "Say
  // Hi!"); Redline's "Get In Touch" keeps the panel's own wording.
  const ownContact = typeof sp.titles.contact === 'string' ? sp.titles.contact.trim() : '';
  const contactName = ownContact && ownContact.toLowerCase() !== 'get in touch' ? ownContact : 'Get in touch';
  const labelOf = (type) => (type === 'contact' ? contactName : FOOTER_LABELS[type]);
  const brandOff = !cols.some((c) => c.type === 'brand' && c.show);
  const contactSocial = !Array.isArray(sp.contactFields) || sp.contactFields.includes('instagram') || (sp.socialWhenBrandOff === true && brandOff);

  return (
    <>
      <Divider />
      <Label>Footer columns</Label>
      <Help className="mb-2">Switch columns on or off and use the arrows to reorder them.</Help>
      {cols.map((c, i) => {
        const label = labelOf(c.type);
        return (
          <div key={c.type} className="py-2 border-b border-gray-100">
            {/* Same row layout as the Sections tab: name, arrows, switch. */}
            <div className="flex items-center gap-1">
              <span className={`flex-1 min-w-0 text-[13px] font-medium ${c.show ? 'text-gray-700' : 'text-gray-400 line-through'}`}>{label}</span>
              <MoveButtons index={i} count={cols.length} onMove={(from, to) => write(moveColumn(footer, from, to, spec))} label={label} />
              <span className="ml-1 flex">
                <Switch on={c.show} onChange={(on) => write(setColumn(footer, c.type, { show: on }, spec))} label={`Show ${label}`} />
              </span>
            </div>
            {c.show && c.type !== 'brand' && (
              <input
                type="text"
                value={c.title}
                placeholder={`Title (default: ${sp.titles[c.type] || label})`}
                aria-label={`${label} title`}
                maxLength={30}
                onChange={(e) => write(setColumn(footer, c.type, { title: e.target.value }, spec))}
                className={`${smallInputClass} mt-1.5`}
              />
            )}
            <p className="mt-1 text-[11px] text-gray-500 leading-snug">{columnNote(c.type, merged, hasGoogleTab, sp.notes, contactName)}</p>
            {c.show && empty.has(c.type) && (
              <Help tone="warn" className="mt-0.5">{c.type === 'contact' && !contactSocial ? EMPTY_NOTES.contactNoSocial : EMPTY_NOTES[c.type]}</Help>
            )}
          </div>
        );
      })}

      <div className="mt-4">
        <Label>Footer button</Label>
        <SwitchRow
          label="Show the button"
          on={showCta}
          onChange={(on) => write(setFooterField(footer, 'showCta', on, spec))}
          help={showCta && !contactShown ? `${contactName} is switched off above, so the button is hidden.` : undefined}
          helpTone="warn"
        />
        {showCta && (
          <>
            <Field label="Button text" value={text('ctaText')} onChange={(v) => write(setFooterField(footer, 'ctaText', v, spec))}
              placeholder={sp.ctaLabel || 'Request Appointment'} maxLength={30} />
            <Field label="Button link" value={text('ctaUrl')} onChange={(v) => write(setFooterField(footer, 'ctaUrl', v, spec))}
              onBlur={(v) => { if (normalizeLink(v) !== v) write(setFooterField(footer, 'ctaUrl', normalizeLink(v), spec)); }}
              placeholder="Leave empty for your booking form"
              help={linkProblem(text('ctaUrl')) || `Sits in the ${contactName} column, so it hides when that column is off. Left empty, it opens your booking form, or goes to your contact section while booking is off.`}
              helpTone={linkProblem(text('ctaUrl')) ? 'error' : undefined} />
          </>
        )}
      </div>

      <Field label="Bottom line" value={text('bottomText')} onChange={(v) => write(setFooterField(footer, 'bottomText', v, spec))}
        placeholder={spec ? 'Leave empty for the design\'s own bottom line' : 'Leave empty for your city and service facts'} maxLength={80}
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

// Edit > Headings: the small label, heading, highlighted words and intro line
// of each section, in the owner's section order (copy.sectionTitles). Which
// fields a section offers comes from the template's `headingFields` export;
// a heading another tab already owns (the hero headline, the services heading,
// the contact headline) is edited at that key, so both tabs show one text.
// Each section is a <details> rather than React state, so the open rows are
// plain DOM and the panel renders the same on the server (tests).
// A template that exports headingDefaults(businessInfo, copy) shows its own
// heading text as each empty field's placeholder, and the highlighted words
// are checked against it, since that is the heading the page shows.
import { Field, Help } from './fields.jsx';
import { FROM_LABELS, headingRows, headingValue, setSectionTitle, accentStatus, emptyAccentText, designDefaults } from './sectionHeadings.js';
import { typedGoogleFacts } from './googleRating.js';

const DESIGN_HEADING = "Design's heading";
const DESIGN_LABEL = "Design's label";

// The highlighted-words check under the field: an error or warning line, or
// a preview of the heading with the matched words in the accent style.
function accentHelp(status, emptyText) {
  if (status.tone === 'ok') {
    const { before, match, after } = status.parts;
    const label = status.design ? "Preview (the design's heading): " : 'Preview: ';
    return { help: <>{label}{before}<strong className="text-red-600">{match}</strong>{after}</>, helpTone: 'muted' };
  }
  if (status.tone) return { help: status.text, helpTone: status.tone };
  return { help: emptyText, helpTone: undefined };
}

// The gray line under a section's name: what its heading says now (the
// owner's, else the design's own when the template says what it is).
function summaryLine(copy, row, d) {
  if (row.fields.includes('title')) return headingValue(copy, row, 'title').trim() || d.title || DESIGN_HEADING;
  if (row.fields.includes('eyebrow')) return headingValue(copy, row, 'eyebrow').trim() || d.eyebrow || DESIGN_LABEL;
  return d.title || DESIGN_HEADING;
}

function HeadingRow({ row, copy, setCopy, hidden, open, defaults, googleConnected }) {
  const ph = row.placeholder || {};
  // The design's own text for this section ({} when unknown).
  const d = (defaults && defaults[row.id]) || {};
  // Every sectionTitles change goes through one setCopy (null clears it).
  const writeTitle = (key, v) => setCopy('sectionTitles', setSectionTitle(copy?.sectionTitles, row.id, key, v));
  const idFor = (key) => `hd-${row.id}-${key}`;
  const title = headingValue(copy, row, 'title');
  // A count typed into the Reviews heading stays put when the listing is
  // refreshed (Edit > Google Rating), so the page can show two counts.
  const typedCount = googleConnected && row.id === 'testimonials'
    ? typedGoogleFacts(copy).find((f) => f.where === 'Reviews heading') : null;

  const fields = row.fields.map((key) => {
    if (key === 'eyebrow') {
      return (
        <Field key={key} id={idFor(key)} label="Small label" value={headingValue(copy, row, 'eyebrow')} onChange={(v) => writeTitle('eyebrow', v)}
          maxLength={60} placeholder={d.eyebrow || ph.eyebrow || DESIGN_LABEL} />
      );
    }
    if (key === 'title') {
      return (
        <Field key={key} id={idFor(key)} label="Heading" value={title}
          onChange={(v) => (row.titleFrom ? setCopy(row.titleFrom, v) : writeTitle('title', v))}
          help={row.titleFrom ? `Same text as ${FROM_LABELS[row.titleFrom]}.` : undefined}
          placeholder={d.title || ph.title || DESIGN_HEADING} />
      );
    }
    if (key === 'accent') {
      const accent = headingValue(copy, row, 'accent');
      return (
        <Field key={key} id={idFor(key)} label="Highlighted words" value={accent} onChange={(v) => writeTitle('accent', v)}
          placeholder="Words from the heading, e.g. Right Choice"
          {...accentHelp(accentStatus(title, accent, d.title), defaults ? emptyAccentText(d.accent) : undefined)} />
      );
    }
    // intro: a key another tab owns keeps that tab's (unlimited) length, so
    // an existing longer text is never cut off by the counter.
    return (
      <Field key={key} id={idFor(key)} label="Intro line" value={headingValue(copy, row, 'intro')} multiline rows={2}
        onChange={(v) => (row.introFrom ? setCopy(row.introFrom, v) : writeTitle('intro', v))}
        maxLength={row.introFrom ? undefined : 200}
        help={row.introFrom ? `Same text as ${FROM_LABELS[row.introFrom]}.` : undefined}
        placeholder={ph.intro || ''} />
    );
  });

  return (
    <details open={open} className="group mb-2 border border-gray-200 rounded-lg">
      <summary className="flex items-start gap-2 px-3 py-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-medium text-gray-800">
            {row.label}
            {hidden && <span className="text-gray-400 font-normal"> · switched off</span>}
          </span>
          <span className="block text-[11px] text-gray-400 truncate">{summaryLine(copy, row, d)}</span>
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="mt-1 shrink-0 text-gray-400 transition-transform group-open:rotate-180">
          <path d="M3 4.5L6 7.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="px-3 pt-1">
        {fields}
        {typedCount && (
          <Help tone="warn" className="mt-0 mb-3">
            {`"${typedCount.text}" is typed, so it won't change when you refresh Edit > Google Rating. Leave the heading empty to use the design's heading, or update it after each refresh.`}
          </Help>
        )}
      </div>
    </details>
  );
}

export function HeadingsFields({ copy, setCopy, sections, headingFields, hiddenSections = [], businessInfo, headingDefaults }) {
  const rows = headingRows(sections, headingFields);
  const defaults = designDefaults(headingDefaults, businessInfo, copy);
  const hiddenIds = new Set(Array.isArray(hiddenSections) ? hiddenSections : []);
  const generic = rows.some((r) => r.generic);
  return (
    <>
      <Help className="mb-3">Headings for each part of your page. Leave a field empty to keep the design&apos;s own text.</Help>
      {generic && <Help className="-mt-2 mb-3">This design may not use every field.</Help>}
      {/* No sections yet means the template info is still loading; sections
          but no rows means this design has nothing to set here. */}
      {!rows.length && (
        <Help className="mb-3">{Array.isArray(sections) && sections.length ? 'This design has no headings to set here.' : 'Loading sections…'}</Help>
      )}
      {rows.map((row, i) => (
        <HeadingRow key={row.id} row={row} copy={copy} setCopy={setCopy} hidden={hiddenIds.has(row.id)} open={i === 0} defaults={defaults} googleConnected={Boolean(businessInfo?.googlePlace?.placeId)} />
      ))}
    </>
  );
}

export default function HeadingsPanel(props) {
  return <HeadingsFields {...props} />;
}

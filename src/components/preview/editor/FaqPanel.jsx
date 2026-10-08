// Edit > FAQ: the band's questions and answers (copy.faq.items), and its
// heading and intro line (copy.faq; Edit > Headings edits the same two and
// adds the small label and the highlighted words). The band is opt-in: it is
// on while copy.faq exists, and the published page shows a question only
// once it has an answer (kit/faq.js), also as FAQPage data for search
// engines.
//   confirm(message, { title, confirmText }) -> Promise<boolean>: the
//                       editor's dialog, before the section is removed
import { Label, Help, Note, Field, MoveButtons, dashedButtonClass, linkButtonClass } from './fields.jsx';
import { FAQ_DEFAULTS } from '../templates/kit/faq.js';
import {
  FAQ_TITLE_MAX, FAQ_INTRO_MAX, FAQ_Q_MAX, FAQ_A_MAX, FAQ_MAX_ITEMS,
  faqValue, faqStart, faqRows, faqSetText, faqSetItem, faqAddItem, faqRemoveItem, faqMoveItem,
} from './faqEdit.js';

export function FaqPanel({ copy, setCopy, confirm, hasHeadingsTab = false }) {
  const faq = faqValue(copy);
  const hidden = Array.isArray(copy?.hiddenSections) && copy.hiddenSections.includes('faq');
  const hiddenNote = hidden && <Note tone="warn" title="This section is switched off in Sections." />;

  if (!faq) {
    return (
      <>
        {hiddenNote}
        <Help className="mt-0 mb-3">Answer the questions customers ask most, each in a box that opens with a tap. Search engines can show them too.</Help>
        <button type="button" className={dashedButtonClass} onClick={() => setCopy('faq', faqStart())}>
          + Add a FAQ section
        </button>
      </>
    );
  }

  const rows = faqRows(copy);
  const write = (next) => setCopy('faq', next);
  const addItem = () => {
    const next = faqAddItem(faq);
    if (next) write(next);
  };
  const removeSection = async () => {
    const ok = typeof confirm === 'function'
      ? await confirm('Remove the FAQ section? Its questions and answers come off your page too.', { title: 'Remove section?', confirmText: 'Remove' })
      : true;
    if (ok) setCopy('faq', null);
  };

  return (
    <>
      {hiddenNote}
      <Field label="Heading" value={faq.title} onChange={(v) => write(faqSetText(faq, 'title', v))} placeholder={FAQ_DEFAULTS.title} maxLength={FAQ_TITLE_MAX} />
      <Field label="Intro line" value={faq.intro} onChange={(v) => write(faqSetText(faq, 'intro', v))} placeholder="Optional" maxLength={FAQ_INTRO_MAX} multiline rows={2} />
      {hasHeadingsTab && <Help className="-mt-2 mb-4">The small label above the heading and its highlighted words: Edit &gt; Headings.</Help>}

      <Label>Questions</Label>
      <Help className="mt-0 mb-3">A question shows on your site once it has an answer. A blank line in an answer starts a new paragraph. Up to {FAQ_MAX_ITEMS}.</Help>
      {rows.map((row, i) => (
        <div key={row.index} className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Question {i + 1}</p>
            <span className="flex items-center gap-1">
              <MoveButtons index={i} count={rows.length} onMove={(from, to) => write(faqMoveItem(faq, from, to))} label={`question ${i + 1}`} />
              <button type="button" onClick={() => write(faqRemoveItem(faq, i))} className="ml-1 text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
            </span>
          </div>
          <Field label="Question" value={row.q} onChange={(v) => write(faqSetItem(faq, i, 'q', v))} placeholder="e.g. Do you offer same-day service?" maxLength={FAQ_Q_MAX} />
          <Field label="Answer" value={row.a} onChange={(v) => write(faqSetItem(faq, i, 'a', v))} placeholder="Your answer, in a sentence or two" maxLength={FAQ_A_MAX} multiline rows={4} />
          {!row.complete && <Help tone="warn" className="-mt-2">Not on your site yet: it needs a question and an answer.</Help>}
        </div>
      ))}
      <button type="button" className={dashedButtonClass} disabled={rows.length >= FAQ_MAX_ITEMS} onClick={addItem}>
        {rows.length >= FAQ_MAX_ITEMS ? `Up to ${FAQ_MAX_ITEMS} questions` : '+ Add a question'}
      </button>
      <button type="button" className={linkButtonClass} onClick={removeSection}>Remove this section</button>
    </>
  );
}

export default FaqPanel;

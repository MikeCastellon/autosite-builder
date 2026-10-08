// Edit > Before & After: the band's photo pairs (images baBefore<i> /
// baAfter<i>), each with an optional caption, and its heading and intro
// line (copy.beforeAfter; Edit > Headings edits the same two and adds the
// small label and the highlighted words). The band is opt-in: it is on
// while copy.beforeAfter exists, and the published page shows a pair only
// once it has both photos (kit/beforeAfter.js).
//   setImage(key, url)  one photo (ImageSlot uploads under that key)
//   patchImages(fn)     the whole images map in one write, fn(latest map):
//                       removing or moving a pair moves its photos too
//   confirm(message, { title, confirmText }) -> Promise<boolean>: the
//                       editor's dialog, before the section is removed
import { Label, Help, Note, Field, ImageSlot, MoveButtons, dashedButtonClass, linkButtonClass } from './fields.jsx';
import { BA_MAX_PAIRS, BA_DEFAULTS, baBeforeKey, baAfterKey } from '../templates/kit/beforeAfter.js';
import {
  BA_TITLE_MAX, BA_INTRO_MAX, BA_CAPTION_MAX,
  baValue, baStart, baRows, baSetText, baSetCaption, baAddPair, baRemovePair, baMovePair, baRemoveImages, baMoveImages, baWithoutImages,
} from './beforeAfterEdit.js';

export function BeforeAfterPanel({ copy, setCopy, images, setImage, patchImages, siteId, confirm, hasHeadingsTab = false }) {
  const ba = baValue(copy);
  const hidden = Array.isArray(copy?.hiddenSections) && copy.hiddenSections.includes('beforeAfter');
  const hiddenNote = hidden && <Note tone="warn" title="This section is switched off in Sections." />;

  if (!ba) {
    return (
      <>
        {hiddenNote}
        <Help className="mt-0 mb-3">Show your work in pairs of photos of the same vehicle, one before and one after. Visitors drag a slider across each pair to compare them.</Help>
        <button type="button" className={dashedButtonClass} onClick={() => setCopy('beforeAfter', baStart())}>
          + Add a Before &amp; After section
        </button>
      </>
    );
  }

  const rows = baRows(copy, images);
  const write = (next) => setCopy('beforeAfter', next);
  const removePair = (i) => {
    write(baRemovePair(ba, images, i));
    patchImages((prev) => baRemoveImages(prev, i));
  };
  const movePair = (from, to) => {
    write(baMovePair(ba, images, from, to));
    patchImages((prev) => baMoveImages(prev, from, to));
  };
  const addPair = () => {
    const next = baAddPair(ba, images);
    if (next) write(next);
  };
  const removeSection = async () => {
    const ok = typeof confirm === 'function'
      ? await confirm('Remove the Before & After section? Its photos and captions come off your page too.', { title: 'Remove section?', confirmText: 'Remove' })
      : true;
    if (!ok) return;
    setCopy('beforeAfter', null);
    patchImages((prev) => baWithoutImages(prev));
  };

  return (
    <>
      {hiddenNote}
      <Field label="Heading" value={ba.title} onChange={(v) => write(baSetText(ba, 'title', v))} placeholder={BA_DEFAULTS.title} maxLength={BA_TITLE_MAX} />
      <Field label="Intro line" value={ba.intro} onChange={(v) => write(baSetText(ba, 'intro', v))} placeholder={BA_DEFAULTS.intro} maxLength={BA_INTRO_MAX} multiline rows={2} />
      {hasHeadingsTab && <Help className="-mt-2 mb-4">The small label above the heading and its highlighted words: Edit &gt; Headings.</Help>}

      <Label>Photo pairs</Label>
      <Help className="mt-0 mb-3">A pair shows on your site once it has both photos. With two or more, visitors swipe or use the arrows. Up to {BA_MAX_PAIRS}.</Help>
      {rows.map((row, i) => (
        <div key={row.index} className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Pair {i + 1}</p>
            <span className="flex items-center gap-1">
              <MoveButtons index={i} count={rows.length} onMove={movePair} label={`pair ${i + 1}`} />
              <button type="button" onClick={() => removePair(i)} className="ml-1 text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
            </span>
          </div>
          <ImageSlot label={`Before & After ${i + 1}: before photo`} value={images?.[baBeforeKey(i)]} onChange={(v) => setImage(baBeforeKey(i), v)} siteId={siteId} uploadKey={baBeforeKey(i)} />
          <ImageSlot label={`Before & After ${i + 1}: after photo`} value={images?.[baAfterKey(i)]} onChange={(v) => setImage(baAfterKey(i), v)} siteId={siteId} uploadKey={baAfterKey(i)} />
          <Field label="Caption (optional)" value={row.caption} onChange={(v) => write(baSetCaption(ba, images, i, v))} placeholder="e.g. Paint correction on a black sedan" maxLength={BA_CAPTION_MAX} />
          {!row.complete && <Help tone="warn" className="-mt-2">Not on your site yet: it needs both photos.</Help>}
        </div>
      ))}
      <button type="button" className={dashedButtonClass} disabled={rows.length >= BA_MAX_PAIRS} onClick={addPair}>
        {rows.length >= BA_MAX_PAIRS ? `Up to ${BA_MAX_PAIRS} pairs` : '+ Add a pair'}
      </button>
      <button type="button" className={linkButtonClass} onClick={removeSection}>Remove this section</button>
    </>
  );
}

export default BeforeAfterPanel;

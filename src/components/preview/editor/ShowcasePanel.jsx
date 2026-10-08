// Edit > Detail Showcase: the band's photo cards (images showcase<i>), each
// with a short title and an optional caption, and its heading and intro
// line (copy.showcase; Edit > Headings edits the same two and adds the small
// label and the highlighted words). The band is opt-in: it is on while
// copy.showcase exists, and the published page shows a card only once it
// has a photo and a title (kit/showcase.js).
//   setImage(key, url)  one photo (ImageSlot uploads under that key)
//   patchImages(fn)     the whole images map in one write, fn(latest map):
//                       removing or moving a card moves its photo too
//   confirm(message, { title, confirmText }) -> Promise<boolean>: the
//                       editor's dialog, before the section is removed
import { Label, Help, Note, Field, ImageSlot, MoveButtons, dashedButtonClass, linkButtonClass } from './fields.jsx';
import { SHOWCASE_DEFAULTS, showcaseKey } from '../templates/kit/showcase.js';
import {
  SC_TITLE_MAX, SC_INTRO_MAX, SC_ITEM_TITLE_MAX, SC_CAPTION_MAX, SC_MAX_ITEMS,
  scValue, scStart, scRows, scSetText, scSetItem, scAddItem, scRemoveItem, scMoveItem, scRemoveImages, scMoveImages, scWithoutImages,
} from './showcaseEdit.js';

// What a card still needs before it shows on the site.
function missing(row) {
  if (!row.photo && !row.title.trim()) return 'Not on your site yet: it needs a photo and a title.';
  if (!row.photo) return 'Not on your site yet: it needs a photo.';
  return 'Not on your site yet: it needs a title.';
}

export function ShowcasePanel({ copy, setCopy, images, setImage, patchImages, siteId, confirm, hasHeadingsTab = false }) {
  const sc = scValue(copy);
  const hidden = Array.isArray(copy?.hiddenSections) && copy.hiddenSections.includes('showcase');
  const hiddenNote = hidden && <Note tone="warn" title="This section is switched off in Sections." />;

  if (!sc) {
    return (
      <>
        {hiddenNote}
        <Help className="mt-0 mb-3">Show off your finish up close: large photos of your work, each with a short title like Paint Correction or Ceramic Coating.</Help>
        <button type="button" className={dashedButtonClass} onClick={() => setCopy('showcase', scStart())}>
          + Add a Detail Showcase section
        </button>
      </>
    );
  }

  const rows = scRows(copy, images);
  const write = (next) => { if (next) setCopy('showcase', next); };
  const removeItem = (i) => {
    write(scRemoveItem(sc, images, i));
    patchImages((prev) => scRemoveImages(prev, i));
  };
  const moveItem = (from, to) => {
    write(scMoveItem(sc, images, from, to));
    patchImages((prev) => scMoveImages(prev, from, to));
  };
  const removeSection = async () => {
    const ok = typeof confirm === 'function'
      ? await confirm('Remove the Detail Showcase section? Its photos and titles come off your page too.', { title: 'Remove section?', confirmText: 'Remove' })
      : true;
    if (!ok) return;
    setCopy('showcase', null);
    patchImages((prev) => scWithoutImages(prev));
  };
  const full = rows.length >= SC_MAX_ITEMS;

  return (
    <>
      {hiddenNote}
      <Field label="Heading" value={sc.title} onChange={(v) => write(scSetText(sc, 'title', v))} placeholder={SHOWCASE_DEFAULTS.title} maxLength={SC_TITLE_MAX} />
      <Field label="Intro line" value={sc.intro} onChange={(v) => write(scSetText(sc, 'intro', v))} placeholder="Optional" maxLength={SC_INTRO_MAX} multiline rows={2} />
      {hasHeadingsTab && <Help className="-mt-2 mb-4">The small label above the heading and its highlighted words: Edit &gt; Headings.</Help>}

      <Label>Photos</Label>
      <Help className="mt-0 mb-3">A card shows on your site once it has a photo and a title. Tall photos suit it best. Up to {SC_MAX_ITEMS}.</Help>
      {rows.map((row, i) => (
        <div key={row.index} className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Card {i + 1}</p>
            <span className="flex items-center gap-1">
              <MoveButtons index={i} count={rows.length} onMove={moveItem} label={`card ${i + 1}`} />
              <button type="button" onClick={() => removeItem(i)} className="ml-1 text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
            </span>
          </div>
          <ImageSlot label={`Detail Showcase ${i + 1}: photo`} value={images?.[showcaseKey(i)]} onChange={(v) => setImage(showcaseKey(i), v)} siteId={siteId} uploadKey={showcaseKey(i)} />
          <Field label="Title" value={row.title} onChange={(v) => write(scSetItem(sc, images, i, 'title', v))} placeholder="e.g. Ceramic Protection" maxLength={SC_ITEM_TITLE_MAX} />
          <Field label="Caption (optional)" value={row.caption} onChange={(v) => write(scSetItem(sc, images, i, 'caption', v))} placeholder="e.g. Two coats on a black SUV" maxLength={SC_CAPTION_MAX} multiline rows={2} />
          {!row.complete && <Help tone="warn" className="-mt-2">{missing(row)}</Help>}
        </div>
      ))}
      <button type="button" className={dashedButtonClass} disabled={full} onClick={() => write(scAddItem(sc, images))}>
        {full ? `Up to ${SC_MAX_ITEMS} photos` : '+ Add a photo card'}
      </button>
      <button type="button" className={linkButtonClass} onClick={removeSection}>Remove this section</button>
    </>
  );
}

export default ShowcasePanel;

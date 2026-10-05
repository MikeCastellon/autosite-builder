import { mergeSectionOrder, orderNeedsRepair } from './sectionManifest.js';

/**
 * Returns a CSS order value for a section based on the saved section order.
 * Templates should wrap each section in a div with style={{ order: getOrder('sectionId') }}.
 * The template root should use display: flex; flex-direction: column.
 */
export function buildSectionOrder(generatedCopy, defaultIds) {
  const saved = generatedCopy?.sectionOrder;
  if (!saved || saved.length === 0) return (id) => defaultIds.indexOf(id);
  return (id) => {
    const idx = saved.indexOf(id);
    return idx >= 0 ? idx : 999;
  };
}

/**
 * buildSectionOrder for a template that added section ids after sites were
 * saved with it (the template's `addedSections` export). Saved sites keep
 * exactly their old order values, so their pages do not move:
 * - an id that is not in `added` gets buildSectionOrder over the other ids;
 * - an added id the owner placed (it is in a non-empty copy.sectionOrder)
 *   gets its saved index;
 * - an added id without a saved slot shares the order value of the nearest
 *   id before it in `ids` that has one (an old id, or an added id with a
 *   saved slot), else 0. The template renders it right after that section in
 *   the DOM, so the flex order tie keeps it there. An old id missing from a
 *   non-empty saved order (999: a section the owner hid before it was saved,
 *   e.g. statsBar) is skipped, so the band never lands at the page's end.
 */
export function buildSectionOrderAdded(generatedCopy, ids, added) {
  const extra = Array.isArray(added) ? added : [];
  const isAdded = (id) => extra.includes(id);
  const base = buildSectionOrder(generatedCopy, ids.filter((id) => !isAdded(id)));
  const saved = generatedCopy?.sectionOrder;
  const hasSaved = Array.isArray(saved) && saved.length > 0;
  const slot = (id) => (hasSaved ? saved.indexOf(id) : -1);
  return (id) => {
    if (!isAdded(id)) return base(id);
    if (slot(id) >= 0) return slot(id);
    for (let i = ids.indexOf(id) - 1; i >= 0; i--) {
      const pred = ids[i];
      if (!isAdded(pred) && !(hasSaved && slot(pred) < 0)) return base(pred);
      if (slot(pred) >= 0) return slot(pred);
    }
    return 0;
  };
}

/**
 * The editor's order repair (ContentEditor) for a saved order that lacks
 * some of a template's sections: the order to save, or null when nothing
 * is missing. Only the template's older ids count and get slotted in
 * (mergeSectionOrder; other templates' ids stay where they are). Its
 * `added` ids are left out: they order themselves (buildSectionOrderAdded),
 * and writing them into the saved list would shift every later old id's
 * saved index, so a repaired site would move sections it never touched.
 * An added id the saved order already holds keeps its slot.
 */
export function repairSectionOrder(savedOrder, ids, added) {
  const extra = Array.isArray(added) ? added : [];
  const legacy = (Array.isArray(ids) ? ids : []).filter((id) => !extra.includes(id));
  if (!orderNeedsRepair(savedOrder, legacy)) return null;
  return mergeSectionOrder(savedOrder, legacy, { keepForeign: true });
}

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

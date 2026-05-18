import { getCatalogEntry, getDefaultSectionTypesForTemplate } from '../data/sectionCatalog.js';

export function makeInstanceId() {
  // 8 base36 chars give ~2.8e12 combos — collision-free within a single site
  return 'inst_' + Math.random().toString(36).slice(2, 10);
}

export function getDefaultSectionsForTemplate(templateId) {
  const types = getDefaultSectionTypesForTemplate(templateId);
  return types.map((type) => {
    const entry = getCatalogEntry(type);
    const locked = entry?.locked;
    return {
      id: makeInstanceId(),
      type,
      ...(locked ? { locked } : {}),
    };
  });
}

export function hasInstance(sections, type) {
  return Array.isArray(sections) && sections.some(s => s.type === type);
}

export function getOrderForType(sections, type) {
  if (!Array.isArray(sections)) return -1;
  return sections.findIndex(s => s.type === type);
}

export function getOrderForId(sections, id) {
  if (!Array.isArray(sections)) return -1;
  return sections.findIndex(s => s.id === id);
}

export function addInstance(sections, type) {
  const newInst = { id: makeInstanceId(), type };
  const bottomIdx = sections.findIndex(s => s.locked === 'bottom');
  if (bottomIdx === -1) return [...sections, newInst];
  return [...sections.slice(0, bottomIdx), newInst, ...sections.slice(bottomIdx)];
}

export function removeInstance(sections, id) {
  const target = sections.find(s => s.id === id);
  if (!target || target.locked) return sections;
  return sections.filter(s => s.id !== id);
}

export function moveInstance(sections, id, targetIdx) {
  const fromIdx = sections.findIndex(s => s.id === id);
  if (fromIdx === -1) return sections;

  const moving = sections[fromIdx];
  if (moving.locked) return sections;

  const topLocked = sections[0]?.locked === 'top';
  const bottomLocked = sections[sections.length - 1]?.locked === 'bottom';
  if (topLocked && targetIdx === 0) return sections;
  if (bottomLocked && targetIdx === sections.length - 1) return sections;

  const next = sections.slice();
  next.splice(fromIdx, 1);
  next.splice(targetIdx, 0, moving);
  return next;
}

export function duplicateInstance(sections, id) {
  const target = sections.find(s => s.id === id);
  if (!target) return sections;
  const entry = getCatalogEntry(target.type);
  if (!entry?.multi) return sections;
  const fromIdx = sections.indexOf(target);
  const copy = { id: makeInstanceId(), type: target.type };
  return [...sections.slice(0, fromIdx + 1), copy, ...sections.slice(fromIdx + 1)];
}

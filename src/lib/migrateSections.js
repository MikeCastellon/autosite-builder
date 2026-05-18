import { makeInstanceId } from './sectionInstances.js';
import { getDefaultSectionTypesForTemplate, getCatalogEntry } from '../data/sectionCatalog.js';

export function needsMigration(copy) {
  return !Array.isArray(copy?.sections);
}

export function migrateSections(copy, templateId) {
  if (!needsMigration(copy)) return copy;

  const defaultIds = getDefaultSectionTypesForTemplate(templateId);
  const sourceOrder = (copy?.sectionOrder?.length ? copy.sectionOrder : defaultIds);
  const hidden = new Set(copy?.hiddenSections || []);

  // Build the visible types, preserving saved order.
  let types = sourceOrder.filter(t => !hidden.has(t));

  // Force locked-top type ('hero') to be present and first.
  const topType = defaultIds.find(t => getCatalogEntry(t)?.locked === 'top') || 'hero';
  types = [topType, ...types.filter(t => t !== topType)];

  // Force locked-bottom type ('cta') to be present and last.
  const bottomType = defaultIds.find(t => getCatalogEntry(t)?.locked === 'bottom') || 'cta';
  types = [...types.filter(t => t !== bottomType), bottomType];

  const sections = types.map(type => {
    const entry = getCatalogEntry(type);
    const locked = entry?.locked;
    return {
      id: makeInstanceId(),
      type,
      ...(locked ? { locked } : {}),
    };
  });

  return {
    ...copy,
    sections,
    sectionContent: copy?.sectionContent || {},
  };
}

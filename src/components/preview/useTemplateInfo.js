import { useEffect, useState } from 'react';
import { TEMPLATE_COMPONENT_MAP } from '../../data/templates.js';
import { manifestFromModule } from '../../lib/sectionManifest.js';

// What the editor needs from a template's module: its section manifest and,
// when the module exports them, its own How It Works / Why Us defaults
// (defaultHowSteps / defaultWhyCards(businessType)), so a panel can seed
// exactly what the preview shows. The preview has already imported the
// module (React.lazy on the same loader), so this resolves at once; results
// are cached per template for the session.
const cache = new Map();
const pending = new Map();

function infoFrom(templateId, mod) {
  const { themeReady, sections } = manifestFromModule(templateId, mod);
  return {
    templateId,
    themeReady,
    sections,
    defaultHowSteps: typeof mod?.defaultHowSteps === 'function' ? mod.defaultHowSteps : null,
    defaultWhyCards: typeof mod?.defaultWhyCards === 'function' ? mod.defaultWhyCards : null,
    // Edit > Headings: which copy.sectionTitles fields each section uses.
    headingFields: mod?.headingFields && typeof mod.headingFields === 'object' ? mod.headingFields : null,
    // ... and the design's own heading text, headingDefaults(businessInfo, copy).
    headingDefaults: typeof mod?.headingDefaults === 'function' ? mod.headingDefaults : null,
  };
}

export function loadTemplateInfo(templateId, loaders = TEMPLATE_COMPONENT_MAP) {
  if (cache.has(templateId)) return Promise.resolve(cache.get(templateId));
  if (pending.has(templateId)) return pending.get(templateId);
  const load = loaders[templateId];
  const promise = (load ? Promise.resolve().then(load) : Promise.resolve(null))
    .catch(() => null)
    .then((mod) => {
      const info = infoFrom(templateId, mod);
      cache.set(templateId, info);
      pending.delete(templateId);
      return info;
    });
  pending.set(templateId, promise);
  return promise;
}

// The info for templateId, or null while it loads (never a previous
// template's info).
export function useTemplateInfo(templateId) {
  const [state, setState] = useState(() => ({ templateId, info: cache.get(templateId) || null }));
  useEffect(() => {
    if (!templateId) return undefined;
    let cancelled = false;
    loadTemplateInfo(templateId).then((info) => {
      if (!cancelled) setState((prev) => (prev.templateId === templateId && prev.info === info ? prev : { templateId, info }));
    });
    return () => { cancelled = true; };
  }, [templateId]);
  if (state.templateId === templateId && state.info) return state.info;
  return cache.get(templateId) || null;
}

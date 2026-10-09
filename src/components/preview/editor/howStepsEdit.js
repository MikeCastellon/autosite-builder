// Pure helpers behind the How It Works tab (ContentEditor.jsx) for a design
// without starter steps (editorCapabilities howStepsStarters: false, the kit
// band kit/HowItWorks.jsx). There the section is on only while
// copy.howSteps holds at least one step (kit howItWorksSteps), so the tab
// adds and removes the section instead of offering the starter steps the
// other designs show until the owner edits them.
import { defaultHowSteps } from '../../../lib/templateFallbacks.js';
import { HOW_STEP_IMAGE_KEY, howStepKey } from '../templates/kit/howItWorks.js';

export { howStepKey };

// Whether the section is on (copy.howSteps is a non-empty list).
export function howStepsOn(copy) {
  return Array.isArray(copy?.howSteps) && copy.howSteps.length > 0;
}

// What "Add a How It Works section" saves: the suggested steps for the
// business type (templateFallbacks.js: plain descriptions of how working
// with the business goes, no claims), as the owner's own to edit. Fresh
// copies, safe to edit and save.
export function howStepsStart(businessType) {
  return defaultHowSteps(businessType);
}

// The tab's help text, by design: starter steps (the other designs) or an
// opt-in section (no starters).
export const HOW_STEPS_HELP = Object.freeze({
  // Opt-in design, section off.
  off: 'Walk visitors through how working with you goes, in a few numbered steps. It starts with suggested steps for your type of business: edit them to match how you work.',
  // Opt-in design, section on.
  on: 'Your steps, numbered in this order. A step shows on your site once it has a title or a description.',
  // Designs with a photo per step.
  photos: 'Step photos show on your site once every step has one.',
});

const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const hasPhoto = (v) => typeof v === 'string' && v.trim() !== '';

// The images map once step `index` is removed: that step's photo goes and
// the later steps' photos move up one place, the way the steps do. Every
// other key stays; an empty slot has no key.
export function howStepRemoveImages(images, index) {
  const imgs = isObj(images) ? images : {};
  const out = {};
  for (const [k, v] of Object.entries(imgs)) if (!HOW_STEP_IMAGE_KEY.test(k)) out[k] = v;
  for (const [k, v] of Object.entries(imgs)) {
    if (!HOW_STEP_IMAGE_KEY.test(k) || !hasPhoto(v)) continue;
    const i = Number(k.slice(7));
    if (i < index) out[howStepKey(i)] = v;
    else if (i > index) out[howStepKey(i - 1)] = v;
  }
  return out;
}

// The images map without any step photo (the section removed).
export function howStepWithoutImages(images) {
  const imgs = isObj(images) ? images : {};
  const out = {};
  for (const [k, v] of Object.entries(imgs)) if (!HOW_STEP_IMAGE_KEY.test(k)) out[k] = v;
  return out;
}

// Pure helpers behind the How It Works tab (ContentEditor.jsx) for a design
// without starter steps (editorCapabilities howStepsStarters: false, the kit
// band kit/HowItWorks.jsx). There the section is on only while
// copy.howSteps holds at least one step (kit howItWorksSteps), so the tab
// adds and removes the section instead of offering the starter steps the
// other designs show until the owner edits them.
import { defaultHowSteps } from '../../../lib/templateFallbacks.js';

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
});

// "Preview Demo" opens a template in the editor with placeholder content. It
// borrows App's editor state slots, so the real editor state is parked while
// the demo is open and put back when it closes. The demo never has a siteId:
// with the real one kept, every demo edit autosaved the demo copy and
// template over the owner's real site and dropped its images.

// The editor state slots the demo replaces (and so must park).
export const PARKED_EDITOR_KEYS = [
  'siteId',
  'selectedTemplate',
  'generatedCopy',
  'editedCopy',
  'images',
  'customColors',
  'customFonts',
  'editingExistingSite',
  'step',
];

// Snapshot of the real editor state. returnTo is where the demo's Back leads:
// 'admin' (the Admin dashboard's "Open editor demo"), 'editor' (editor
// toolbar) or 'templates' (wizard template picker).
export function parkEditorState(current, returnTo) {
  const parked = { returnTo };
  for (const key of PARKED_EDITOR_KEYS) parked[key] = current[key];
  return parked;
}

// Editor state while the demo is open.
export function demoEditorState(templateId, demoCopy) {
  return {
    siteId: null,
    selectedTemplate: templateId,
    generatedCopy: demoCopy,
    editedCopy: structuredClone(demoCopy),
    images: {},
    customColors: {},
    customFonts: {},
    editingExistingSite: false,
    step: 5,
  };
}

// State to restore when the demo closes, and the view to switch to (null =
// stay in the wizard; 'admin' leaves the editor for the Admin workspace).
// Back on the template picker with nothing chosen yet, the previewed template
// becomes the selection, as it did before parking.
export function stateAfterDemo(parked, previewedTemplate) {
  if (!parked) {
    // Nothing parked (shouldn't happen): leave the demo for the template
    // picker without any demo content or a site to save to.
    return {
      state: { siteId: null, generatedCopy: null, editedCopy: null, images: {}, step: 3 },
      view: null,
    };
  }
  const { returnTo, ...state } = parked;
  if (returnTo === 'templates' && !state.selectedTemplate) state.selectedTemplate = previewedTemplate;
  const view = returnTo === 'admin' ? 'admin' : null;
  return { state, view };
}

export const DEMO_BACK_LABELS = {
  admin: 'Back to Admin',
  editor: 'Back to Editor',
  templates: 'Back to Templates',
};

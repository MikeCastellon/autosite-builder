import { createContext, useContext } from 'react';

// true inside the in-app editor preview (WebsitePreview wraps templates in
// <EditorModeProvider>); false on the published page, which exportHtml.js
// renders without a provider. Anything that only helps the owner edit
// (empty-photo placeholders, "add your ..." hints) must be gated on this so
// it can never leak onto a customer's live site.
const EditorModeContext = createContext(false);

export function EditorModeProvider({ value = true, children }) {
  return <EditorModeContext.Provider value={!!value}>{children}</EditorModeContext.Provider>;
}

export function useEditorMode() {
  return useContext(EditorModeContext);
}

export function EditorOnly({ children }) {
  return useEditorMode() ? children : null;
}

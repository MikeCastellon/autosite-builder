import { createContext, useContext } from 'react';

/**
 * Provides inline image editing capability to template components.
 * When this context is present (inside WebsitePreview), image slots show
 * click-to-change overlays and placeholders.
 * When null (e.g., during HTML export), image components render normally.
 */
export const ImageEditContext = createContext(null);

export function useImageEdit() {
  return useContext(ImageEditContext);
}

import { useEditorMode } from './EditorMode.jsx';

// Where owners actually add each image (ContentEditor.jsx: the "Edit"
// button opens the side panel; images live on these tabs).
export const PHOTO_HINTS = {
  hero: 'Add a hero photo: Edit > Hero > Hero Background',
  logo: 'Add your logo: Edit > Hero > Business Logo',
  about: 'Add a photo: Edit > About > About Photo',
  gallery: 'Add photos: Edit > Gallery',
  shade: 'Add a shade photo: Edit > Shades',
  product: 'Add a product photo: Edit > Products > Product Image',
  service: 'Add a package photo: Edit > Services > Package details > Package Photo',
  featured: 'Add a photo: Edit > Featured Service > Featured Photo',
  cta: 'Add a background photo: Edit > Contact > CTA Background',
};

const DEFAULT_HINT = 'Add a photo from the Edit panel (Hero, About or Gallery tab)';

const placeholderStyle = {
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  width: '100%',
  minHeight: 160,
  padding: 20,
  textAlign: 'center',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.45,
  // Text inherits the section's (already readable) color; the frame is a
  // neutral mid-gray at low alpha so it sits on dark and light themes alike.
  color: 'inherit',
  border: '1.5px dashed rgba(128, 128, 128, 0.55)',
  background: 'repeating-linear-gradient(135deg, rgba(128,128,128,0.08) 0 12px, rgba(128,128,128,0.03) 12px 24px)',
};

// An image slot. With `src`: a cover-fit <img>. Without: an editor-only
// dashed placeholder naming where to upload, and `fallback` (default
// nothing) on the published site.
// `style` sizes the slot in both states (width/height/aspectRatio/radius);
// `imgStyle` adds img-only styles (objectPosition, filter, ...).
// `slot` ('hero' | 'about' | 'logo' | 'gallery' | 'shade' | 'product' |
// 'service' | 'featured' | 'cta') picks a PHOTO_HINTS entry when no `hint`
// is given.
export function PhotoSlot({
  src,
  alt = '',
  hint,
  slot,
  style,
  imgStyle,
  loading = 'lazy',
  fetchPriority,
  fallback = null,
}) {
  const editor = useEditorMode();

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        {...(fetchPriority ? { fetchPriority } : {})}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', ...style, ...imgStyle }}
      />
    );
  }

  if (!editor) return fallback;

  return (
    <div data-acg-editor-only="" style={{ ...placeholderStyle, ...style }}>
      <svg width="28" height="28" style={{ opacity: 0.6 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
      <span style={{ maxWidth: 260, opacity: 0.78 }}>{hint || PHOTO_HINTS[slot] || DEFAULT_HINT}</span>
    </div>
  );
}

export default PhotoSlot;

// Shared inline SVG social-media icons used across all templates.
// Each icon is an <a> wrapping an <svg> — rendered at the given `size` (default 22px).
// `color` sets the fill colour; defaults to currentColor.

export function InstagramIcon({ href, size = 22, color = 'currentColor', style = {} }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Instagram" style={{ display: 'inline-flex', ...style }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="20" height="20" rx="5" stroke={color} strokeWidth="2" />
        <circle cx="12" cy="12" r="5" stroke={color} strokeWidth="2" />
        <circle cx="17.5" cy="6.5" r="1.5" fill={color} />
      </svg>
    </a>
  );
}

export function FacebookIcon({ href, size = 22, color = 'currentColor', style = {} }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Facebook" style={{ display: 'inline-flex', ...style }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3V2Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

export function TikTokIcon({ href, size = 22, color = 'currentColor', style = {} }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label="TikTok" style={{ display: 'inline-flex', ...style }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

// Helper to build proper URLs from user input
export function socialUrl(platform, handle) {
  if (!handle) return null;
  const clean = handle.trim();
  if (!clean) return null;

  if (platform === 'instagram') {
    if (clean.startsWith('http')) return clean;
    return `https://instagram.com/${clean.replace(/^@/, '')}`;
  }
  if (platform === 'facebook') {
    if (clean.startsWith('http')) return clean;
    // strip leading "facebook.com/" if provided
    const slug = clean.replace(/^(https?:\/\/)?(www\.)?facebook\.com\/?/, '');
    return `https://facebook.com/${slug}`;
  }
  if (platform === 'tiktok') {
    if (clean.startsWith('http')) return clean;
    return `https://tiktok.com/${clean.replace(/^@/, '').replace(/^/, '@')}`;
  }
  return null;
}

// Convenience: renders a row of social icons from a biz object.
// Pass `images` to respect hide flags (images.hideInstagram, images.hideFacebook, images.hideTiktok).
export function SocialRow({ biz, color = 'currentColor', size = 22, gap = 14, style = {}, images = {} }) {
  const igUrl = !images.hideInstagram && socialUrl('instagram', biz.instagram);
  const fbUrl = !images.hideFacebook && socialUrl('facebook', biz.facebook);
  const ttUrl = !images.hideTiktok && socialUrl('tiktok', biz.tiktok);
  if (!igUrl && !fbUrl && !ttUrl) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap, ...style }}>
      <InstagramIcon href={igUrl} size={size} color={color} />
      <FacebookIcon href={fbUrl} size={size} color={color} />
      <TikTokIcon href={ttUrl} size={size} color={color} />
    </div>
  );
}

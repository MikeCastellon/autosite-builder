const APPEARANCE_ENUMS = {
  page_style: ['branded', 'minimal'],
  background: ['light', 'dark', 'image'],
  corner_style: ['rounded', 'sharp'],
};

export function defaultAppearance() {
  return {
    page_style: 'branded',
    accent_color: '#1a1a1a',
    background: 'light',
    background_image_url: '',
    corner_style: 'rounded',
    font: 'Inter',
    logo_url: '',
    tagline: '',
  };
}

export function normalizeAppearance(input) {
  const base = defaultAppearance();
  if (!input || typeof input !== 'object') return base;
  const out = { ...base };
  for (const key of Object.keys(base)) {
    const val = input[key];
    if (val == null) continue;
    if (APPEARANCE_ENUMS[key]) {
      if (APPEARANCE_ENUMS[key].includes(val)) out[key] = val;
    } else if (typeof val === 'string') {
      out[key] = val;
    }
  }
  return out;
}

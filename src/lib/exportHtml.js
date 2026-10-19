import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { normalizeBusinessInfo } from './normalizeBusinessInfo.js';
import { TEMPLATE_COMPONENT_MAP } from '../data/templates.js';
import { supabase } from './supabase.js';
import { buildFontHref, LEGACY_EXPORT_FAMILIES } from './fontCatalog.js';
import { SITE_BA_JS, SITE_BASE_CSS, SITE_CQ_FALLBACK_JS, SITE_RUNTIME_JS, SITE_SCROLL_JS } from './siteRuntime.js';

const SCHEDULER_WIDGET_URL =
  (typeof window !== 'undefined' && window.location && window.location.origin
    ? window.location.origin
    : 'https://app.autocaregenius.com') + '/scheduler.js';

const CONTACT_WIDGET_URL =
  (typeof window !== 'undefined' && window.location && window.location.origin
    ? window.location.origin
    : 'https://app.autocaregenius.com') + '/contact-form.js';

const MAIN_APP_URL =
  (typeof window !== 'undefined' && window.location && window.location.origin)
    ? window.location.origin
    : 'https://sitebuilder.autocaregenius.com';

// Generate a square SVG data-URL favicon.
// Uses the uploaded logo if one exists and appears square-ish; otherwise
// draws a colored circle with the business's first initial. Always 32x32
// so it renders cleanly in browser tabs.
function buildFaviconDataUrl(businessInfo, images, templateMeta) {
  const accent =
    templateMeta?.colors?.primary ||
    templateMeta?.colors?.accent ||
    '#cc0000';
  const letter = (businessInfo?.businessName || '?')
    .trim()
    .charAt(0)
    .toUpperCase();

  const logoUrl = images?.logo;
  // If a logo exists, wrap it in a square SVG with object-fit:contain semantics.
  // xMidYMid meet centers and scales the image to fit without distortion.
  // Browsers that fetch external images from data-URL SVGs are rare in favicons,
  // so we fall back to the initial if anything about the logo is unclear.
  const hasLogo = typeof logoUrl === 'string' && logoUrl.length > 0;

  const svg = hasLogo
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#ffffff"/><image href="${escapeAttr(logoUrl)}" x="2" y="2" width="28" height="28" preserveAspectRatio="xMidYMid meet"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${escapeAttr(accent)}"/><text x="16" y="22" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="18" fill="#ffffff">${escapeText(letter)}</text></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Ampersands first, or the entities produced for the other characters
// would be double-escaped.
function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Legacy templates only: forces inline grids to one column on phones. Theme-
// ready templates own their layout with @container rules (this hack also
// collapses the booking widget's 7-column calendar).
const LEGACY_MOBILE_CSS = `
    @media (max-width: 768px) {
      div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
      div[style*="1fr 1fr"] { grid-template-columns: 1fr !important; }
      div[style*="2fr 1fr"] { grid-template-columns: 1fr !important; }
      .tp-nav-links a[href^="#"] { display: none !important; }
      .tp-nav-links { gap: 12px !important; }
      .tp-2col { grid-template-columns: 1fr !important; }
      .tp-4col { grid-template-columns: 1fr 1fr !important; }
    }`;

function buildSeoHead(businessInfo, generatedCopy, siteId, images, templateMeta, { fontHref = null, legacyLayout = true, beforeAfter = false, scroller = false } = {}) {
  const biz = businessInfo;
  const copy = generatedCopy;
  const keywords = [
    ...(copy.keywords || []),
    `${biz.city} auto service`,
    `${biz.businessName}`,
    biz.state,
  ].join(', ');

  // Build Local Business JSON-LD
  const schemaOrg = {
    '@context': 'https://schema.org',
    '@type': copy.schemaType || 'AutoRepair',
    name: biz.businessName,
    telephone: biz.phone,
    description: copy.metaDescription,
    areaServed: `${biz.city}, ${biz.state}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: biz.address || '',
      addressLocality: biz.city,
      addressRegion: biz.state,
      addressCountry: 'US',
    },
    priceRange: biz.priceRange || '$$',
  };

  const faviconUrl = buildFaviconDataUrl(biz, images, templateMeta);

  return `
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeText(copy.metaTitle || `${biz.businessName} | Auto Service in ${biz.city}, ${biz.state}`)}</title>
  <meta name="description" content="${escapeAttr(copy.metaDescription || '')}" />
  <meta name="keywords" content="${escapeAttr(keywords)}" />
  <meta name="robots" content="index, follow" />

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="${escapeAttr(faviconUrl)}" />

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeAttr(biz.businessName || '')}" />
  <meta property="og:description" content="${escapeAttr(copy.metaDescription || '')}" />
  <meta property="og:type" content="local.business" />
  <meta property="og:locale" content="en_US" />

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  ${fontHref ? `<link href="${escapeAttr(fontHref)}" rel="stylesheet" />` : ''}

  <!-- Tailwind CSS CDN (for utility classes in templates) -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- Scheduler widget (visible only if owner has scheduler enabled) -->
  ${siteId ? `<script src="${SCHEDULER_WIDGET_URL}" data-site-id="${escapeAttr(siteId)}" defer></script>` : ''}

  <!-- Contact / inquiry form widget (free for all published sites) -->
  ${siteId ? `<script src="${CONTACT_WIDGET_URL}" data-site-id="${escapeAttr(siteId)}" data-accent="${escapeAttr(templateMeta?.colors?.primary || templateMeta?.colors?.accent || '#cc0000')}" defer></script>` : ''}

  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    body.acg-has-bar { padding-bottom: 48px; }
    img { max-width: 100%; height: auto; }
    .acg-owner-link {
      color: inherit;
      opacity: 0.6;
      text-decoration: underline;
      text-underline-offset: 2px;
      transition: opacity 0.15s ease;
    }
    .acg-owner-link:hover { opacity: 1; }
    #acg-powered-by {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      background: rgba(250, 249, 247, 0.96);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.04);
    }
    #acg-powered-by .acg-label {
      font-family: 'Outfit', system-ui, sans-serif;
      font-size: 12px;
      color: #999;
      letter-spacing: 0.02em;
    }
    #acg-powered-by img { height: 18px; }
    #acg-powered-by .acg-divider {
      width: 1px;
      height: 16px;
      background: rgba(0, 0, 0, 0.1);
      margin: 0 2px;
    }
    #acg-powered-by .acg-wordmark {
      font-family: 'Inter', system-ui, sans-serif;
      font-weight: 700;
      font-size: 14px;
      color: #1a1a1a;
      letter-spacing: -0.3px;
      text-decoration: none;
    }
    #acg-powered-by .acg-wordmark .acg-accent { color: #cc0000; }
${legacyLayout ? LEGACY_MOBILE_CSS : ''}
    @media (max-width: 600px) {
      [data-widget="google-reviews"] .sf-gr-carousel { overflow: visible !important; padding: 0 !important; }
      [data-widget="google-reviews"] .sf-gr-carousel > * {
        transform: none !important;
        flex-direction: column !important;
        width: 100% !important;
        gap: 12px !important;
        align-items: center !important;
        justify-content: center !important;
      }
      [data-widget="google-reviews"] .sf-gr-card {
        flex: none !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 440px !important;
        margin: 0 auto !important;
        box-sizing: border-box !important;
        display: block !important;
      }
      [data-widget="google-reviews"] .sf-gr-card:nth-child(n+4) { display: none !important; }
      [data-widget="google-reviews"] .sf-gr-arrow,
      [data-widget="google-reviews"] .sf-gr-prev,
      [data-widget="google-reviews"] .sf-gr-next,
      [data-widget="google-reviews"] .sf-gr-dot,
      [data-widget="google-reviews"] [class*="dots"] { display: none !important; }
    }
  </style>
  <style>
${SITE_BASE_CSS}
  </style>
  <!-- Container-query fallback for older browsers (no-op on current ones) -->
  <script>${SITE_CQ_FALLBACK_JS}</script>
  <script>${SITE_RUNTIME_JS}</script>${beforeAfter ? `
  <script>${SITE_BA_JS}</script>` : ''}${scroller ? `
  <script>${SITE_SCROLL_JS}</script>` : ''}

  <!-- Local Business Schema -->
  <script type="application/ld+json">
  ${JSON.stringify(schemaOrg, null, 2).replace(/</g, '\\u003c')}
  </script>`;
}

async function buildHtmlString(templateId, businessInfo, generatedCopy, templateMeta, images, widgetConfigIds = [], siteId = null, isPro = false) {
  const mod = await TEMPLATE_COMPONENT_MAP[templateId]();
  const TemplateComponent = mod.default;
  // Theme-ready modules (see CLAUDE.md) declare the fonts they use and own
  // their phone layout; legacy ones keep the old font list and grid hack.
  const themeReady = mod.themeReady === true;
  const fontHref = buildFontHref([
    templateMeta?.font,
    templateMeta?.bodyFont,
    Array.isArray(mod.extraFonts) ? mod.extraFonts : [],
    themeReady ? [] : LEGACY_EXPORT_FAMILIES,
    // Page chrome outside the template: the body default (widgets section)
    // is Inter and the free-tier "Powered by" bar uses Outfit + Inter.
    'Inter',
    isPro ? [] : ['Outfit'],
  ]);

  const normalizedInfo = normalizeBusinessInfo(businessInfo);
  const bodyHtml = renderToStaticMarkup(
    createElement(TemplateComponent, { businessInfo: normalizedInfo, generatedCopy, templateMeta, images: images || {} })
  );

  // The Before & After slider script (siteRuntime.js SITE_BA_JS) only goes
  // on a page that shows the band's range input; other pages stay as they
  // were. Text can't fake the tag: React escapes "<" in owner words.
  const beforeAfter = /<input\b[^>]*\sdata-acg-ba-range=/.test(bodyHtml);
  // Same for the scroller buttons' script (SITE_SCROLL_JS): only a page with
  // a <button data-acg-scroll="prev|next"> gets it.
  const scroller = /<button\b[^>]*\sdata-acg-scroll=/.test(bodyHtml);
  const seoHead = buildSeoHead(businessInfo, generatedCopy, siteId, images, templateMeta, { fontHref, legacyLayout: !themeReady, beforeAfter, scroller });

  // Inject widget script (template already renders the widget divs, just need the JS)
  let widgetsHtml = '';
  const hasGoogleWidget = !!generatedCopy?.googleWidgetKey;
  const hasInstagramWidget = !!generatedCopy?.instagramWidgetKey;
  if (hasGoogleWidget || hasInstagramWidget) {
    widgetsHtml = `
<script src="https://social-feeds-app.netlify.app/widgets.js" defer></script>`;
  } else if (widgetConfigIds.length > 0) {
    const { data: widgetConfigs, error: widgetError } = await supabase
      .from('widget_configs')
      .select('id, type, widget_key')
      .in('id', widgetConfigIds);
    if (widgetError) console.error('Widget fetch failed:', widgetError.message);

    if (widgetConfigs?.length > 0) {
      const divs = widgetConfigs.map((w) =>
        `<div data-widget="${w.type}" data-widget-key="${w.widget_key}"></div>`
      ).join('\n  ');
      widgetsHtml = `
<section style="padding:60px 24px;max-width:1200px;margin:0 auto;">
  ${divs}
</section>
<script src="https://social-feeds-app.netlify.app/widgets.js" defer></script>`;
    }
  }

  // Sticky "Powered by" bar — only shown on free-tier sites. Pro removes it.
  const poweredByBar = isPro ? '' : `
<div id="acg-powered-by">
  <span class="acg-label">Powered by</span>
  <a href="https://www.autocaregenius.com/" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:8px;">
    <img src="https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=160" alt="Auto Care Genius" />
    <span class="acg-divider"></span>
    <span class="acg-wordmark">Genius <span class="acg-accent">Websites</span></span>
  </a>
</div>`;

  // Inject a tiny "Site owner" link into the template's own footer once the
  // page mounts. Inherits surrounding font color/size so it blends in with
  // whatever the template renders next to copyright. Uses .acg-owner-link
  // styling above for hover behaviour.
  const ownerLinkScript = `
<script>
(function(){
  function inject(){
    var footers = document.querySelectorAll('footer');
    if (!footers.length) return;
    var f = footers[footers.length - 1];
    if (f.querySelector('.acg-owner-link')) return;
    var paras = f.querySelectorAll('p');
    var target = paras.length ? paras[paras.length - 1] : f;
    var sep = document.createTextNode(' · ');
    var a = document.createElement('a');
    a.className = 'acg-owner-link';
    a.href = '${MAIN_APP_URL}';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'Site owner';
    target.appendChild(sep);
    target.appendChild(a);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
</script>`;

  const bodyClass = isPro ? '' : ' class="acg-has-bar"';

  return `<!DOCTYPE html>
<html lang="en">
<head>
${seoHead}
</head>
<body${bodyClass}>
${bodyHtml}
${widgetsHtml}
${poweredByBar}
${ownerLinkScript}
</body>
</html>`;
}

export async function exportHtmlString(templateId, businessInfo, generatedCopy, templateMeta, images, widgetConfigIds = [], siteId = null, isPro = false) {
  return buildHtmlString(templateId, businessInfo, generatedCopy, templateMeta, images, widgetConfigIds, siteId, isPro);
}

export async function exportHtml(templateId, businessInfo, generatedCopy, templateMeta, images, widgetConfigIds = [], siteId = null, isPro = false) {
  const fullHtml = await buildHtmlString(templateId, businessInfo, generatedCopy, templateMeta, images, widgetConfigIds, siteId, isPro);

  // Trigger download
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${businessInfo.businessName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()}-website.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

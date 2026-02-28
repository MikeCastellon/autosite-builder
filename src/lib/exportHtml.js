import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { normalizeBusinessInfo } from './normalizeBusinessInfo.js';

// Map templateId -> static import path for SSR rendering
const TEMPLATE_MODULES = {
  detailing_premium:    () => import('../components/preview/templates/detailing/DetailingPremium.jsx'),
  detailing_sporty:     () => import('../components/preview/templates/detailing/DetailingSporty.jsx'),
  detailing_minimal:    () => import('../components/preview/templates/detailing/DetailingMinimal.jsx'),
  mobile_bold:          () => import('../components/preview/templates/mobile/MobileBold.jsx'),
  mobile_modern:        () => import('../components/preview/templates/mobile/MobileModern.jsx'),
  mobile_rugged:        () => import('../components/preview/templates/mobile/MobileRugged.jsx'),
  wheel_edge:           () => import('../components/preview/templates/wheel/WheelEdge.jsx'),
  wheel_clean:          () => import('../components/preview/templates/wheel/WheelClean.jsx'),
  tint_dark:            () => import('../components/preview/templates/tint/TintDark.jsx'),
  tint_sleek:           () => import('../components/preview/templates/tint/TintSleek.jsx'),
  mechanic_industrial:  () => import('../components/preview/templates/mechanic/MechanicIndustrial.jsx'),
  mechanic_friendly:    () => import('../components/preview/templates/mechanic/MechanicFriendly.jsx'),
  detailing_coastal:    () => import('../components/preview/templates/detailing/DetailingCoastal.jsx'),
  mechanic_garage:      () => import('../components/preview/templates/mechanic/MechanicGarage.jsx'),
  mobile_chrome:        () => import('../components/preview/templates/mobile/MobileChrome.jsx'),
  tint_elite:           () => import('../components/preview/templates/tint/TintElite.jsx'),
};

function buildSeoHead(businessInfo, generatedCopy) {
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

  return `
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${copy.metaTitle || `${biz.businessName} | Auto Service in ${biz.city}, ${biz.state}`}</title>
  <meta name="description" content="${copy.metaDescription || ''}" />
  <meta name="keywords" content="${keywords}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://yourdomain.com" />

  <!-- Open Graph -->
  <meta property="og:title" content="${biz.businessName}" />
  <meta property="og:description" content="${copy.metaDescription || ''}" />
  <meta property="og:type" content="local.business" />
  <meta property="og:locale" content="en_US" />

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />

  <!-- Tailwind CSS CDN (for utility classes in templates) -->
  <script src="https://cdn.tailwindcss.com"></script>

  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    img { max-width: 100%; height: auto; }
    @media (max-width: 768px) {
      div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
      div[style*="1fr 1fr"] { grid-template-columns: 1fr !important; }
      div[style*="2fr 1fr"] { grid-template-columns: 1fr !important; }
    }
  </style>

  <!-- Local Business Schema -->
  <script type="application/ld+json">
  ${JSON.stringify(schemaOrg, null, 2)}
  </script>`;
}

export async function exportHtml(templateId, businessInfo, generatedCopy, templateMeta) {
  const mod = await TEMPLATE_MODULES[templateId]();
  const TemplateComponent = mod.default;

  const normalizedInfo = normalizeBusinessInfo(businessInfo);
  const bodyHtml = renderToStaticMarkup(
    createElement(TemplateComponent, { businessInfo: normalizedInfo, generatedCopy, templateMeta })
  );

  const seoHead = buildSeoHead(businessInfo, generatedCopy);

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${seoHead}
</head>
<body>
${bodyHtml}
</body>
</html>`;

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

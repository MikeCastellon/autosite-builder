import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { normalizeBusinessInfo } from './normalizeBusinessInfo.js';
import { TEMPLATE_COMPONENT_MAP } from '../data/templates.js';
import { supabase } from './supabase.js';

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

  <!-- Open Graph -->
  <meta property="og:title" content="${biz.businessName}" />
  <meta property="og:description" content="${copy.metaDescription || ''}" />
  <meta property="og:type" content="local.business" />
  <meta property="og:locale" content="en_US" />

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:wght@700;800&family=Outfit:wght@400;500;600;700;800;900&family=Syne:wght@400;500;600;700;800&family=Barlow+Condensed:wght@400;500;600;700&family=Barlow:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&family=Bebas+Neue&family=Righteous&family=Boogaloo&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />

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
      .tp-nav-links a[href^="#"] { display: none !important; }
      .tp-nav-links { gap: 12px !important; }
      .tp-2col { grid-template-columns: 1fr !important; }
      .tp-4col { grid-template-columns: 1fr 1fr !important; }
    }
  </style>

  <!-- Local Business Schema -->
  <script type="application/ld+json">
  ${JSON.stringify(schemaOrg, null, 2)}
  </script>`;
}

async function buildHtmlString(templateId, businessInfo, generatedCopy, templateMeta, images, widgetConfigIds = []) {
  const mod = await TEMPLATE_COMPONENT_MAP[templateId]();
  const TemplateComponent = mod.default;

  const normalizedInfo = normalizeBusinessInfo(businessInfo);
  const bodyHtml = renderToStaticMarkup(
    createElement(TemplateComponent, { businessInfo: normalizedInfo, generatedCopy, templateMeta, images: images || {} })
  );

  const seoHead = buildSeoHead(businessInfo, generatedCopy);

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

  const poweredByBar = `
<div style="background:#faf9f7;padding:14px 24px;display:flex;align-items:center;justify-content:center;gap:8px;border-top:1px solid #e5e5e5;">
  <span style="font-family:'Outfit',system-ui,sans-serif;font-size:12px;color:#999;letter-spacing:0.02em;">Powered by</span>
  <a href="https://prohub.autocaregenius.com/" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;">
    <img src="https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=160" alt="Auto Care Genius" style="height:18px;" />
  </a>
</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
${seoHead}
</head>
<body>
${bodyHtml}
${widgetsHtml}
${poweredByBar}
</body>
</html>`;
}

export async function exportHtmlString(templateId, businessInfo, generatedCopy, templateMeta, images, widgetConfigIds = []) {
  return buildHtmlString(templateId, businessInfo, generatedCopy, templateMeta, images, widgetConfigIds);
}

export async function exportHtml(templateId, businessInfo, generatedCopy, templateMeta, images, widgetConfigIds = []) {
  const fullHtml = await buildHtmlString(templateId, businessInfo, generatedCopy, templateMeta, images, widgetConfigIds);

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

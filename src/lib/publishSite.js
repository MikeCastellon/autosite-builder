import { generateSlug } from './publishUtils.js';
import { exportHtmlString } from './exportHtml.js';

/**
 * Publish a site by uploading HTML to Cloudflare R2.
 * The Worker at *.autocaregeniushub.com serves it automatically.
 */
export async function publishSite({ siteId, businessInfo, generatedCopy, templateId, templateMeta, images, selectedWidgetIds }) {
  const slug = generateSlug(businessInfo.businessName);
  const htmlContent = await exportHtmlString(templateId, businessInfo, generatedCopy, templateMeta, images, selectedWidgetIds || []);

  const res = await fetch('/.netlify/functions/publish-site', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteId, htmlContent, slug }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Publish failed');
  }

  return res.json();
}

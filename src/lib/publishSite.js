import { generateSlug, netlifyName } from './publishUtils.js';
import { exportHtmlString } from './exportHtml.js';

/**
 * Publish a site to the web via the publish-site Netlify function.
 * Returns { publishedUrl, netlifyUrl, cnameInstructions }
 */
export async function publishSite({ siteId, businessInfo, generatedCopy, templateId, templateMeta, images, selectedWidgetIds, customDomain, session }) {
  const slug = generateSlug(businessInfo.businessName);
  const siteName = netlifyName(slug, siteId);

  const htmlContent = await exportHtmlString(templateId, businessInfo, generatedCopy, templateMeta, images, selectedWidgetIds || []);

  const res = await fetch('/.netlify/functions/publish-site', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ siteId, htmlContent, slug, netlifyName: siteName, customDomain: customDomain || null }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Publish failed');
  }

  return res.json();
}

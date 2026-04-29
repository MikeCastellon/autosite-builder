import { generateSlug } from './publishUtils.js';
import { exportHtmlString } from './exportHtml.js';
import { supabase } from './supabase.js';

/**
 * Publish a site by uploading HTML to Cloudflare R2.
 * The Worker at *.autocaregeniushub.com serves it automatically.
 */
export async function publishSite({ siteId, businessInfo, generatedCopy, templateId, templateMeta, images, selectedWidgetIds, isPro = false }) {
  const slug = generateSlug(businessInfo.businessName);
  const htmlContent = await exportHtmlString(templateId, businessInfo, generatedCopy, templateMeta, images, selectedWidgetIds || [], siteId, isPro);

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sign in required to publish.');

  const res = await fetch('/.netlify/functions/publish-site', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ siteId, htmlContent, slug }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Publish failed');
  }

  return res.json();
}

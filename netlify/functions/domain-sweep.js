import { supabaseAdmin } from './_shared/auth.js';
import { sendPostmarkEmail } from './_shared/postmark.js';

// Probes pending custom domains every few minutes, flips them to active_ssl
// once they respond over HTTPS from Netlify, and emails the owner on the
// pending_dns/active_dns → active_ssl transition.
export const handler = async () => {
  const admin = supabaseAdmin();

  const { data: sites } = await admin
    .from('sites')
    .select('id, custom_domain, custom_domain_status, user_id')
    .not('custom_domain', 'is', null)
    .in('custom_domain_status', ['pending_dns', 'active_dns']);

  if (!sites?.length) return { statusCode: 200, body: 'no sites to sweep' };

  const isNetlifyResponse = (res) => {
    const nfReqId = res.headers.get('x-nf-request-id');
    const serverHdr = res.headers.get('server') || '';
    return !!nfReqId || /netlify/i.test(serverHdr);
  };

  for (const site of sites) {
    try {
      // Two-stage probe: HTTPS first (real active_ssl), then HTTP fallback
      // to distinguish "DNS done, SSL still provisioning" from "DNS not set."
      // Requires a Netlify response marker — prevents parking pages from
      // being marked live.
      let status = 'pending_dns';
      let httpsFromNetlify = false;
      try {
        const httpsRes = await fetch(`https://www.${site.custom_domain}`, {
          method: 'HEAD',
          redirect: 'manual',
          signal: AbortSignal.timeout(8000),
        });
        httpsFromNetlify = isNetlifyResponse(httpsRes);
        if (httpsFromNetlify && httpsRes.status < 400) {
          status = 'active_ssl';
        }
      } catch { /* SSL handshake failed or connection refused */ }

      if (status !== 'active_ssl') {
        try {
          const httpRes = await fetch(`http://www.${site.custom_domain}`, {
            method: 'HEAD',
            redirect: 'manual',
            signal: AbortSignal.timeout(8000),
          });
          if (isNetlifyResponse(httpRes)) {
            status = 'active_dns';
          }
        } catch { /* unreachable — leave as pending_dns */ }
      }

      const prev = site.custom_domain_status;
      await admin.from('sites').update({
        custom_domain_status: status,
        custom_domain_last_checked_at: new Date().toISOString(),
      }).eq('id', site.id);

      if (status === 'active_ssl' && prev !== 'active_ssl') {
        const { data: userRes } = await admin.auth.admin.getUserById(site.user_id);
        const email = userRes?.user?.email;
        if (email) {
          await sendPostmarkEmail({
            to: email,
            subject: `Your domain www.${site.custom_domain} is live!`,
            htmlBody: `<p>Great news — your custom domain <strong>www.${site.custom_domain}</strong> is now serving your website over HTTPS.</p><p><a href="https://www.${site.custom_domain}">Visit your site</a></p>`,
            textBody: `Your custom domain www.${site.custom_domain} is now live: https://www.${site.custom_domain}`,
          }).catch((e) => console.error('email send failed', e));
        }
      }
    } catch (err) {
      console.error(`sweep failed for site ${site.id}`, err);
    }
  }

  return { statusCode: 200, body: `swept ${sites.length} sites` };
};

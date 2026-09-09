import { supabaseAdmin } from './_shared/auth.js';
import { sendPostmarkEmail } from './_shared/postmark.js';

// Probes pending custom domains every few minutes, flips them to active_ssl
// once they respond over HTTPS from Netlify, and emails the owner on the
// pending_dns/active_dns → active_ssl transition.
//
// Auth gate (Security Audit C3): Netlify scheduled functions are also
// reachable from the public internet by default. Without a guard, an
// external caller could trigger sweeps on demand — wasting Netlify
// quota and firing notification emails on transitions. Reject anything
// that isn't either:
//   - Netlify's scheduled invocation (header `x-netlify-event: schedule`)
//   - An internal call carrying a shared secret (DOMAIN_SWEEP_TOKEN)
export const handler = async (event = {}) => {
  const headers = event.headers || {};
  const isScheduled = headers['x-netlify-event'] === 'schedule';
  const adminToken = process.env.DOMAIN_SWEEP_TOKEN;
  const supplied =
    headers['x-domain-sweep-token'] || headers['X-Domain-Sweep-Token'];
  const authorized =
    isScheduled || (adminToken && supplied && supplied === adminToken);
  if (!authorized) {
    return { statusCode: 401, body: 'unauthorized' };
  }

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
          const htmlBody = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:40px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
  <tr><td align="center" style="padding-bottom:32px;">
    <img src="https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=400" alt="Auto Care Genius" width="130" style="display:block;width:130px;max-width:80%;height:auto;margin:0 auto 14px;border:0;outline:none;text-decoration:none;">
    <div style="font-family:'Lucida Sans','Lucida Sans Unicode','Lucida Grande',Verdana,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#999999;letter-spacing:1.5px;text-transform:uppercase;line-height:1;margin:0;">Websites</div>
  </td></tr>
  <tr><td style="background:#ffffff;border-radius:20px;border:1px solid #e4e4e7;padding:40px 36px;box-shadow:0 1px 3px rgba(0,0,0,0.04),0 8px 32px rgba(0,0,0,0.04);">
    <p style="margin:0 0 16px;font-size:14px;color:#3f3f46;line-height:1.6;">Great news — your custom domain <strong>www.${site.custom_domain}</strong> is now serving your website over HTTPS.</p>
    <p style="margin:0;font-size:14px;line-height:1.6;"><a href="https://www.${site.custom_domain}" style="color:#cc0000;text-decoration:none;font-weight:600;">Visit your site</a></p>
  </td></tr>
  <tr><td align="center" style="padding-top:24px;">
    <p style="margin:0;font-size:12px;color:#d4d4d8;">&copy; 2026 Auto Care Genius &middot; All rights reserved</p>
  </td></tr>
</table></td></tr></table></body></html>`;
          await sendPostmarkEmail({
            to: email,
            subject: `Your domain www.${site.custom_domain} is live!`,
            htmlBody,
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

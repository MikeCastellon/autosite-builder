import { supabaseAdmin } from './_shared/auth.js';
import { sendPostmarkEmail } from './_shared/postmark.js';

// Probes pending custom domains every few minutes, flips them to active_ssl
// once they respond over HTTPS, and emails the owner when that happens.
export const handler = async () => {
  const admin = supabaseAdmin();

  const { data: sites } = await admin
    .from('sites')
    .select('id, custom_domain, custom_domain_status, user_id')
    .not('custom_domain', 'is', null)
    .in('custom_domain_status', ['pending_dns', 'verifying']);

  if (!sites?.length) return { statusCode: 200, body: 'no sites to sweep' };

  for (const site of sites) {
    try {
      let status = 'pending_dns';
      try {
        const probe = await fetch(`https://www.${site.custom_domain}`, {
          method: 'HEAD',
          redirect: 'manual',
          signal: AbortSignal.timeout(8000),
        });
        status = probe.status < 500 ? 'active_ssl' : 'verifying';
      } catch {
        status = 'verifying';
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

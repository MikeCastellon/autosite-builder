import { getCustomHostname } from './_shared/cloudflare.js';
import { consolidateStatus } from './_shared/statusMachine.js';
import { supabaseAdmin } from './_shared/auth.js';
import { sendPostmarkEmail } from './_shared/postmark.js';

export const handler = async () => {
  const admin = supabaseAdmin();

  // Only care about sites that have a hostname and are not yet live.
  const { data: sites } = await admin
    .from('sites')
    .select('id, custom_domain, custom_hostname_apex_id, custom_hostname_www_id, custom_domain_status, user_id')
    .not('custom_hostname_apex_id', 'is', null)
    .in('custom_domain_status', ['pending_dns', 'active_dns']);

  if (!sites?.length) return { statusCode: 200, body: 'no sites to sweep' };

  for (const site of sites) {
    try {
      const [apex, www] = await Promise.all([
        getCustomHostname(site.custom_hostname_apex_id),
        getCustomHostname(site.custom_hostname_www_id),
      ]);
      const { status } = consolidateStatus(apex, www);
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
            subject: `Your domain ${site.custom_domain} is live!`,
            htmlBody: `<p>Great news — your custom domain <strong>${site.custom_domain}</strong> is now serving your website over HTTPS.</p><p><a href="https://${site.custom_domain}">Visit your site</a></p>`,
            textBody: `Your custom domain ${site.custom_domain} is now live: https://${site.custom_domain}`,
          }).catch((e) => console.error('email send failed', e));
        }
      }
    } catch (err) {
      console.error(`sweep failed for site ${site.id}`, err);
    }
  }

  return { statusCode: 200, body: `swept ${sites.length} sites` };
};

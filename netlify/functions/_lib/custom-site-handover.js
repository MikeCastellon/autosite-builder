import crypto from 'node:crypto';
import { isEffectiveSchedulerActive } from './subscription-gating.js';

// Handing a custom website to the customer's own account. The site was built
// under the admin's account (so drafts could be published); here it moves to
// the customer, with anything already tied to it, and the customer gets Pro
// when the deal includes it (bookings switch off on a free account).
//
// `db` is a service-role Supabase client (auth.admin is needed to create an
// account). Tables keyed by owner that follow the site: bookings, inquiries
// and charges (by site_id). Everything else is either keyed by site only
// (scheduler config, page views, images) or belongs to the person
// (customer_profiles), so it stays.
const FOLLOW_SITE = ['bookings', 'inquiries', 'charges'];

// The customer's account by email, with what they already have.
export async function findCustomerAccount(db, email) {
  const target = String(email || '').trim().toLowerCase();
  if (!target) return null;
  const { data: profile } = await db.from('profiles')
    .select('id, email, first_name, last_name, business_name, is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at, stripe_first_failed_payment_at, stripe_connect_charges_enabled')
    .eq('email', target)
    .maybeSingle();
  if (!profile) return null;
  const { data: sites } = await db.from('sites').select('id, site_type, business_info, published_url').eq('user_id', profile.id);
  return {
    userId: profile.id,
    email: profile.email,
    name: [profile.first_name, profile.last_name].filter(Boolean).join(' '),
    isAdmin: !!profile.is_super_admin,
    isPro: isEffectiveSchedulerActive(profile),
    paymentsConnected: !!profile.stripe_connect_charges_enabled,
    sites: (sites || []).map((s) => ({
      id: s.id,
      type: s.site_type || 'website',
      name: s.business_info?.businessName || '',
      publishedUrl: s.published_url || null,
    })),
  };
}

// Moves the project's site to the customer. Returns { userId, newAccount }.
// Throws with a readable message when it can't.
export async function handOverSite({ db, project, compPro }) {
  if (!project.site_id) throw Object.assign(new Error('Design and save the site first'), { status: 400 });
  const { data: site } = await db.from('sites').select('id, user_id, business_info').eq('id', project.site_id).maybeSingle();
  if (!site) throw Object.assign(new Error('The project\'s site no longer exists'), { status: 404 });

  const email = String(project.client_email || '').trim().toLowerCase();
  let account = await findCustomerAccount(db, email);
  let newAccount = false;
  if (!account) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { first_name: project.client_first_name || '', last_name: project.client_last_name || '' },
    });
    if (error || !data?.user?.id) {
      const msg = /already|registered|exists/i.test(error?.message || '')
        ? 'An account with this email exists but has no profile. Ask the customer which email they signed up with.'
        : `Could not create the customer's account: ${error?.message || 'unknown error'}`;
      throw Object.assign(new Error(msg), { status: 409 });
    }
    newAccount = true;
    account = { userId: data.user.id };
  } else {
    // An unconfirmed account may have been made by someone who doesn't own
    // the inbox (and knows its password). Take it over: confirm it, replace
    // the password with a random one, and send the customer the
    // set-password link as for a new account. Unconfirmed accounts can't
    // have signed in, so nobody is left holding a session.
    const { data: authUser } = await db.auth.admin.getUserById(account.userId);
    if (!authUser?.user?.email_confirmed_at) {
      const { error } = await db.auth.admin.updateUserById(account.userId, {
        email_confirm: true,
        password: crypto.randomBytes(24).toString('base64url'),
      });
      if (error) throw Object.assign(new Error(`Could not secure the customer's account: ${error.message}`), { status: 500 });
      newAccount = true;
    }
  }
  if (account.isAdmin) throw Object.assign(new Error('That email belongs to an admin account'), { status: 409 });

  // Profile: the project's details for a new account, or one taken over
  // (the signup trigger copies only the names createUser passes, and a
  // taken-over account's own signup values were typed by someone who never
  // proved the inbox), Pro when included. Existing accounts keep their own
  // details.
  const profilePatch = {};
  if (newAccount) {
    Object.assign(profilePatch, {
      first_name: project.client_first_name || null,
      last_name: project.client_last_name || null,
      business_name: project.business_name || null,
      phone: project.client_phone || null,
    });
  }
  // Never on top of a paid plan: that would keep Pro after they cancel.
  if (compPro && !account.isPro) profilePatch.scheduler_enabled = true;
  if (Object.keys(profilePatch).length) {
    const { error } = await db.from('profiles').update(profilePatch).eq('id', account.userId);
    if (error) throw Object.assign(new Error(`Could not update the customer's profile: ${error.message}`), { status: 500 });
  }

  const moved = {};
  if (site.user_id !== account.userId) {
    // The project-site marker only kept the admin's own review widgets off
    // the site while it was in the admin's account; the customer's own
    // widgets should work from now on.
    const businessInfo = { ...(site.business_info || {}) };
    delete businessInfo.customProjectId;
    const { error } = await db.from('sites').update({ user_id: account.userId, business_info: businessInfo }).eq('id', site.id);
    if (error) throw Object.assign(new Error(`Could not move the site: ${error.message}`), { status: 500 });
    for (const table of FOLLOW_SITE) {
      const { data, error: moveError } = await db.from(table).update({ owner_user_id: account.userId }).eq('site_id', site.id).select('id');
      if (moveError) console.error(`[custom-site-handover] ${table} not moved:`, moveError.message);
      moved[table] = data?.length || 0;
    }
  }
  return { userId: account.userId, newAccount, moved };
}

// The link in the access email: a set-your-password link for a new account
// (the app's reset-password screen), the sign-in page otherwise.
export async function accessLink(db, { email, newAccount, appUrl }) {
  if (!newAccount) return appUrl;
  const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: appUrl } });
  if (error || !data?.properties?.action_link) {
    throw new Error(`Could not create the set-password link: ${error?.message || 'no link returned'}`);
  }
  return data.properties.action_link;
}

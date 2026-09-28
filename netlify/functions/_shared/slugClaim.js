// Server-side slug authority. A slug is both the site's subdomain
// (`<slug>.autocaregeniushub.com`) and its R2 key prefix, so two rows
// holding the same slug publish over each other's live page. Only this
// module (running with the service role) decides which slug a publish
// writes to; the client's slug is just a preference for the first publish.
//
// `db` is a supabase-js client (service role in production, a fake in tests).
import { isValidSlug, isReservedSlug, slugCandidates } from './slug.js';

const SHARED_SLUG_ERROR =
  'Your web address is also claimed by another site, so publishing is paused to avoid overwriting it. Contact support to resolve it.';
const BAD_STORED_SLUG_ERROR =
  'Your web address needs attention from support before this site can be published.';

// True when another row holds this site's slug. Rows like that predate
// slug uniqueness and must be resolved by hand.
export async function isSlugShared(db, site) {
  if (!site.slug) return false;
  const { data, error } = await db
    .from('sites').select('id').eq('slug', site.slug).neq('id', site.id).limit(1);
  if (error) throw error;
  return data.length > 0;
}

// Returns { slug } to publish under, or { status, error } to refuse.
export async function resolvePublishSlug(db, site, requestedSlug) {
  try {
    if (site.slug) {
      // A site keeps its first slug for good, so renaming the business
      // doesn't move (or break) the live site. The stored value still gets
      // the same checks as a new one: rows written before slugs were
      // server-assigned could hold anything, e.g. "other-site/book".
      if (!isValidSlug(site.slug) || isReservedSlug(site.slug)) {
        console.warn(`[slugClaim] site ${site.id} has an unusable stored slug`);
        return { status: 409, error: BAD_STORED_SLUG_ERROR };
      }
      if (await isSlugShared(db, site)) return { status: 409, error: SHARED_SLUG_ERROR };
      return { slug: site.slug };
    }

    if (!isValidSlug(requestedSlug)) return { status: 400, error: 'Invalid slug' };

    for (const candidate of slugCandidates(requestedSlug)) {
      if (isReservedSlug(candidate)) continue;

      const { data: taken, error: takenErr } = await db
        .from('sites').select('id').eq('slug', candidate).neq('id', site.id).limit(1);
      if (takenErr) throw takenErr;
      if (taken.length) continue;

      // Claim only while this row still has no slug; a concurrent publish
      // of the same site may have claimed one already.
      const { data: claimed, error: claimErr } = await db
        .from('sites').update({ slug: candidate }).eq('id', site.id).is('slug', null).select('slug');
      if (claimErr) {
        if (claimErr.code === '23505') continue; // unique index: another site got it first
        throw claimErr;
      }
      if (!claimed.length) {
        const { data: row, error: rowErr } = await db
          .from('sites').select('slug').eq('id', site.id).maybeSingle();
        if (rowErr) throw rowErr;
        if (!row?.slug) throw new Error('slug claim lost without a slug');
        return resolvePublishSlug(db, { ...site, slug: row.slug }, requestedSlug);
      }

      // Backstop for rows the unique index doesn't cover: if another site
      // claimed the same slug at the same moment, back off. Never keep a
      // shared slug, because the other request may already be uploading.
      const { data: holders, error: holdersErr } = await db
        .from('sites').select('id').eq('slug', candidate);
      if (holdersErr) throw holdersErr;
      if (holders.length > 1) {
        const { error: releaseErr } = await db
          .from('sites').update({ slug: null }).eq('id', site.id).eq('slug', candidate);
        if (releaseErr) throw releaseErr;
        continue;
      }
      return { slug: candidate };
    }

    return { status: 409, error: 'Could not find a free web address for this name. Try a different business name.' };
  } catch (err) {
    console.error('[slugClaim] failed:', err?.message || err);
    return { status: 500, error: 'Could not reserve your web address. Please try again.' };
  }
}

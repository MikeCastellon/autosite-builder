import { supabase } from './supabase.js';

// The columns every save writes. user_id is deliberately not one of them:
// it is set once, when the row is created, and never rewritten. An upsert
// that carried the current user's id would hand a customer's site to
// whoever saved it (a super-admin may update any row via
// sites_admin_update_all).
export function buildSiteRecord({ businessInfo, generatedCopy, templateId, images, widgetConfigIds, customColors, customFonts }, now = new Date()) {
  const record = {
    business_info: businessInfo,
    generated_content: generatedCopy,
    template_id: templateId,
    widget_config_ids: widgetConfigIds || [],
    updated_at: now.toISOString(),
  };

  // Stash side-data inside generated_content so no new columns are required.
  const sideData = {};
  if (images && Object.keys(images).length > 0) sideData._images = images;
  if (customColors && Object.keys(customColors).length > 0) sideData._customColors = customColors;
  if (customFonts && Object.keys(customFonts).length > 0) sideData._customFonts = customFonts;
  if (Object.keys(sideData).length > 0) {
    record.generated_content = { ...(generatedCopy || {}), ...sideData };
  }
  return record;
}

/**
 * Save or update a site in Supabase, so the same siteId can be saved
 * repeatedly. Updates the existing row (keeping its owner) and only inserts,
 * owned by `userId`, when the row doesn't exist yet. `client` is injectable
 * for tests.
 */
export async function saveSite({ siteId, userId, ...content }, client = supabase) {
  const record = buildSiteRecord(content);
  const update = () => client
    .from('sites')
    .update(record)
    .eq('id', siteId)
    .select()
    .maybeSingle();

  const first = await update();
  if (first.error) throw first.error;
  if (first.data) return first.data;

  // No row this user can see: the first save of a new site. The insert
  // policy (sites_insert_own_with_limit) requires user_id = auth.uid().
  const inserted = await client
    .from('sites')
    .insert({ ...record, id: siteId, user_id: userId })
    .select()
    .single();
  if (!inserted.error) return inserted.data;

  // 23505 = unique_violation: an overlapping save created the row between
  // our update and insert. Update that row instead.
  if (inserted.error.code === '23505') {
    const retry = await update();
    if (retry.error) throw retry.error;
    if (retry.data) return retry.data;
  }
  throw inserted.error;
}

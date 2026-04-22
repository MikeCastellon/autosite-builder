import { supabase } from './supabase.js';

/**
 * Save or update a site in Supabase.
 * Uses upsert so the same siteId can be saved repeatedly.
 */
export async function saveSite({ siteId, userId, businessInfo, generatedCopy, templateId, images, widgetConfigIds, customColors, customFonts }) {
  const record = {
    id: siteId,
    user_id: userId,
    business_info: businessInfo,
    generated_content: generatedCopy,
    template_id: templateId,
    widget_config_ids: widgetConfigIds || [],
    updated_at: new Date().toISOString(),
  };

  // Stash side-data inside generated_content so no new columns are required.
  const sideData = {};
  if (images && Object.keys(images).length > 0) sideData._images = images;
  if (customColors && Object.keys(customColors).length > 0) sideData._customColors = customColors;
  if (customFonts && Object.keys(customFonts).length > 0) sideData._customFonts = customFonts;
  if (Object.keys(sideData).length > 0) {
    record.generated_content = { ...(generatedCopy || {}), ...sideData };
  }

  const { data, error } = await supabase
    .from('sites')
    .upsert(record, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

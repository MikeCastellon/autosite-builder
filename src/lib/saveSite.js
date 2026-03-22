import { supabase } from './supabase.js';

/**
 * Save or update a site in Supabase.
 * Uses upsert so the same siteId can be saved repeatedly.
 */
export async function saveSite({ siteId, userId, businessInfo, generatedCopy, templateId, images, widgetConfigIds }) {
  const record = {
    id: siteId,
    user_id: userId,
    business_info: businessInfo,
    generated_content: generatedCopy,
    template_id: templateId,
    widget_config_ids: widgetConfigIds || [],
    updated_at: new Date().toISOString(),
  };

  // Store images as base64 in generated_content (they're already data URLs)
  if (images && Object.keys(images).length > 0) {
    record.generated_content = { ...generatedCopy, _images: images };
  }

  const { data, error } = await supabase
    .from('sites')
    .upsert(record, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

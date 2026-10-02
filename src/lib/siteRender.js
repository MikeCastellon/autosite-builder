import { TEMPLATES } from '../data/templates.js';

// sites.generated_content holds the owner's copy plus side-data that
// saveSite.js stashes in it (_images, _customColors, _customFonts). Split
// them apart without mutating the row.
export function unpackGeneratedContent(generatedContent) {
  const { _images, _customColors, _customFonts, ...copy } = generatedContent || {};
  return {
    copy,
    images: _images || {},
    customColors: _customColors || {},
    customFonts: _customFonts || {},
  };
}

// The template's registry entry with the owner's color and font overrides
// applied — the meta the editor previews with. null for an unknown template.
export function buildTemplateMeta(templateId, customColors = {}, customFonts = {}) {
  const base = TEMPLATES[templateId];
  if (!base) return null;
  return {
    ...base,
    colors: { ...base.colors, ...customColors },
    font: customFonts.font ?? base.font,
    bodyFont: customFonts.bodyFont ?? base.bodyFont,
  };
}

// Everything publishSite needs for a saved site, built the way the editor
// builds it. Any publish that starts from a site row (e.g. dashboard
// Republish) must go through this: publishing with stock template colors
// and no images strips the owner's logo, photos, colors and fonts from
// their live site.
export function resolveSiteRender(site, generatedContent) {
  const { copy, images, customColors, customFonts } = unpackGeneratedContent(generatedContent);
  return {
    siteId: site.id,
    businessInfo: site.business_info || {},
    generatedCopy: copy,
    templateId: site.template_id,
    templateMeta: buildTemplateMeta(site.template_id, customColors, customFonts),
    images,
    selectedWidgetIds: site.widget_config_ids || [],
  };
}

// The widget types withWidgetKeys reads.
export const WIDGET_KEY_TYPES = ['instagram-feed', 'google-reviews'];

// Fill in the Google Reviews / Instagram widget keys the copy is missing
// from the owner's widget_configs, as the editor does when it opens a
// site. Without this a publish can fall back to AI testimonials even
// though the owner connected Google reviews. `db` is the supabase client.
export async function withWidgetKeys(copy, userId, db) {
  if (!userId || (copy.instagramWidgetKey && copy.googleWidgetKey)) return copy;
  try {
    const { data: widgets } = await db
      .from('widget_configs')
      .select('type, widget_key')
      .eq('user_id', userId)
      .in('type', WIDGET_KEY_TYPES)
      .order('created_at', { ascending: false });
    return applyWidgetKeys(copy, widgets);
  } catch {
    return copy;
  }
}

// withWidgetKeys' merge, for widget rows loaded some other way (`widgets`
// newest first, as withWidgetKeys orders them). Admin > Site upgrades gets
// the owner's rows from admin-site-upgrade, because RLS only lets a user
// read their own widget_configs: withWidgetKeys with an admin's client
// would silently drop the owner's Google reviews / Instagram keys.
export function applyWidgetKeys(copy, widgets) {
  if (!Array.isArray(widgets)) return copy;
  const ig = widgets.find((w) => w.type === 'instagram-feed');
  const gr = widgets.find((w) => w.type === 'google-reviews');
  return {
    ...copy,
    ...(ig && !copy.instagramWidgetKey ? { instagramWidgetKey: ig.widget_key } : {}),
    ...(gr && !copy.googleWidgetKey ? { googleWidgetKey: gr.widget_key } : {}),
  };
}

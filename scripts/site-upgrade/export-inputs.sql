-- scripts/site-upgrade/export-inputs.sql
--
-- READ-ONLY. The inputs of `npm run site:upgrade` (scripts/site-upgrade/cli.mjs):
-- one JSON document with every live website and exactly what Admin > Site
-- upgrades (SiteUpgradesTab.jsx buildAndCheck + admin-site-upgrade.js
-- `inputs` / `live`) reads to build and check a site's new page:
--   sites     the tab's SITE_COLUMNS + generated_content, for every row the
--             tab lists (site_type 'website', published_url set), newest
--             first, plus published_at (null until migration
--             20261004_sites_published_at.sql is applied), updated_at and a
--             fingerprint of everything the page is built from: the row,
--             its published_at, the owner's plan fields and widget keys
--             (sql.js FINGERPRINT_SQL; the fresh check before a publish
--             and the drift check after it compute the same expression)
--   owners    each owner's plan fields, all that isEffectiveSchedulerActive
--             reads (no names, no emails)
--   widgets   each owner's Google reviews / Instagram widget keys, newest
--             first, as the `inputs` action returns them (never tokens)
--   slugRows  every row (any type, live or not) holding one of these slugs,
--             for the shared-slug refusal (isSlugShared / resolvePublishSlug)
--   admins    the super admins' id and sign-in email: a write names the admin
--             who ran it (--by), as admin-site-upgrade records the signed-in one
--
-- Photos stored inside the draft (generated_content._images values that are
-- data: URIs over 2 KB, up to 44 MB each) are replaced by a short
-- "data:<type>;acg-omitted;bytes=<n>;md5=<md5>," marker and listed in
-- omittedImages: the tab flags such drafts (draft_inline_images). The CLI
-- puts a photo back from the live page when that page holds the very same
-- data: URI (same md5), and never publishes a site with omitted data.
--
-- Run it with the Supabase MCP execute_sql (project ktnouhjikmlxlbxcxyif)
-- and save the result as the --inputs file. It changes nothing.
with live as (
  select
    s.id, s.user_id, s.business_info, s.template_id, s.slug, s.published_url, s.custom_domain,
    s.custom_domain_status, s.site_type, s.scheduler_enabled, s.widget_config_ids, s.created_at,
    s.generated_content, s.updated_at,
    to_jsonb(s) -> 'published_at' as published_at,
    md5(jsonb_build_array(s.template_id, s.slug, s.published_url, s.site_type, s.scheduler_enabled, s.custom_domain, s.custom_domain_status, s.widget_config_ids, md5(coalesce(s.business_info::text, '')), md5(coalesce(s.generated_content::text, '')), to_jsonb(s) -> 'published_at', (select jsonb_build_array(p.is_super_admin, p.scheduler_enabled, p.subscription_status, p.subscription_ends_at, p.stripe_first_failed_payment_at) from public.profiles p where p.id = s.user_id), (select coalesce(jsonb_agg(jsonb_build_array(w.type, w.widget_key) order by w.created_at desc, w.id desc), '[]'::jsonb) from public.widget_configs w where w.user_id = s.user_id::text and w.type in ('instagram-feed', 'google-reviews')))::text) as fingerprint
  from public.sites s
  where s.site_type = 'website' and s.published_url is not null
),
inline_images as (
  select l.id, e.key, e.value #>> '{}' as v
  from live l
  cross join lateral jsonb_each(
    case when jsonb_typeof(l.generated_content -> '_images') = 'object' then l.generated_content -> '_images' else '{}'::jsonb end
  ) e
  where jsonb_typeof(e.value) = 'string'
    and left(e.value #>> '{}', 5) = 'data:'
    and length(e.value #>> '{}') > 2048
),
site_rows as (
  select
    l.*,
    case
      when exists (select 1 from inline_images i where i.id = l.id) then jsonb_set(
        l.generated_content, '{_images}',
        (select jsonb_object_agg(
            e.key,
            case when i.key is null then e.value
                 else to_jsonb(substring(i.v from '^data:[^;,]*') || ';acg-omitted;bytes=' || length(i.v) || ';md5=' || md5(i.v) || ',')
            end)
          from jsonb_each(l.generated_content -> '_images') e
          left join inline_images i on i.id = l.id and i.key = e.key))
      else l.generated_content
    end as generated_content_export,
    (select jsonb_agg(jsonb_build_object('key', i.key, 'bytes', length(i.v), 'md5', md5(i.v)) order by i.key)
       from inline_images i where i.id = l.id) as omitted_images
  from live l
)
select jsonb_build_object(
  'format', 'acg-site-upgrade-inputs/2',
  'exportedAt', now(),
  'publishedAtTracked', exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sites' and column_name = 'published_at'
  ),
  'sites', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'user_id', r.user_id,
      'business_info', r.business_info,
      'template_id', r.template_id,
      'slug', r.slug,
      'published_url', r.published_url,
      'custom_domain', r.custom_domain,
      'custom_domain_status', r.custom_domain_status,
      'site_type', r.site_type,
      'scheduler_enabled', r.scheduler_enabled,
      'widget_config_ids', r.widget_config_ids,
      'created_at', r.created_at,
      'generated_content', r.generated_content_export,
      'published_at', r.published_at,
      'updated_at', r.updated_at,
      'fingerprint', r.fingerprint,
      'omittedImages', coalesce(r.omitted_images, '[]'::jsonb)
    ) order by r.created_at desc, r.id)
    from site_rows r
  ), '[]'::jsonb),
  'owners', coalesce((
    select jsonb_object_agg(p.id::text, jsonb_build_object(
      'id', p.id,
      'is_super_admin', p.is_super_admin,
      'scheduler_enabled', p.scheduler_enabled,
      'subscription_status', p.subscription_status,
      'subscription_ends_at', p.subscription_ends_at,
      'stripe_first_failed_payment_at', p.stripe_first_failed_payment_at
    ))
    from public.profiles p
    where p.id in (select user_id from live)
  ), '{}'::jsonb),
  'widgets', coalesce((
    select jsonb_object_agg(u.user_id, u.list)
    from (
      select w.user_id,
             jsonb_agg(jsonb_build_object('type', w.type, 'widget_key', w.widget_key) order by w.created_at desc, w.id desc) as list
      from public.widget_configs w
      where w.user_id in (select user_id::text from live)
        and w.type in ('instagram-feed', 'google-reviews')
      group by w.user_id
    ) u
  ), '{}'::jsonb),
  'slugRows', coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'slug', s.slug) order by s.slug, s.id)
    from public.sites s
    where s.slug in (select slug from live where slug is not null)
  ), '[]'::jsonb),
  'admins', coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'email', lower(p.email)) order by p.id)
    from public.profiles p
    where p.is_super_admin = true and p.email is not null
  ), '[]'::jsonb)
) as inputs;

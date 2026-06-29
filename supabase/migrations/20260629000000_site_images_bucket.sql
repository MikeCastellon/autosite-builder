-- Public bucket for site images. Images are uploaded here (downscaled JPEGs)
-- and referenced by URL in sites.generated_content._images, replacing the old
-- inline-base64 storage that blew past Netlify's ~6 MB publish payload limit.
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

-- Public read (bucket is public; explicit policy for clarity).
create policy "site_images_public_read"
on storage.objects for select
using (bucket_id = 'site-images');

-- Write access: the first path segment must be a site the caller owns, or
-- the caller is a super admin. Mirrors the public.sites ownership model and
-- keeps impersonated uploads working (token = impersonated user).
create policy "site_images_owner_insert"
on storage.objects for insert
with check (
  bucket_id = 'site-images'
  and (
    is_super_admin(auth.uid())
    or exists (
      select 1 from public.sites s
      where s.id = ((storage.foldername(name))[1])::uuid
        and s.user_id = auth.uid()
    )
  )
);

create policy "site_images_owner_update"
on storage.objects for update
using (
  bucket_id = 'site-images'
  and (
    is_super_admin(auth.uid())
    or exists (
      select 1 from public.sites s
      where s.id = ((storage.foldername(name))[1])::uuid
        and s.user_id = auth.uid()
    )
  )
);

create policy "site_images_owner_delete"
on storage.objects for delete
using (
  bucket_id = 'site-images'
  and (
    is_super_admin(auth.uid())
    or exists (
      select 1 from public.sites s
      where s.id = ((storage.foldername(name))[1])::uuid
        and s.user_id = auth.uid()
    )
  )
);

-- Pulse Multi-Tenant v1 hardening
-- Requires 001_multitenant_core.sql.
-- The bucket remains private and object paths are industry-scoped.

create or replace function public.current_industry_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.industry_id
  from public.profiles p
  join public.industries i on i.id = p.industry_id
  where p.id = auth.uid()
    and i.status = 'active'
$$;

insert into storage.buckets (id, name, public)
values ('pulse-documents', 'pulse-documents', false)
on conflict (id) do update set public = false;

drop policy if exists pulse_documents_object_select on storage.objects;
create policy pulse_documents_object_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'pulse-documents'
  and split_part(name, '/', 1) = public.current_industry_id()::text
);

drop policy if exists pulse_documents_object_insert on storage.objects;
create policy pulse_documents_object_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'pulse-documents'
  and split_part(name, '/', 1) = public.current_industry_id()::text
);

drop policy if exists pulse_documents_object_update on storage.objects;
create policy pulse_documents_object_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'pulse-documents'
  and split_part(name, '/', 1) = public.current_industry_id()::text
)
with check (
  bucket_id = 'pulse-documents'
  and split_part(name, '/', 1) = public.current_industry_id()::text
);

drop policy if exists pulse_documents_object_delete on storage.objects;
create policy pulse_documents_object_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'pulse-documents'
  and split_part(name, '/', 1) = public.current_industry_id()::text
);

-- Defense in depth: suspended industries resolve to NULL above, so tenant-scoped
-- table policies deny access automatically without relying on the browser.

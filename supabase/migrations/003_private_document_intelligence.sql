-- Pulse Private Document Intelligence v1
-- Stores tenant-scoped extracted text chunks for future private retrieval/Ask AI.
-- No model/provider credentials belong in this migration.

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid not null references public.industries(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (length(trim(content)) > 0),
  source_type text not null default 'text' check (source_type in ('text','csv','json','manual')),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists document_chunks_industry_id_idx
  on public.document_chunks(industry_id);
create index if not exists document_chunks_document_id_idx
  on public.document_chunks(document_id);

alter table public.document_chunks enable row level security;

drop policy if exists document_chunks_industry_select on public.document_chunks;
create policy document_chunks_industry_select
on public.document_chunks for select
using (industry_id = public.current_industry_id());

drop policy if exists document_chunks_industry_insert on public.document_chunks;
create policy document_chunks_industry_insert
on public.document_chunks for insert
with check (
  industry_id = public.current_industry_id()
  and exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.industry_id = public.current_industry_id()
  )
);

drop policy if exists document_chunks_industry_update on public.document_chunks;
create policy document_chunks_industry_update
on public.document_chunks for update
using (industry_id = public.current_industry_id())
with check (industry_id = public.current_industry_id());

drop policy if exists document_chunks_industry_delete on public.document_chunks;
create policy document_chunks_industry_delete
on public.document_chunks for delete
using (industry_id = public.current_industry_id());

-- Explicit grants for the browser client. RLS remains the authorization boundary.
grant select, insert, update, delete on public.document_chunks to authenticated;

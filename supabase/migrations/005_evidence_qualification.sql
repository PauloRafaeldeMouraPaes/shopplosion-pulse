-- Pulse Evidence Qualification v1 (Fase 2: Objetos e citações)
-- Lets a user "qualify" a document chunk as evidence: a claim, an optional
-- period the claim refers to, and a confidence rating with rationale.
-- Mirrors the RLS + composite-FK-integrity pattern from 003/004.

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid not null references public.industries(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  document_chunk_id uuid not null references public.document_chunks(id) on delete cascade,
  claim text not null check (length(trim(claim)) > 0),
  period_start date,
  period_end date,
  confidence text not null default 'media' check (confidence in ('alta','media','baixa')),
  confidence_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (period_end is null or period_start is null or period_end >= period_start)
);

create index if not exists evidence_industry_id_idx
  on public.evidence(industry_id);
create index if not exists evidence_document_id_idx
  on public.evidence(document_id);
create index if not exists evidence_document_chunk_id_idx
  on public.evidence(document_chunk_id);

alter table public.evidence enable row level security;

drop policy if exists evidence_industry_select on public.evidence;
create policy evidence_industry_select
on public.evidence for select
using (industry_id = public.current_industry_id());

drop policy if exists evidence_industry_insert on public.evidence;
create policy evidence_industry_insert
on public.evidence for insert
with check (
  industry_id = public.current_industry_id()
  and exists (
    select 1
    from public.document_chunks dc
    where dc.id = document_chunk_id
      and dc.document_id = document_id
      and dc.industry_id = public.current_industry_id()
  )
);

drop policy if exists evidence_industry_update on public.evidence;
create policy evidence_industry_update
on public.evidence for update
using (industry_id = public.current_industry_id())
with check (industry_id = public.current_industry_id());

drop policy if exists evidence_industry_delete on public.evidence;
create policy evidence_industry_delete
on public.evidence for delete
using (industry_id = public.current_industry_id());

-- Explicit grants for the browser client. RLS remains the authorization boundary.
grant select, insert, update, delete on public.evidence to authenticated;

-- Defense-in-depth: a chunk of evidence must belong to the same document and
-- industry as the document/chunk it points to (same pattern as 004).
create unique index if not exists document_chunks_id_document_id_industry_id_uidx
  on public.document_chunks(id, document_id, industry_id);

alter table public.evidence
  drop constraint if exists evidence_chunk_document_industry_fkey;

alter table public.evidence
  add constraint evidence_chunk_document_industry_fkey
  foreign key (document_chunk_id, document_id, industry_id)
  references public.document_chunks(id, document_id, industry_id)
  on delete cascade;

create index if not exists evidence_chunk_document_industry_idx
  on public.evidence(document_chunk_id, document_id, industry_id);

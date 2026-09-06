-- Pulse Private Document Integrity v1
-- Defense-in-depth: a chunk must belong to the same industry as its parent document.
-- RLS remains the authorization boundary; this constraint protects relational integrity.

create unique index if not exists documents_id_industry_id_uidx
  on public.documents(id, industry_id);

alter table public.document_chunks
  drop constraint if exists document_chunks_document_industry_fkey;

alter table public.document_chunks
  add constraint document_chunks_document_industry_fkey
  foreign key (document_id, industry_id)
  references public.documents(id, industry_id)
  on delete cascade;

create index if not exists document_chunks_document_industry_idx
  on public.document_chunks(document_id, industry_id);

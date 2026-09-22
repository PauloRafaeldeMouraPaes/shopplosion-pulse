alter table public.analyses add column if not exists status text not null default 'draft' check (status in ('draft','published','archived'));
alter table public.analyses add column if not exists limits text;
alter table public.analyses add column if not exists published_at timestamptz;
create index if not exists analyses_status_idx on public.analyses(industry_id,status,created_at desc);
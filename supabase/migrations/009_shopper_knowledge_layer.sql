create table if not exists public.shopper_knowledge (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid not null references public.industries(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  investigation_id uuid references public.investigations(id) on delete set null,
  claim text not null,
  source_type text not null default 'investigation' check (source_type in ('study','evidence','investigation','analysis','manual')),
  segment text,
  category text,
  mission text,
  period_start date,
  period_end date,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status text not null default 'proposed' check (status in ('proposed','validated','outdated','rejected')),
  evidence jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.shopper_knowledge enable row level security;
create index if not exists shopper_knowledge_industry_updated_idx on public.shopper_knowledge(industry_id,last_updated_at desc);
create index if not exists shopper_knowledge_investigation_idx on public.shopper_knowledge(investigation_id);
drop policy if exists shopper_knowledge_industry_select on public.shopper_knowledge;
drop policy if exists shopper_knowledge_industry_insert on public.shopper_knowledge;
drop policy if exists shopper_knowledge_industry_update on public.shopper_knowledge;
drop policy if exists shopper_knowledge_industry_delete on public.shopper_knowledge;
create policy shopper_knowledge_industry_select on public.shopper_knowledge for select using (industry_id = private.current_industry_id());
create policy shopper_knowledge_industry_insert on public.shopper_knowledge for insert with check (industry_id = private.current_industry_id() and created_by = auth.uid());
create policy shopper_knowledge_industry_update on public.shopper_knowledge for update using (industry_id = private.current_industry_id()) with check (industry_id = private.current_industry_id());
create policy shopper_knowledge_industry_delete on public.shopper_knowledge for delete using (industry_id = private.current_industry_id());
alter table public.shopper_knowledge
  add column if not exists scope text not null default 'industry'
  check (scope in ('industry','universe','both'));

create index if not exists shopper_knowledge_scope_idx
  on public.shopper_knowledge(industry_id,scope,last_updated_at desc);

create table if not exists public.knowledge_updates (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid not null references public.industries(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  knowledge_id uuid references public.shopper_knowledge(id) on delete set null,
  investigation_id uuid references public.investigations(id) on delete set null,
  classification text not null check (classification in ('consistent','potential_change','contradiction','insufficient','outdated')),
  previous_claim text,
  current_claim text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence jsonb not null default '[]'::jsonb,
  scope text not null check (scope in ('industry','universe','both')),
  period_start date,
  period_end date,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.knowledge_updates enable row level security;
create index if not exists knowledge_updates_industry_checked_idx on public.knowledge_updates(industry_id,checked_at desc);
create index if not exists knowledge_updates_knowledge_idx on public.knowledge_updates(knowledge_id,checked_at desc);
create index if not exists knowledge_updates_investigation_idx on public.knowledge_updates(investigation_id,checked_at desc);
drop policy if exists knowledge_updates_select on public.knowledge_updates;
drop policy if exists knowledge_updates_insert on public.knowledge_updates;
create policy knowledge_updates_select on public.knowledge_updates for select using (industry_id = private.current_industry_id());
create policy knowledge_updates_insert on public.knowledge_updates for insert with check (industry_id = private.current_industry_id() and created_by = auth.uid());

create table if not exists public.saved_evidence (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid not null references public.industries(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  evidence_id text not null,
  title text,
  category text,
  fact text,
  source text,
  context text,
  interpretation text,
  hypothesis text,
  action text,
  period text,
  confidence text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(industry_id,created_by,evidence_id)
);
alter table public.saved_evidence enable row level security;
create index if not exists saved_evidence_industry_created_idx on public.saved_evidence(industry_id,created_at desc);
drop policy if exists saved_evidence_select on public.saved_evidence;
drop policy if exists saved_evidence_insert on public.saved_evidence;
drop policy if exists saved_evidence_delete on public.saved_evidence;
create policy saved_evidence_select on public.saved_evidence for select using (industry_id = private.current_industry_id());
create policy saved_evidence_insert on public.saved_evidence for insert with check (industry_id = private.current_industry_id() and created_by = auth.uid());
create policy saved_evidence_delete on public.saved_evidence for delete using (industry_id = private.current_industry_id() and created_by = auth.uid());
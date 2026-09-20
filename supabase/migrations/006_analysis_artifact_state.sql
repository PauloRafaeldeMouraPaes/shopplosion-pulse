-- Fase 4 do design system Pulse: Análises como o único artefato publicável,
-- com estado rascunho/publicada e limites declarados obrigatórios antes de
-- publicar (Regra 5 da proposta: "Analysis é o único artefato publicável,
-- com limites declarados obrigatórios"). Toda análise nasce como rascunho
-- (o comportamento atual de "Salvar como análise" no Ask AI não muda) e só
-- pode ser marcada como publicada quando limites não vazios são
-- declarados junto — essa obrigatoriedade é garantida no próprio banco,
-- não apenas na interface, para que nenhum caminho (app.html, uma futura
-- API, um script) consiga publicar uma análise sem limites.

alter table public.analyses
  add column if not exists status text not null default 'draft',
  add column if not exists limits text,
  add column if not exists published_at timestamptz;

alter table public.analyses
  drop constraint if exists analyses_status_check;
alter table public.analyses
  add constraint analyses_status_check check (status in ('draft', 'published'));

alter table public.analyses
  drop constraint if exists analyses_published_requires_limits;
alter table public.analyses
  add constraint analyses_published_requires_limits
  check (status <> 'published' or (limits is not null and length(trim(limits)) > 0));

create index if not exists analyses_status_idx on public.analyses(status);

-- Nenhuma política de RLS nova é necessária: analyses_industry_update
-- (001_multitenant_core.sql) já permite update por qualquer membro da
-- mesma indústria, o que cobre a transição rascunho → publicada.

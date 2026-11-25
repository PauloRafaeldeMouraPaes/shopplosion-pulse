# Conta de demonstração: refrigerantes (24/11/2026)

Pedido do Paulo em 24/11: simular uma indústria de refrigerantes que contratou o Pulse, com usuário real, para montar um case de demonstração com o que a plataforma mostra.

Mudança de dados em produção (sem DDL, sem grants, sem RLS), feita em uma transação em 25/11/2026 00:3x UTC:

- `industries`: nova linha `Demonstração: Refrigerantes`, slug `demo-refrigerantes`, id `15670e94-5ad3-44bf-aba2-c09ee7d9dd10`, `signal_topic_terms` = refrigerante, guarana, soft drink, bebida gaseificada.
- `intelligence_sources`: cinco fontes públicas dessa indústria (dois RSS da Agência Brasil para descoberta e as três páginas das evidências públicas de refrigerantes).
- `profiles`: o usuário do Paulo (`885fecf9-f268-4572-ae8e-503049707c57`) passou da Indústria Teste B (`2fe50a7d-4f68-41fe-9d77-02cdb96ae1c8`) para a indústria de demonstração. Os três documentos de teste da Indústria Teste B continuam lá e deixam de aparecer para ele enquanto durar a demonstração.

Nenhum dado de outra indústria foi lido ou alterado. A indústria nova não tem marca no nome.

## Rollback

```sql
begin;
update profiles set industry_id = '2fe50a7d-4f68-41fe-9d77-02cdb96ae1c8'
 where id = '885fecf9-f268-4572-ae8e-503049707c57' and industry_id = '15670e94-5ad3-44bf-aba2-c09ee7d9dd10';
delete from intelligence_signal_events where industry_id = '15670e94-5ad3-44bf-aba2-c09ee7d9dd10';
delete from intelligence_signals where industry_id = '15670e94-5ad3-44bf-aba2-c09ee7d9dd10';
delete from intelligence_source_items where source_id in (select id from intelligence_sources where industry_id = '15670e94-5ad3-44bf-aba2-c09ee7d9dd10');
delete from intelligence_source_fetch_runs where source_id in (select id from intelligence_sources where industry_id = '15670e94-5ad3-44bf-aba2-c09ee7d9dd10');
delete from intelligence_sources where industry_id = '15670e94-5ad3-44bf-aba2-c09ee7d9dd10';
delete from industries where id = '15670e94-5ad3-44bf-aba2-c09ee7d9dd10';
commit;
```

Antes de rodar, conferir com `\d` as chaves estrangeiras das tabelas de sinais: se alguma tiver `on delete cascade`, os deletes intermediários são redundantes, não prejudiciais.

## Ajustes de 25/11/2026 (dados, sem DDL)

Depois do deploy dos signal workers (source v8, signal v20, backstop v17, run 45531959840):

- `industries.signal_topic_terms` da indústria de demonstração ganhou `nao alcoolic` e `nao-alcoolic`: para um fabricante de refrigerantes, bebidas não alcoólicas são o mercado dele. Sem isso, a nova regra de relevância (tema no trecho, no título da fonte ou na frase vizinha) descartaria os sinais de bebidas não alcoólicas fora de casa.
- `intelligence_sources.last_fetched_at` das cinco fontes da demonstração voltou a nulo para forçar a captura com o novo extrator; a página da Neogrid passou de 192 para 2.217 caracteres.
- Três sinais da demonstração que a regra nova não gera mais ficaram `dismissed`: o de batata congelada para air fryer (fora do tema), o de cabeçalho da página NIQ e uma versão antiga do sinal de refrigerante sem açúcar, substituída pela nova.

Conferido na mesma hora: a indústria piloto de chocolate não ganhou sinal novo, os 14 ativos seguem ativos e os 19 dispensados seguem dispensados.

Rollback destes ajustes:

```sql
update industries set signal_topic_terms = array['refrigerante','guarana','soft drink','bebida gaseificada']::text[]
 where id = '15670e94-5ad3-44bf-aba2-c09ee7d9dd10';
```

Os três sinais dispensados podem voltar a `active` pelo título, se for preciso; o rollback completo da demonstração continua sendo o bloco acima.

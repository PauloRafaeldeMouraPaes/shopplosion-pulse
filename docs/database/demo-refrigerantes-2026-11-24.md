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

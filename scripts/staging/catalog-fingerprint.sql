-- Read-only catalog fingerprint. Run on staging and on production and compare the rows.
-- Same count and hash per category means identical schema objects in that category.
-- Project refs and carriage returns are normalised so the two projects can be compared.
-- To locate a difference, replace the final SELECT with: select k, n, h from objs order by k, n;
with objs as (
  select 'table' k, c.relname::text n, md5(string_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull||':'||coalesce(pg_get_expr(d.adbin,d.adrelid),''),',' order by a.attnum)) h
  from pg_class c join pg_namespace s on s.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
  where s.nspname in ('public','private') and c.relkind in ('r','v','p') group by c.relname
  union all select 'rls', c.relname, c.relrowsecurity::text from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname in ('public','private') and c.relkind='r'
  union all select 'view', c.relname, md5(pg_get_viewdef(c.oid)) from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='public' and c.relkind='v'
  union all select 'func', s.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')', md5(replace(regexp_replace(pg_get_functiondef(p.oid),'ymitcepxpavjedntylem|ppfuygnpgywfpiqxsfys','HOST','g'),E'\r','')) from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname in ('public','private') and p.prokind='f'
  union all select 'funcacl', s.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')', coalesce(p.proacl::text,'default') from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname in ('public','private')
  union all select 'policy', schemaname||'.'||tablename||'.'||policyname, md5(cmd||coalesce(qual,'')||coalesce(with_check,'')||roles::text) from pg_policies where schemaname in ('public','storage')
  union all select 'trigger', c.relname||'.'||t.tgname, md5(pg_get_triggerdef(t.oid)) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace s on s.oid=c.relnamespace where s.nspname in ('public','private') and not t.tgisinternal
  union all select 'index', i.relname, md5(pg_get_indexdef(i.oid)) from pg_index x join pg_class i on i.oid=x.indexrelid join pg_namespace s on s.oid=i.relnamespace where s.nspname in ('public','private')
  union all select 'tableacl', s.nspname||'.'||c.relname, coalesce(c.relacl::text,'default') from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname in ('public','private') and c.relkind in ('r','v')
  union all select 'constraint', conrelid::regclass::text||'.'||conname, md5(pg_get_constraintdef(oid)) from pg_constraint where connamespace in ('public'::regnamespace,'private'::regnamespace)
  union all select 'ext', extname, extversion from pg_extension
  union all select 'evtrg', evtname, evtfoid::regproc::text||evtenabled::text from pg_event_trigger
)
select k, count(*), md5(string_agg(n||'|'||h, ',' order by n)) from objs group by k order by k;

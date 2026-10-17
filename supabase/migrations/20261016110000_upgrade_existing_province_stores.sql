-- Adds batchid / expirydate to existing province stock tables without changing current rows.
-- Existing rows get batchid 'LEGACY'; the primary key becomes (productcode, batchid).
do $$
declare
  p record;
  pk_cols text;
begin
  for p in select province_code from public.province loop
    if to_regclass(format('public.%I', p.province_code)) is null then
      continue;
    end if;

    execute format('alter table public.%I add column if not exists expirydate date null', p.province_code);
    execute format(
      'alter table public.%I add column if not exists batchid character varying(50) not null default %L',
      p.province_code, 'LEGACY'
    );

    select string_agg(a.attname, ',' order by a.attname) into pk_cols
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = format('public.%I', p.province_code)::regclass and c.contype = 'p';

    if pk_cols is distinct from 'batchid,productcode' then
      execute format('alter table public.%I drop constraint if exists %I', p.province_code, p.province_code || '_pkey');
      execute format(
        'alter table public.%I add constraint %I primary key (productcode, batchid)',
        p.province_code, p.province_code || '_pkey'
      );
    end if;

    -- New rows must supply a batch explicitly.
    execute format('alter table public.%I alter column batchid drop default', p.province_code);
  end loop;
end;
$$;

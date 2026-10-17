-- Creates a stock table named after each new province (e.g. "RCD").
create or replace function public.create_province_store()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  execute format(
    'create table if not exists public.%1$I (
      productcode character varying(20) not null,
      batchid character varying(50) not null,
      quantity integer not null default 2,
      dateadded date null default current_date,
      expirydate date null,
      lastmodified timestamp without time zone null default now(),
      modifiedby character varying(50) null,
      constraint %2$I primary key (productcode, batchid),
      constraint %3$I foreign key (productcode) references public.products (productcode) on delete cascade
    )',
    new.province_code,
    new.province_code || '_pkey',
    new.province_code || '_productcode_fkey'
  );
  return new;
end;
$$;

drop trigger if exists trg_create_province_store on public.province;
create trigger trg_create_province_store
after insert on public.province
for each row
execute function public.create_province_store();

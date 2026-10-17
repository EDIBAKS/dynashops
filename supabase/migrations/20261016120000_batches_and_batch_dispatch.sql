-- Registry of product batches. Province stock tables hold one row per (productcode, batchid).
create table if not exists public.batches (
  batchid character varying(50) not null,
  productcode character varying(20) not null,
  expirydate date null,
  createdat timestamp without time zone not null default now(),
  createdby character varying(50) null,
  constraint batches_pkey primary key (productcode, batchid),
  constraint batches_productcode_fkey foreign key (productcode)
    references public.products (productcode) on delete cascade
);

alter table public.batches enable row level security;

drop policy if exists batches_select on public.batches;
create policy batches_select on public.batches for select to authenticated using (true);
drop policy if exists batches_insert on public.batches;
create policy batches_insert on public.batches for insert to authenticated with check (true);

grant select, insert on public.batches to authenticated;

-- Province -> shop, deducting from a specific batch.
drop function if exists public.transfer_stock(text, text, text, text, integer, text, date, text, uuid);

create or replace function public.transfer_stock(
  p_province text,
  p_shopcode text,
  p_productcode text,
  p_productname text,
  p_quantity integer,
  p_modifiedby text,
  p_dispatch_date date,
  p_dispatchtype text,
  p_request_id uuid,
  p_batchid text
)
returns void
language plpgsql
as $function$
declare
  from_qty int;
  to_table text := p_shopcode || '_STOCK';
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if p_batchid is null or btrim(p_batchid) = '' then
    raise exception 'Batch is required';
  end if;

  if not public.claim_dispatch_request(p_request_id) then
    return;
  end if;

  execute format(
    'select quantity from %I where productcode = %L and batchid = %L for update',
    p_province, p_productcode, p_batchid
  ) into from_qty;

  if from_qty is null then
    raise exception 'Batch % of product % not found in %', p_batchid, p_productcode, p_province;
  end if;
  if from_qty < p_quantity then
    raise exception 'Insufficient stock in batch % of %', p_batchid, p_province;
  end if;

  execute format(
    'update %I set quantity = quantity - %s, modifiedby = %L, lastmodified = now()
     where productcode = %L and batchid = %L',
    p_province, p_quantity, p_modifiedby, p_productcode, p_batchid
  );

  execute format(
    'insert into %1$I (productcode, productname, quantity, modifiedby)
     values (%2$L, %3$L, %4$s, %5$L)
     on conflict (productcode) do update
       set quantity = %1$I.quantity + excluded.quantity,
           modifiedby = excluded.modifiedby',
    to_table, p_productcode, p_productname, p_quantity, p_modifiedby
  );

  insert into dispatches (
    datecreated, from_location, to_location, productcode, quantity, createdby, dispatchtype
  )
  values (
    p_dispatch_date, p_province, to_table, p_productcode, p_quantity, p_modifiedby, p_dispatchtype
  );
end;
$function$;

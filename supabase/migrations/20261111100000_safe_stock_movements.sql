-- Serialize movements by stock table and product, even when destinations differ.
-- Keep the existing RPCs transactional and retain their request-id behavior.
create or replace function public._move_stock(
  p_from text, p_to text, p_productcode text, p_productname text, p_qty int, p_modifiedby text
)
returns void
language plpgsql
as $$
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if p_from = p_to then
    raise exception 'Source and destination cannot be the same';
  end if;
  if not public.is_stock_table(p_from) or not public.is_stock_table(p_to) then
    raise exception 'Invalid stock table';
  end if;

  perform pg_advisory_xact_lock(hashtext(least(p_from, p_to) || '|' || p_productcode));
  perform pg_advisory_xact_lock(hashtext(greatest(p_from, p_to) || '|' || p_productcode));
  perform public._deduct_stock(p_from, p_productcode, p_qty, p_modifiedby);
  perform public._add_stock_row(p_to, p_productcode, p_productname, p_qty, p_modifiedby);
end;
$$;

-- Check the amount actually deducted after locking, not a pre-lock sum.
-- Raising an exception rolls back every row change and the associated movement.
create or replace function public._deduct_stock(
  p_table text, p_productcode text, p_qty int, p_modifiedby text
)
returns void
language plpgsql
as $$
declare
  remaining int := p_qty;
  take int;
  r record;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_table || '|' || p_productcode));
  for r in
    execute format(
      'select ctid as rid, quantity from %I
       where productcode = $1 and quantity > 0
       order by lastmodified nulls first, ctid for update',
      p_table
    ) using p_productcode
  loop
    exit when remaining <= 0;
    take := least(r.quantity, remaining);
    execute format(
      'update %I set quantity = quantity - $1, modifiedby = $2, lastmodified = now() where ctid = $3',
      p_table
    ) using take, p_modifiedby, r.rid;
    remaining := remaining - take;
  end loop;

  if remaining <> 0 then
    raise exception 'Insufficient stock in % (requested %, available %)',
      p_table, p_qty, p_qty - remaining;
  end if;
end;
$$;

-- Concurrent incoming transfers must not both create the same destination row.
create or replace function public._add_stock_row(
  p_table text, p_productcode text, p_productname text, p_qty int, p_modifiedby text
)
returns void
language plpgsql
as $$
declare
  has_batch boolean := public._has_column(p_table, 'batchid');
  has_name boolean := public._has_column(p_table, 'productname');
  updated int;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_table || '|' || p_productcode));
  execute format(
    'update %I set quantity = quantity + $1, modifiedby = $2, lastmodified = now()
     where productcode = $3 %s',
    p_table, case when has_batch then 'and batchid = ''LEGACY''' else '' end
  ) using p_qty, p_modifiedby, p_productcode;
  get diagnostics updated = row_count;
  if updated > 1 then
    raise exception 'Duplicate stock rows in % for product %', p_table, p_productcode;
  end if;
  if updated = 1 then
    return;
  end if;

  execute format(
    'insert into %I (productcode, %s quantity, modifiedby, lastmodified) values ($1, %s $2, $3, now())',
    p_table,
    case when has_name then 'productname,' else '' end || case when has_batch then 'batchid,' else '' end,
    case when has_name then '$4,' else '' end || case when has_batch then '''LEGACY'',' else '' end
  ) using p_productcode, p_qty, p_modifiedby, p_productname;
end;
$$;

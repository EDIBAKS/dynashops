-- Fix withdraw_stock: withdraws uses from_location/to_location and requires id; make it retry-safe.

drop function if exists public.withdraw_stock(text, text, text, integer, text);

create or replace function public.withdraw_stock(
  p_from_table text,
  p_to_province text,
  p_productcode text,
  p_quantity integer,
  p_createdby text,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  from_qty integer;
  v_productcode text := trim(p_productcode);
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if p_from_table = p_to_province then
    raise exception 'Source and destination cannot be the same';
  end if;

  if not public.is_stock_table(p_from_table) then
    raise exception 'Source table % is not a valid stock table', p_from_table;
  end if;

  if not public.is_stock_table(p_to_province) then
    raise exception 'Destination table % is not a valid stock table', p_to_province;
  end if;

  if not public.claim_dispatch_request(p_request_id) then
    return;
  end if;

  execute format(
    'select quantity from %I where productcode = %L for update',
    p_from_table, v_productcode
  ) into from_qty;

  if from_qty is null then
    raise exception 'Product % not found in %', v_productcode, p_from_table;
  end if;

  if from_qty < p_quantity then
    raise exception 'Insufficient stock in %', p_from_table;
  end if;

  execute format(
    'update %I set quantity = quantity - %s, modifiedby = %L, lastmodified = now() where productcode = %L',
    p_from_table, p_quantity, p_createdby, v_productcode
  );

  execute format(
    'insert into %1$I (productcode, quantity, modifiedby, lastmodified)
     values (%2$L, %3$s, %4$L, now())
     on conflict (productcode) do update set
       quantity = %1$I.quantity + excluded.quantity,
       modifiedby = excluded.modifiedby,
       lastmodified = now()',
    p_to_province, v_productcode, p_quantity, p_createdby
  );

  insert into public.withdraws (id, datecreated, from_location, to_location, productcode, quantity, createdby)
  values (gen_random_uuid(), now(), p_from_table, p_to_province, v_productcode, p_quantity, p_createdby);
end;
$function$;

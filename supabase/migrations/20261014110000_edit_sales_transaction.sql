-- Atomic receipt edit: header, lines and <DPC>_STOCK are changed together or not at all.
-- Errors: NOT_AUTHENTICATED, NOT_AUTHORIZED, RECEIPT_NOT_FOUND, STALE_RECEIPT, INVALID_DPC, INVALID_DISTRIBUTOR,
-- INVALID_DATE, DATE_NOT_ALLOWED, INVALID_ITEMS, INVALID_QUANTITY, PRODUCT_NOT_FOUND,
-- PRODUCT_NOT_IN_STOCK, INSUFFICIENT_STOCK.

-- Whether the calling user may work with a DPC (same rules as insert/delete).
create or replace function public._user_can_access_dpc(p_dpc text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from shopusers u
      join shops sh on sh.shopcode = p_dpc
     where u.userid = auth.uid()
       and (
            u.role = 'SuperAdmin'
         or (u.role = 'Admin' and sh.province_code is not distinct from u.province_code)
         or (u.role = 'User' and u.dpc_id = sh.shopcode)
       )
  );
$$;

-- Changes stock by p_delta (negative = sell, positive = return). Internal use only.
create or replace function public._adjust_stock(
  p_table text, p_product text, p_delta int, p_user text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows int;
  v_exists boolean;
begin
  if p_delta = 0 then
    return;
  end if;

  if p_delta > 0 then
    execute format(
      'insert into public.%I as s (productcode, productname, quantity, lastmodified, modifiedby)
       select p.productcode, p.productname, $1, now(), $2
         from public.products p
        where p.productcode = $3
       on conflict (productcode) do update
         set quantity = s.quantity + excluded.quantity,
             lastmodified = now(),
             modifiedby = excluded.modifiedby',
      p_table
    ) using p_delta, p_user, p_product;
    return;
  end if;

  execute format(
    'update public.%I
        set quantity = quantity + $1,
            lastmodified = now(),
            modifiedby = $2
      where productcode = $3
        and quantity + $1 >= 0',
    p_table
  ) using p_delta, p_user, p_product;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    execute format('select exists (select 1 from public.%I where productcode = $1)', p_table)
      into v_exists using p_product;
    if not v_exists then
      raise exception 'PRODUCT_NOT_IN_STOCK: %', p_product;
    end if;
    raise exception 'INSUFFICIENT_STOCK: %', p_product;
  end if;
end;
$$;

revoke all on function public._user_can_access_dpc(text) from public, anon;
revoke all on function public._adjust_stock(text, text, int, text) from public, anon, authenticated;
grant execute on function public._user_can_access_dpc(text) to authenticated;

create or replace function public.edit_sales_transaction(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_user_name text;
  v_receipt text := upper(trim(coalesce(payload->>'receiptno', '')));
  v_old_dpc text;
  v_old_date date;
  v_new_dpc text;
  v_old_table text;
  v_new_table text;
  v_distributor text;
  v_new_date date;
  v_old jsonb;
  v_item jsonb;
  v_line record;
  v_price double precision;
  v_bv double precision;
  v_receipt_key text;
  v_lastmod timestamp;
  v_expected timestamp;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select s.role, nullif(trim(s.firstname), '')
    into v_role, v_user_name
    from shopusers s
   where s.userid = v_uid;

  if v_role is null then
    raise exception 'NOT_AUTHORIZED';
  end if;
  v_user_name := coalesce(v_user_name, 'Unknown');

  -- Lock the receipt so concurrent edits or deletes are serialised.
  select h.receiptno, h.dpccode, h.salesdate::date, h.lastmodified
    into v_receipt_key, v_old_dpc, v_old_date, v_lastmod
    from salesheader h
   where upper(h.receiptno) = v_receipt
   for update;

  if not found then
    raise exception 'RECEIPT_NOT_FOUND';
  end if;

  -- Reject saves made from a page loaded before the receipt last changed.
  begin
    v_expected := nullif(payload->>'expected_lastmodified', '')::timestamp;
  exception when others then
    raise exception 'STALE_RECEIPT';
  end;
  if v_expected is distinct from v_lastmod then
    raise exception 'STALE_RECEIPT';
  end if;

  select sh.shopcode into v_old_dpc from shops sh where sh.shopcode = v_old_dpc;
  if v_old_dpc is null then
    raise exception 'INVALID_DPC';
  end if;

  select sh.shopcode into v_new_dpc
    from shops sh
   where sh.shopcode = trim(coalesce(payload->>'dpccode', ''));
  if v_new_dpc is null then
    raise exception 'INVALID_DPC';
  end if;

  if not public._user_can_access_dpc(v_old_dpc) or not public._user_can_access_dpc(v_new_dpc) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  v_old_table := v_old_dpc || '_STOCK';
  v_new_table := v_new_dpc || '_STOCK';
  if to_regclass(format('public.%I', v_old_table)) is null
     or to_regclass(format('public.%I', v_new_table)) is null then
    raise exception 'INVALID_DPC';
  end if;

  v_distributor := upper(trim(coalesce(payload->>'distributoridno', '')));
  if not exists (
    select 1 from "Distributors" d where upper(d."DistributorIDNO") = v_distributor
  ) then
    raise exception 'INVALID_DISTRIBUTOR';
  end if;

  begin
    v_new_date := left(trim(payload->>'salesdate'), 10)::date;
  exception when others then
    raise exception 'INVALID_DATE';
  end;

  -- Only a changed date is checked against the current-month rule for regular users.
  if v_role = 'User' and v_new_date is distinct from v_old_date and (
       v_new_date < date_trunc('month', current_date - 1)::date
    or v_new_date > (date_trunc('month', current_date + 1) + interval '1 month - 1 day')::date
  ) then
    raise exception 'DATE_NOT_ALLOWED';
  end if;

  if jsonb_typeof(payload->'items') is distinct from 'array'
     or jsonb_array_length(payload->'items') > 200 then
    raise exception 'INVALID_ITEMS';
  end if;

  -- Removing every line deletes the receipt and returns all stock.
  if jsonb_array_length(payload->'items') = 0 then
    perform public.delete_sales_transaction(v_receipt_key);
    return;
  end if;

  for v_item in select * from jsonb_array_elements(payload->'items') loop
    if jsonb_typeof(v_item->'quantity') is distinct from 'number'
       or (v_item->>'quantity')::numeric <> trunc((v_item->>'quantity')::numeric)
       or (v_item->>'quantity')::numeric < 1
       or (v_item->>'quantity')::numeric > 100000
       or nullif(trim(v_item->>'productcode'), '') is null then
      raise exception 'INVALID_QUANTITY';
    end if;
  end loop;

  -- Snapshot of the current lines (quantity and the price/BV originally charged).
  select coalesce(jsonb_object_agg(t.productcode,
           jsonb_build_object('qty', t.qty, 'price', t.price, 'bv', t.bv)), '{}'::jsonb)
    into v_old
    from (
      select d.productcode,
             sum(d.quantity)::int as qty,
             (array_agg(d.unitprice order by d.salesindex))[1] as price,
             (array_agg(d.unitbv order by d.salesindex))[1] as bv
        from salesdetails d
       where d.receiptno = v_receipt_key
       group by d.productcode
    ) t;

  -- Stock pass in sorted product order (same order as the sale and delete functions).
  for v_line in
    with n as (
      select trim(i->>'productcode') as pc, sum((i->>'quantity')::int)::int as qty
        from jsonb_array_elements(payload->'items') i
       group by 1
    ),
    o as (
      select e.key as pc, (e.value->>'qty')::int as qty from jsonb_each(v_old) e
    )
    select coalesce(o.pc, n.pc) as pc, coalesce(o.qty, 0) as oq, coalesce(n.qty, 0) as nq
      from o full join n on o.pc = n.pc
     order by 1
  loop
    if v_line.oq = 0 and not exists (
      select 1 from products p where p.productcode = v_line.pc and p.status = 'active'
    ) then
      raise exception 'PRODUCT_NOT_FOUND: %', v_line.pc;
    end if;

    if v_old_dpc = v_new_dpc then
      perform public._adjust_stock(v_new_table, v_line.pc, v_line.oq - v_line.nq, v_user_name);
    else
      perform public._adjust_stock(v_old_table, v_line.pc, v_line.oq, v_user_name);
      perform public._adjust_stock(v_new_table, v_line.pc, -v_line.nq, v_user_name);
    end if;
  end loop;

  delete from salesdetails where receiptno = v_receipt_key;

  for v_line in
    select trim(i->>'productcode') as pc, sum((i->>'quantity')::int)::int as qty
      from jsonb_array_elements(payload->'items') i
     group by 1
     order by 1
  loop
    if v_old ? v_line.pc then
      v_price := (v_old->v_line.pc->>'price')::double precision;
      v_bv := (v_old->v_line.pc->>'bv')::double precision;
    else
      select p.distributorprice, p.bvs into v_price, v_bv
        from products p where p.productcode = v_line.pc;
      if v_price is null or v_bv is null then
        raise exception 'PRODUCT_NOT_FOUND: %', v_line.pc;
      end if;
    end if;

    insert into salesdetails (receiptno, productcode, unitprice, unitbv, quantity)
    values (v_receipt_key, v_line.pc, v_price, v_bv, v_line.qty);
  end loop;

  update salesheader
     set distributoridno = v_distributor,
         dpccode = v_new_dpc,
         salesdate = v_new_date::timestamp,
         lastmodified = now(),
         lastmodifiedby = v_user_name
   where receiptno = v_receipt_key;
end;
$$;

revoke all on function public.edit_sales_transaction(jsonb) from public, anon;
grant execute on function public.edit_sales_transaction(jsonb) to authenticated;

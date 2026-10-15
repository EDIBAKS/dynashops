-- Hardened, atomic sale insertion.
-- Caller identity, DPC access, prices and stock are all decided on the server.
-- Errors use stable message codes: NOT_AUTHENTICATED, NOT_AUTHORIZED, INVALID_DPC,
-- INVALID_RECEIPT, RECEIPT_EXISTS, INVALID_DISTRIBUTOR, INVALID_DATE, DATE_NOT_ALLOWED,
-- INVALID_ITEMS, INVALID_QUANTITY, PRODUCT_NOT_FOUND, PRODUCT_NOT_IN_STOCK,
-- INSUFFICIENT_STOCK.

create or replace function public.insert_sales_transaction(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_user_dpc text;
  v_user_province text;
  v_user_name text;
  v_dpc text;
  v_shop_province text;
  v_stock_table text;
  v_receipt text;
  v_distributor text;
  v_salesdate date;
  v_item jsonb;
  v_line record;
  v_rows int;
  v_exists boolean;
  v_raw_dpc text := trim(coalesce(payload->>'dpccode', ''));
  v_lines int := 0;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select s.role, s.dpc_id, s.province_code, nullif(trim(s.firstname), '')
    into v_role, v_user_dpc, v_user_province, v_user_name
    from shopusers s
   where s.userid = v_uid;

  if v_role is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  -- DPC must be a real shop; use the stored shopcode as the canonical value.
  select sh.shopcode, sh.province_code
    into v_dpc, v_shop_province
    from shops sh
   where sh.shopcode = v_raw_dpc;

  if v_dpc is null then
    raise exception 'INVALID_DPC';
  end if;

  if not (
       v_role = 'SuperAdmin'
    or (v_role = 'Admin' and v_shop_province is not distinct from v_user_province)
    or (v_role = 'User' and v_dpc = v_user_dpc)
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  v_stock_table := v_dpc || '_STOCK';
  if to_regclass(format('public.%I', v_stock_table)) is null then
    raise exception 'INVALID_DPC';
  end if;

  v_receipt := upper(trim(coalesce(payload->>'receiptno', '')));
  if v_receipt = '' or v_receipt = upper(v_dpc) or length(v_receipt) > 20 then
    raise exception 'INVALID_RECEIPT';
  end if;

  v_distributor := upper(trim(coalesce(payload->>'distributoridno', '')));
  if not exists (
    select 1 from "Distributors" d where upper(d."DistributorIDNO") = v_distributor
  ) then
    raise exception 'INVALID_DISTRIBUTOR';
  end if;

  begin
    v_salesdate := left(trim(payload->>'salesdate'), 10)::date;
  exception when others then
    raise exception 'INVALID_DATE';
  end;

  -- Regular users may only record sales in the current month (1-day tolerance for timezones).
  if v_role = 'User' and (
       v_salesdate < date_trunc('month', current_date - 1)::date
    or v_salesdate > (date_trunc('month', current_date + 1) + interval '1 month - 1 day')::date
  ) then
    raise exception 'DATE_NOT_ALLOWED';
  end if;

  if jsonb_typeof(payload->'items') is distinct from 'array'
     or jsonb_array_length(payload->'items') = 0
     or jsonb_array_length(payload->'items') > 200 then
    raise exception 'INVALID_ITEMS';
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

  begin
    insert into salesheader (
      receiptno, distributoridno, salesdate, datecreated, createdby,
      lastmodified, lastmodifiedby, dpccode, entrysource, entered_by
    ) values (
      v_receipt, v_distributor, v_salesdate::timestamp, now(), coalesce(v_user_name, 'Unknown'),
      now(), coalesce(v_user_name, 'Unknown'), v_dpc,
      coalesce(left(nullif(trim(payload->>'entrysource'), ''), 4), 'app'), v_uid
    );
  exception when unique_violation then
    raise exception 'RECEIPT_EXISTS';
  end;

  -- Merge duplicate products and lock stock rows in a fixed order to avoid deadlocks.
  for v_line in
    select trim(i->>'productcode') as productcode,
           sum((i->>'quantity')::int)::int as qty
      from jsonb_array_elements(payload->'items') i
     group by 1
     order by 1
  loop
    v_lines := v_lines + 1;

    declare
      v_price double precision;
      v_bv double precision;
    begin
      select p.distributorprice, p.bvs
        into v_price, v_bv
        from products p
       where p.productcode = v_line.productcode
         and p.status = 'active';

      if not found or v_price is null or v_bv is null then
        raise exception 'PRODUCT_NOT_FOUND: %', v_line.productcode;
      end if;

      execute format(
        'update public.%I
            set quantity = quantity - $1,
                lastmodified = now(),
                modifiedby = $2
          where productcode = $3
            and quantity >= $1',
        v_stock_table
      ) using v_line.qty, coalesce(v_user_name, 'Unknown'), v_line.productcode;

      get diagnostics v_rows = row_count;

      if v_rows <> 1 then
        execute format('select exists (select 1 from public.%I where productcode = $1)', v_stock_table)
          into v_exists using v_line.productcode;
        if not v_exists then
          raise exception 'PRODUCT_NOT_IN_STOCK: %', v_line.productcode;
        end if;
        raise exception 'INSUFFICIENT_STOCK: %', v_line.productcode;
      end if;

      insert into salesdetails (receiptno, productcode, unitprice, unitbv, quantity)
      values (v_receipt, v_line.productcode, v_price, v_bv, v_line.qty);
    end;
  end loop;
end;
$$;

revoke all on function public.insert_sales_transaction(jsonb) from public, anon;
grant execute on function public.insert_sales_transaction(jsonb) to authenticated;

-- Atomic receipt deletion: returns every sold quantity to the receipt's own <DPC>_STOCK
-- table, then removes the details and header, all in one transaction.
-- Errors: NOT_AUTHENTICATED, NOT_AUTHORIZED, INVALID_DPC, RECEIPT_NOT_FOUND.

create or replace function public.delete_sales_transaction(p_receiptno text)
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
  v_receipt text := upper(trim(coalesce(p_receiptno, '')));
  v_dpc text;
  v_shop_province text;
  v_stock_table text;
  v_line record;
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

  -- Locking the header serialises concurrent deletes, so stock can never be restored twice.
  select h.dpccode
    into v_dpc
    from salesheader h
   where upper(h.receiptno) = v_receipt
   for update;

  if not found then
    raise exception 'RECEIPT_NOT_FOUND';
  end if;

  select sh.shopcode, sh.province_code
    into v_dpc, v_shop_province
    from shops sh
   where sh.shopcode = v_dpc;

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

  -- Sorted order keeps lock ordering consistent with insert_sales_transaction.
  for v_line in
    select d.productcode, sum(d.quantity)::int as qty
      from salesdetails d
     where upper(d.receiptno) = v_receipt
     group by d.productcode
     order by d.productcode
  loop
    execute format(
      'insert into public.%I as s (productcode, productname, quantity, lastmodified, modifiedby)
       select p.productcode, p.productname, $1, now(), $2
         from public.products p
        where p.productcode = $3
       on conflict (productcode) do update
         set quantity = s.quantity + excluded.quantity,
             lastmodified = now(),
             modifiedby = excluded.modifiedby',
      v_stock_table
    ) using v_line.qty, coalesce(v_user_name, 'Unknown'), v_line.productcode;
  end loop;

  delete from salesdetails where upper(receiptno) = v_receipt;
  delete from salesheader where upper(receiptno) = v_receipt;
end;
$$;

revoke all on function public.delete_sales_transaction(text) from public, anon;
grant execute on function public.delete_sales_transaction(text) to authenticated;

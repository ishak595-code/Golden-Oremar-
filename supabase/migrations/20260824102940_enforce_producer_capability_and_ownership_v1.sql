do $$
declare r record; fn_oid oid; old_def text; new_def text;
begin
  for r in select * from (values
    ('private.producer_archive_product_v1(text)','product.archive'),
    ('private.producer_upsert_product_v1(text,jsonb)','product.update'),
    ('private.list_my_producer_orders_v1(text,integer,integer)','order.read'),
    ('private.get_my_producer_order_detail_v1(uuid)','order.read'),
    ('private.producer_mark_order_items_processing_v1(uuid,uuid[])','order.manage'),
    ('private.producer_create_shipment_v1(uuid,jsonb,text,text,text,timestamp with time zone)','order.manage'),
    ('private.get_my_producer_finance_summary_v1()','finance.read'),
    ('private.list_my_producer_payouts_v2(integer,integer)','payout.read'),
    ('private.request_my_producer_payout_v2(text,bigint,text)','payout.request'),
    ('private.cancel_my_producer_payout_v2(uuid)','payout.request'),
    ('private.get_my_producer_payment_identity_v1()','finance.read'),
    ('private.list_my_producer_event_submissions_v1()','event.read'),
    ('private.producer_upsert_event_submission_v1(uuid,jsonb)','event.manage')
  ) m(regproc_name,permission_key)
  loop
    fn_oid:=to_regprocedure(r.regproc_name);
    if fn_oid is null then raise exception 'producer capability function missing: %',r.regproc_name; end if;
    old_def:=pg_get_functiondef(fn_oid);
    if old_def like '%'||format('private.has_permission(%L)',r.permission_key)||'%' then continue; end if;
    new_def:=replace(old_def,
      $old$if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;$old$,
      format($fmt$if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if; if not private.has_permission(%L) then raise exception 'permission_required:%s' using errcode='42501'; end if;$fmt$,r.permission_key,r.permission_key));
    if new_def=old_def then
      new_def:=replace(old_def,
        $old$if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;$old$,
        format($fmt$if uid is null then raise exception 'authentication_required' using errcode='42501'; end if; if not private.has_permission(%L) then raise exception 'permission_required:%s' using errcode='42501'; end if;$fmt$,r.permission_key,r.permission_key));
    end if;
    if new_def=old_def then raise exception 'producer authentication guard not found: %',r.regproc_name; end if;
    new_def:=replace(new_def,'coalesce(private.is_admin(),false)','coalesce(private.has_permission(''admin.access''),false)');
    new_def:=replace(new_def,'coalesce(private.is_admin(), false)','coalesce(private.has_permission(''admin.access''),false)');
    execute new_def;
  end loop;
end $$;
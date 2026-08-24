do $$
declare r text; fn_oid oid; old_def text; new_def text;
begin
  foreach r in array array[
    'private.producer_save_product_batch_v1(uuid,text,uuid,text,date,date,date,date,text,text,text,text,numeric,numeric,text,numeric,text,text)',
    'private.producer_add_product_batch_event_v1(uuid,text,timestamp with time zone,text,text,text)',
    'private.producer_set_product_batch_certification_v1(uuid,uuid,boolean)',
    'private.producer_submit_product_batch_v1(uuid)'
  ] loop
    fn_oid:=to_regprocedure(r); old_def:=pg_get_functiondef(fn_oid);
    new_def:=replace(old_def,
      $old$if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;$old$,
      $new$if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if; if not private.has_permission('product.update') then raise exception 'permission_required:product.update' using errcode='42501'; end if;$new$);
    if new_def=old_def then raise exception 'traceability capability guard not found: %',r; end if;
    execute new_def;
  end loop;
end $$;
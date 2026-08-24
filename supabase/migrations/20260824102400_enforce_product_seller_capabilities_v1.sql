do $$
declare r text; fn_oid oid; old_def text; new_def text;
begin
  foreach r in array array[
    'private.admin_review_product_v1(uuid,boolean,text)',
    'private.admin_review_product_v2(uuid,boolean,text)',
    'private.admin_review_product_v3(uuid,boolean,text,boolean,boolean,boolean,boolean)',
    'private.admin_review_product_v4(uuid,boolean,text,boolean,boolean,boolean,boolean)',
    'private.admin_review_product_change_v1(uuid,boolean,text)',
    'private.admin_review_product_change_v2(uuid,boolean,text,boolean,boolean,boolean,boolean)',
    'private.admin_review_product_change_v3(uuid,boolean,text,boolean,boolean,boolean,boolean)'
  ] loop
    fn_oid:=to_regprocedure(r); old_def:=pg_get_functiondef(fn_oid);
    new_def:=replace(old_def,'coalesce(private.is_admin(),false)','coalesce(private.has_permission(''product.moderate''),false)');
    new_def:=replace(new_def,'coalesce(private.is_admin(), false)','coalesce(private.has_permission(''product.moderate''),false)');
    new_def:=replace(new_def,'private.is_admin()','private.has_permission(''product.moderate'')');
    new_def:=replace(new_def,'private.management_upsert_product_v1(','private.management_upsert_product_core_v1(');
    if new_def=old_def then raise exception 'product moderation guard mismatch: %',r; end if;
    execute new_def;
  end loop;

  old_def:=pg_get_functiondef('private.admin_review_product_v4(uuid,boolean,text,boolean,boolean,boolean,boolean)'::regprocedure);
  new_def:=replace(old_def,
    'if caller_id is null or not coalesce(private.has_permission(''product.moderate''),false) then raise exception ''admin_required'' using errcode=''42501''; end if;',
    'if caller_id is null or not coalesce(private.has_permission(''product.moderate''),false) then raise exception ''permission_required:product.moderate'' using errcode=''42501''; end if; if coalesce(p_approve,false) and not private.has_permission(''product.approve'') then raise exception ''permission_required:product.approve'' using errcode=''42501''; end if; if not coalesce(p_approve,false) and not private.has_permission(''product.reject'') then raise exception ''permission_required:product.reject'' using errcode=''42501''; end if;');
  if new_def=old_def then raise exception 'product v4 decision guard insertion failed'; end if; execute new_def;

  old_def:=pg_get_functiondef('private.admin_review_product_change_v3(uuid,boolean,text,boolean,boolean,boolean,boolean)'::regprocedure);
  new_def:=replace(old_def,
    'if caller_id is null or not coalesce(private.has_permission(''product.moderate''),false) then raise exception ''admin_required'' using errcode=''42501''; end if;',
    'if caller_id is null or not coalesce(private.has_permission(''product.moderate''),false) then raise exception ''permission_required:product.moderate'' using errcode=''42501''; end if; if coalesce(p_approve,false) and not private.has_permission(''product.approve'') then raise exception ''permission_required:product.approve'' using errcode=''42501''; end if; if not coalesce(p_approve,false) and not private.has_permission(''product.reject'') then raise exception ''permission_required:product.reject'' using errcode=''42501''; end if;');
  if new_def=old_def then raise exception 'product change v3 decision guard insertion failed'; end if; execute new_def;
end $$;

do $$
declare r text; fn_oid oid; old_def text; new_def text;
begin
  foreach r in array array[
    'public.admin_review_producer_application(uuid,text,text,integer)',
    'public.admin_review_producer_application_v2(uuid,text,text,integer)',
    'private.admin_review_producer_application_v3(uuid,text,text,integer)'
  ] loop
    fn_oid:=to_regprocedure(r); old_def:=pg_get_functiondef(fn_oid);
    new_def:=replace(old_def,'coalesce(private.is_admin(), false)','coalesce(private.has_permission(''seller.review''),false)');
    new_def:=replace(new_def,'coalesce(private.is_admin(),false)','coalesce(private.has_permission(''seller.review''),false)');
    if new_def=old_def then raise exception 'seller review guard mismatch: %',r; end if;
    execute new_def;
  end loop;

  old_def:=pg_get_functiondef('private.admin_review_producer_application_v3(uuid,text,text,integer)'::regprocedure);
  new_def:=replace(old_def,
    'if caller_id is null or not coalesce(private.has_permission(''seller.review''),false) then raise exception ''admin_required'' using errcode=''42501''; end if;',
    'if caller_id is null or not coalesce(private.has_permission(''seller.review''),false) then raise exception ''permission_required:seller.review'' using errcode=''42501''; end if; if p_status=''approved'' and not private.has_permission(''seller.approve'') then raise exception ''permission_required:seller.approve'' using errcode=''42501''; end if; if p_status=''rejected'' and not private.has_permission(''seller.reject'') then raise exception ''permission_required:seller.reject'' using errcode=''42501''; elsif p_status=''needs_information'' and not private.has_permission(''seller.request_information'') then raise exception ''permission_required:seller.request_information'' using errcode=''42501''; end if;');
  if new_def=old_def then raise exception 'seller decision capability insertion failed'; end if; execute new_def;
end $$;

do $$
declare old_def text; new_def text;
begin
  old_def:=pg_get_functiondef('private.admin_set_producer_status_v1(uuid,text,text)'::regprocedure);
  new_def:=replace(old_def,
    'if caller_id is null or not coalesce(private.is_admin(),false) then raise exception ''admin_required'' using errcode=''42501''; end if;',
    'if caller_id is null then raise exception ''authentication_required'' using errcode=''42501''; end if; if p_status=''suspended'' and not private.has_permission(''seller.suspend'') then raise exception ''permission_required:seller.suspend'' using errcode=''42501''; end if; if p_status=''active'' and not private.has_permission(''seller.restore'') then raise exception ''permission_required:seller.restore'' using errcode=''42501''; end if;');
  if new_def=old_def then raise exception 'producer status capability rewrite failed'; end if; execute new_def;
end $$;

do $$
declare old_def text; new_def text;
begin
  old_def:=pg_get_functiondef('private.admin_get_producer_application_sensitive_v3(uuid,text)'::regprocedure);
  new_def:=replace(old_def,$old$if caller_id is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;$old$,$new$if caller_id is null or not coalesce(private.has_permission('seller.sensitive_read'),false) then raise exception 'permission_required:seller.sensitive_read' using errcode='42501'; end if;$new$);
  if new_def=old_def then raise exception 'seller sensitive capability rewrite failed'; end if; execute new_def;
end $$;
do $$
declare r text; fn_oid oid; old_def text; new_def text;
begin
  foreach r in array array['private.admin_operations_overview_v1()','private.admin_operations_overview_v2()'] loop
    fn_oid:=to_regprocedure(r);
    old_def:=pg_get_functiondef(fn_oid);
    new_def:=replace(old_def,$q$private.has_permission('finance.read')$q$,$q$private.has_permission('analytics.read')$q$);
    if new_def=old_def then raise exception 'dashboard analytics capability rewrite failed: %',r; end if;
    execute new_def;
  end loop;
end $$;
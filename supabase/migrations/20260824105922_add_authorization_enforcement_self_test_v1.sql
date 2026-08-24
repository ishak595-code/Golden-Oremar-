create or replace function private.authorization_function_mentions_v1(p_signature text,p_needles text[])
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare fn_oid oid; definition text; needle text;
begin
  fn_oid:=to_regprocedure(p_signature);
  if fn_oid is null then return false; end if;
  definition:=pg_get_functiondef(fn_oid);
  foreach needle in array p_needles loop
    if position(needle in definition)=0 then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function public.authorization_enforcement_self_test_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  policy jsonb;
  checks jsonb;
  ok boolean;
begin
  policy:=public.authorization_policy_self_test_v1();
  checks:=jsonb_build_object(
    'policyMatrix',coalesce((policy->>'ok')::boolean,false),
    'roleGovernance',private.authorization_function_mentions_v1('private.admin_set_platform_user_role_v2(uuid,text,text)',array['role.manage','cannot_change_current_user_role']),
    'refundExecution',private.authorization_function_mentions_v1('private.admin_record_manual_refund_v1(uuid,uuid,text,bigint,text)',array['refund.execute']),
    'payoutSeparation',private.authorization_function_mentions_v1('private.admin_update_producer_payout_v1(uuid,text,text,text,text)',array['payout.review','payout.release']),
    'productModeration',private.authorization_function_mentions_v1('private.admin_review_product_v4(uuid,boolean,text,boolean,boolean,boolean,boolean)',array['product.moderate','product.approve','product.reject']),
    'sellerReview',private.authorization_function_mentions_v1('private.admin_review_producer_application_v3(uuid,text,text,integer)',array['seller.review','seller.approve','seller.reject','seller.request_information']),
    'producerOwnership',private.authorization_function_mentions_v1('private.producer_archive_product_v1(text)',array['product.archive','product.producer_id=caller_producer_id','product_access_denied']),
    'settlementRelease',private.authorization_function_mentions_v1('private.prepare_order_settlement_for_service_v1(uuid,uuid)',array['user_has_permission_v1','payout.release']),
    'adminShell',private.authorization_function_mentions_v1('private.admin_session_status_impl_v1()',array['admin.access','moderator','support']),
    'dashboardAnalytics',private.authorization_function_mentions_v1('private.admin_operations_overview_v2()',array['analytics.read']),
    'breakGlassServiceOnly',private.authorization_function_mentions_v1('private.bootstrap_super_admin_v1(uuid,text)',array['service_role','active_super_admin_count_v1']),
    'lastSuperAdminTrigger',exists(select 1 from pg_trigger where tgrelid='private.user_roles'::regclass and tgname='protect_last_super_admin_role_v1' and not tgisinternal),
    'legacyReviewWriteRevoked',not has_function_privilege('authenticated','public.admin_set_review_status(uuid,text)','EXECUTE'),
    'activeSuperAdminPresent',private.active_super_admin_count_v1()>=1
  );
  select bool_and((entry.value)::text='true') into ok from jsonb_each(checks) entry;
  return jsonb_build_object('ok',coalesce(ok,false),'checks',checks,'policy',policy);
end;
$$;

revoke all on function private.authorization_function_mentions_v1(text,text[]) from public,anon,authenticated;
revoke all on function public.authorization_enforcement_self_test_v1() from public,anon;
grant execute on function public.authorization_enforcement_self_test_v1() to authenticated,service_role;
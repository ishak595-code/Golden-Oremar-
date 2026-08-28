-- Golden Oremar Home readiness v4
-- Keep operational blocker details in the control plane while exposing concise customer-safe availability copy.

create or replace function private.home_sales_readiness_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  legal jsonb:=private.commercial_checkout_legal_readiness_v1();
  payment jsonb:=private.get_checkout_payment_readiness_v3();
  legal_ready boolean:=coalesce((legal->>'ready')::boolean,false);
  live_payments boolean:=coalesce((payment->>'liveCardPaymentsEnabled')::boolean,false);
  provider_configuration_required boolean:=coalesce((payment->>'requiresProviderConfiguration')::boolean,true);
begin
  if not legal_ready then
    return jsonb_build_object(
      'status','blocked_pending_business_identity',
      'message','Katalog görüntülenebilir; sipariş tamamlama hizmeti şu anda kullanıma kapalıdır.'
    );
  end if;

  if not live_payments then
    return jsonb_build_object(
      'status',case when provider_configuration_required then 'blocked_pending_payment_provider_configuration' else 'blocked_pending_live_payment_enablement' end,
      'message','Katalog görüntülenebilir; ödeme ile sipariş tamamlama şu anda kullanıma kapalıdır.'
    );
  end if;

  return jsonb_build_object(
    'status','ready',
    'message','Sipariş ve ödeme hizmetleri kullanıma hazır.'
  );
end;
$function$;

revoke all on function private.home_sales_readiness_v1() from public,anon,authenticated;
grant execute on function private.home_sales_readiness_v1() to service_role;

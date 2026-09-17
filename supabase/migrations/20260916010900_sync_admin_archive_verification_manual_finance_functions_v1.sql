-- Drift closure: admin user archival (with super-admin escalation guard),
-- producer document and phone verification, and manual payment/refund recording
-- which delegate to the verified payment/refund appliers.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION private.admin_archive_platform_user_v1(p_user_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  normalized_reason text := btrim(coalesce(p_reason, ''));
  caller_is_super_admin boolean;
  target_is_super_admin boolean;
begin
  if caller_id is null or not coalesce(private.has_permission('user.erase'),false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_user_id is null or char_length(normalized_reason) not between 8 and 500 then
    raise exception 'archive_reason_required' using errcode = '22023';
  end if;
  if p_user_id = caller_id then
    raise exception 'cannot_archive_current_user' using errcode = '42501';
  end if;

  caller_is_super_admin := coalesce(private.has_permission('role.manage'), false);
  select exists (
    select 1
    from private.user_roles role
    where role.user_id = p_user_id
      and role.role = 'super_admin'
      and (role.expires_at is null or role.expires_at > timezone('utc', now()))
  ) into target_is_super_admin;
  if target_is_super_admin and not caller_is_super_admin then
    raise exception 'super_admin_required' using errcode = '42501';
  end if;

  update public.profiles
  set status = 'deleted',
      deleted_at = timezone('utc', now()),
      marketing_consent = false,
      marketing_consent_at = null
  where id = p_user_id;

  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  delete from private.user_roles
  where user_id = p_user_id
    and role <> 'customer';

  update public.producers
  set status = 'suspended'
  where owner_user_id = p_user_id
    and status = 'active'
    and deleted_at is null;

  return jsonb_build_object(
    'id', p_user_id,
    'status', 'deleted',
    'reason', normalized_reason,
    'archivedAt', timezone('utc', now())
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_record_manual_payment_v1(p_order_id uuid, p_provider_reference text, p_payment_method_type text, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  target_order public.orders%rowtype;
begin
  if caller_id is null or not coalesce(private.has_permission('finance.manage'),false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  select * into target_order from public.orders where id=p_order_id;
  if target_order.id is null then raise exception 'order_not_found' using errcode='P0002'; end if;

  if lower(btrim(coalesce(p_payment_method_type,''))) not in ('bank_transfer','cash_on_delivery','other') then
    raise exception 'manual_payment_method_not_allowed' using errcode='22023';
  end if;
  if lower(btrim(coalesce(p_status,''))) not in ('authorized','captured','failed','cancelled') then
    raise exception 'invalid_manual_payment_status' using errcode='22023';
  end if;

  return private.apply_verified_payment_v1(
    target_order.id,
    'manual',
    p_provider_reference,
    p_payment_method_type,
    target_order.total_minor,
    target_order.currency,
    p_status,
    caller_id
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_record_manual_refund_v1(p_return_id uuid, p_payment_id uuid, p_provider_reference text, p_amount_minor bigint, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  payment public.payment_records%rowtype;
begin
  if caller_id is null or not private.has_permission('refund.execute') then raise exception 'permission_required:refund.execute' using errcode='42501'; end if;
  select * into payment from public.payment_records where id=p_payment_id;
  if payment.id is null then raise exception 'payment_not_found' using errcode='P0002'; end if;
  return private.apply_verified_refund_v1(p_return_id,p_payment_id,'manual',p_provider_reference,p_amount_minor,payment.currency,p_status,caller_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_set_producer_document_status(p_document_id uuid, p_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not coalesce(private.has_permission('seller.review'),false) then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_status not in ('pending', 'verified', 'rejected') then raise exception 'invalid_producer_document_status' using errcode = '22023'; end if;
  update private.producer_documents
  set verification_status = p_status,
      verified_by = case when p_status in ('verified', 'rejected') then caller_id else null end,
      verified_at = case when p_status in ('verified', 'rejected') then timezone('utc', now()) else null end
  where id = p_document_id;
  if not found then raise exception 'producer_document_not_found' using errcode = 'P0002'; end if;
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_set_producer_phone_verified(p_application_id uuid, p_verified boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not coalesce(private.has_permission('seller.review'),false) then raise exception 'admin_required' using errcode = '42501'; end if;
  update private.producer_application_kyc kyc
  set phone_verified_at = case when p_verified then timezone('utc', now()) else null end,
      phone_verified_by = case when p_verified then caller_id else null end
  where kyc.application_id = p_application_id;
  if not found then raise exception 'producer_application_not_found' using errcode = 'P0002'; end if;
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_archive_platform_user_v1(p_user_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.admin_archive_platform_user_v1(p_user_id, p_reason);
$function$
;

CREATE OR REPLACE FUNCTION public.admin_record_manual_payment_v1(p_order_id uuid, p_provider_reference text, p_payment_method_type text, p_status text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.admin_record_manual_payment_v1(p_order_id,p_provider_reference,p_payment_method_type,p_status); $function$
;

CREATE OR REPLACE FUNCTION public.admin_record_manual_refund_v1(p_return_id uuid, p_payment_id uuid, p_provider_reference text, p_amount_minor bigint, p_status text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.admin_record_manual_refund_v1(p_return_id,p_payment_id,p_provider_reference,p_amount_minor,p_status); $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_producer_document_status(p_document_id uuid, p_status text)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.admin_set_producer_document_status(p_document_id, p_status);
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_producer_phone_verified(p_application_id uuid, p_verified boolean)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.admin_set_producer_phone_verified(p_application_id, p_verified);
$function$
;

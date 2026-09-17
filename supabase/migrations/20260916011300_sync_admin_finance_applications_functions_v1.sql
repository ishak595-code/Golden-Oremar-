-- Drift closure: admin finance report (daily sales series plus per-producer
-- commission and estimated payout), producer application listings v1/v2 with
-- KYC fields decrypted and masked at read time, and the v2 application review
-- which enforces verification prerequisites before approval.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION public.admin_finance_report(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  result jsonb;
begin
  if not coalesce(private.has_permission('finance.read'),false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid_finance_date_range' using errcode = '22023';
  end if;

  with date_series as (
    select day::date as report_date
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') day
  ),
  daily_orders as (
    select
      timezone('utc', coalesce(customer_order.placed_at, customer_order.created_at))::date as report_date,
      count(*)::integer as order_count,
      sum(customer_order.total_minor)::bigint as gross_sales_minor
    from public.orders customer_order
    where timezone('utc', coalesce(customer_order.placed_at, customer_order.created_at))::date between p_from and p_to
      and customer_order.currency = 'TRY'
      and customer_order.payment_status in ('paid', 'partially_refunded', 'refunded')
      and customer_order.status <> 'cancelled'
    group by 1
  ),
  daily_refunds as (
    select
      timezone('utc', refund.created_at)::date as report_date,
      sum(refund.amount_minor)::bigint as refund_minor
    from public.refunds refund
    where timezone('utc', refund.created_at)::date between p_from and p_to
      and refund.currency = 'TRY'
      and refund.status = 'succeeded'
    group by 1
  ),
  daily as (
    select
      date_series.report_date,
      coalesce(daily_orders.order_count, 0) as order_count,
      coalesce(daily_orders.gross_sales_minor, 0) as gross_sales_minor,
      coalesce(daily_refunds.refund_minor, 0) as refund_minor,
      coalesce(daily_orders.gross_sales_minor, 0) - coalesce(daily_refunds.refund_minor, 0) as net_sales_minor
    from date_series
    left join daily_orders using (report_date)
    left join daily_refunds using (report_date)
  ),
  vendor_income as (
    select
      producer.id as producer_id,
      producer.display_name as vendor_name,
      count(distinct customer_order.id)::integer as order_count,
      sum(order_item.line_total_minor)::bigint as gross_sales_minor,
      round(sum(order_item.line_total_minor * producer.commission_basis_points / 10000.0))::bigint as commission_minor,
      sum(order_item.line_total_minor)::bigint
        - round(sum(order_item.line_total_minor * producer.commission_basis_points / 10000.0))::bigint
        as estimated_payout_minor
    from public.order_items order_item
    join public.orders customer_order on customer_order.id = order_item.order_id
    join public.producers producer on producer.id = order_item.producer_id
    where timezone('utc', coalesce(customer_order.placed_at, customer_order.created_at))::date between p_from and p_to
      and customer_order.currency = 'TRY'
      and customer_order.payment_status in ('paid', 'partially_refunded', 'refunded')
      and customer_order.status <> 'cancelled'
    group by producer.id, producer.display_name
  )
  select jsonb_build_object(
    'currency', 'TRY',
    'from', p_from,
    'to', p_to,
    'totals', jsonb_build_object(
      'order_count', coalesce((select sum(order_count) from daily), 0),
      'gross_sales_minor', coalesce((select sum(gross_sales_minor) from daily), 0),
      'refund_minor', coalesce((select sum(refund_minor) from daily), 0),
      'net_sales_minor', coalesce((select sum(net_sales_minor) from daily), 0),
      'commission_minor', coalesce((select sum(commission_minor) from vendor_income), 0),
      'estimated_payout_minor', coalesce((select sum(estimated_payout_minor) from vendor_income), 0)
    ),
    'daily_sales', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'date', report_date,
            'order_count', order_count,
            'gross_sales_minor', gross_sales_minor,
            'refund_minor', refund_minor,
            'net_sales_minor', net_sales_minor
          )
          order by report_date
        )
        from daily
      ),
      '[]'::jsonb
    ),
    'vendor_income', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'producer_id', producer_id,
            'vendor_name', vendor_name,
            'order_count', order_count,
            'gross_sales_minor', gross_sales_minor,
            'commission_minor', commission_minor,
            'estimated_payout_minor', estimated_payout_minor
          )
          order by gross_sales_minor desc, vendor_name
        )
        from vendor_income
      ),
      '[]'::jsonb
    )
  )
  into result;

  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_list_producer_applications()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  result jsonb;
begin
  if not coalesce(private.has_permission('seller.read'),false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', application.id,
        'applicant_user_id', application.applicant_user_id,
        'applicant_type', application.applicant_type,
        'brand_name', application.brand_name,
        'public_name', application.public_name,
        'description', application.description,
        'production_location', application.production_location,
        'product_categories', application.product_categories,
        'status', application.status,
        'submitted_at', application.submitted_at,
        'reviewed_at', application.reviewed_at,
        'rejection_reason', application.rejection_reason,
        'created_at', application.created_at,
        'updated_at', application.updated_at,
        'email', coalesce(kyc.contact_email, auth_user.email, ''),
        'legal_name', kyc.legal_name,
        'phone', kyc.phone,
        'address', kyc.address,
        'tax_office', kyc.tax_office,
        'identifier_masked', case
          when application.applicant_type = 'individual' then
            '*******' || right(coalesce(private.decrypt_producer_kyc(kyc.national_id_ciphertext), ''), 4)
          else
            '******' || right(coalesce(private.decrypt_producer_kyc(kyc.tax_number_ciphertext), ''), 4)
        end,
        'iban_masked', case
          when kyc.iban_ciphertext is null then null
          else left(private.decrypt_producer_kyc(kyc.iban_ciphertext), 4)
            || ' •••• •••• •••• '
            || right(private.decrypt_producer_kyc(kyc.iban_ciphertext), 4)
        end,
        'documents', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', document.id,
                'document_type', document.document_type,
                'storage_path', document.storage_path,
                'mime_type', document.mime_type,
                'size_bytes', document.size_bytes,
                'verification_status', document.verification_status,
                'verified_at', document.verified_at,
                'created_at', document.created_at
              )
              order by document.created_at
            )
            from private.producer_documents document
            where document.application_id = application.id
          ),
          '[]'::jsonb
        )
      )
      order by coalesce(application.submitted_at, application.created_at) desc
    ),
    '[]'::jsonb
  )
  into result
  from public.producer_applications application
  left join private.producer_application_kyc kyc on kyc.application_id = application.id
  left join auth.users auth_user on auth_user.id = application.applicant_user_id;

  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_list_producer_applications_v2()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
  if not coalesce(private.has_permission('seller.read'),false) then raise exception 'admin_required' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', application.id, 'applicant_user_id', application.applicant_user_id,
    'applicant_type', application.applicant_type, 'seller_classification', application.seller_classification,
    'brand_name', application.brand_name, 'public_name', application.public_name,
    'description', application.description, 'production_location', application.production_location,
    'product_categories', application.product_categories, 'food_compliance_status', application.food_compliance_status,
    'fulfillment_methods', application.fulfillment_methods, 'average_dispatch_days', application.average_dispatch_days,
    'cold_chain_capable', application.cold_chain_capable, 'status', application.status,
    'submitted_at', application.submitted_at, 'reviewed_at', application.reviewed_at,
    'rejection_reason', application.rejection_reason, 'created_at', application.created_at, 'updated_at', application.updated_at,
    'email', coalesce(kyc.contact_email, auth_user.email, ''), 'legal_name', kyc.legal_name,
    'phone', kyc.phone, 'phone_verified_at', kyc.phone_verified_at,
    'contact_email_verified_at', kyc.contact_email_verified_at, 'address', kyc.address, 'tax_office', kyc.tax_office,
    'identifier_masked', case when application.applicant_type = 'individual' then '*******' || right(coalesce(private.decrypt_producer_kyc(kyc.national_id_ciphertext), ''), 4) else '******' || right(coalesce(private.decrypt_producer_kyc(kyc.tax_number_ciphertext), ''), 4) end,
    'mersis_masked', case when kyc.mersis_number_ciphertext is null then null else '************' || right(private.decrypt_producer_kyc(kyc.mersis_number_ciphertext), 4) end,
    'food_registration_masked', case when kyc.food_registration_number_ciphertext is null then null else left(private.decrypt_producer_kyc(kyc.food_registration_number_ciphertext), 3) || '••••' || right(private.decrypt_producer_kyc(kyc.food_registration_number_ciphertext), 3) end,
    'iban_masked', case when kyc.iban_ciphertext is null then null else left(private.decrypt_producer_kyc(kyc.iban_ciphertext), 4) || ' •••• •••• •••• ' || right(private.decrypt_producer_kyc(kyc.iban_ciphertext), 4) end,
    'documents', coalesce((select jsonb_agg(jsonb_build_object(
      'id', document.id, 'document_type', document.document_type, 'storage_path', document.storage_path,
      'mime_type', document.mime_type, 'size_bytes', document.size_bytes,
      'verification_status', document.verification_status, 'verified_at', document.verified_at,
      'created_at', document.created_at
    ) order by document.created_at) from private.producer_documents document where document.application_id = application.id), '[]'::jsonb)
  ) order by coalesce(application.submitted_at, application.created_at) desc), '[]'::jsonb)
  into result
  from public.producer_applications application
  left join private.producer_application_kyc kyc on kyc.application_id = application.id
  left join auth.users auth_user on auth_user.id = application.applicant_user_id;
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_review_producer_application_v2(p_application_id uuid, p_status text, p_reason text, p_commission_basis_points integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := (select auth.uid());
  application public.producer_applications%rowtype;
  kyc private.producer_application_kyc%rowtype;
  result jsonb;
  producer_id uuid;
begin
  if caller_id is null or not coalesce(private.has_permission('seller.review'),false) then raise exception 'admin_required' using errcode = '42501'; end if;
  select item.* into application from public.producer_applications item where item.id = p_application_id;
  select item.* into kyc from private.producer_application_kyc item where item.application_id = p_application_id;
  if application.id is null or kyc.application_id is null then raise exception 'producer_application_not_found' using errcode = 'P0002'; end if;

  if p_status = 'approved' then
    if kyc.contact_email_verified_at is null then raise exception 'producer_email_not_verified' using errcode = '55000'; end if;
    if kyc.phone_verified_at is null then raise exception 'producer_phone_not_verified' using errcode = '55000'; end if;
    if application.seller_classification = 'tax_exempt_artisan' and not exists (select 1 from private.producer_documents document where document.application_id = p_application_id and document.document_type = 'tax_exemption_certificate' and document.verification_status = 'verified') then raise exception 'tax_exemption_document_not_verified' using errcode = '55000'; end if;
    if application.food_compliance_status = 'registered' and not exists (select 1 from private.producer_documents document where document.application_id = p_application_id and document.document_type = 'food_business_registration' and document.verification_status = 'verified') then raise exception 'food_registration_document_not_verified' using errcode = '55000'; end if;
    if application.food_compliance_status = 'approved_facility' and not exists (select 1 from private.producer_documents document where document.application_id = p_application_id and document.document_type = 'food_business_approval' and document.verification_status = 'verified') then raise exception 'food_approval_document_not_verified' using errcode = '55000'; end if;
    if application.food_compliance_status = 'primary_production_review' and not exists (select 1 from private.producer_documents document where document.application_id = p_application_id and document.document_type = 'cks' and document.verification_status = 'verified') then raise exception 'primary_producer_document_not_verified' using errcode = '55000'; end if;
    if application.food_compliance_status = 'pending' then raise exception 'food_compliance_not_ready' using errcode = '55000'; end if;
  end if;

  result := public.admin_review_producer_application(p_application_id, p_status, p_reason, p_commission_basis_points);
  if p_status = 'approved' then
    producer_id := (result ->> 'producer_id')::uuid;
    update public.producers producer set verified_at = timezone('utc', now()), verification_due_at = timezone('utc', now()) + interval '1 year' where producer.id = producer_id;
  end if;
  return result;
end;
$function$
;

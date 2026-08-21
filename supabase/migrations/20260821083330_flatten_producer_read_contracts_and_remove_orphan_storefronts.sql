create or replace function private.get_my_producer_dashboard_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  caller_id uuid := auth.uid();
  producer_row public.producers%rowtype;
  base jsonb;
  commerce jsonb;
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  if coalesce(private.is_admin(), false) then
    raise exception 'producer_portal_separate_from_admin' using errcode='42501';
  end if;

  select p.* into producer_row
  from public.producers p
  where p.owner_user_id=caller_id and p.deleted_at is null
  order by p.created_at desc
  limit 1;

  if producer_row.id is null then
    raise exception 'producer_profile_required' using errcode='42501';
  end if;

  select jsonb_build_object(
    'profile', private.get_my_producer_profile_v1(),
    'inventory', case when producer_row.status='active' and producer_row.is_verified
      then private.list_my_producer_inventory_v1() else '[]'::jsonb end,
    'finance', private.get_my_producer_finance_summary_v1(),
    'summary', jsonb_build_object(
      'draftProducts', (select count(*) from public.products p where p.producer_id=producer_row.id and p.status='draft' and p.deleted_at is null),
      'reviewProducts', (select count(*) from public.products p where p.producer_id=producer_row.id and p.status='review' and p.deleted_at is null),
      'publishedProducts', (select count(*) from public.products p where p.producer_id=producer_row.id and p.status='published' and p.is_active=true and p.deleted_at is null),
      'rejectedProducts', (select count(*) from public.products p where p.producer_id=producer_row.id and p.status='rejected' and p.deleted_at is null),
      'pendingChanges', (select count(*) from public.product_change_requests r where r.producer_id=producer_row.id and r.status='pending'),
      'draftBatches', (select count(*) from public.product_batches b where b.producer_id=producer_row.id and b.status='draft'),
      'reviewBatches', (select count(*) from public.product_batches b where b.producer_id=producer_row.id and b.status='review'),
      'releasedBatches', (select count(*) from public.product_batches b where b.producer_id=producer_row.id and b.status='released'),
      'lowStockVariants', (
        select count(*)
        from public.product_inventory i
        join public.product_variants v on v.id=i.variant_id
        join public.products p on p.id=v.product_id
        where p.producer_id=producer_row.id
          and p.stock_mode in ('tracked','seasonal')
          and greatest(0,i.available_quantity-i.reserved_quantity)<=i.reorder_level
      )
    ),
    'changeRequests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'productId',r.product_id,'productName',p.name,'status',r.status,
        'proposedPayload',r.proposed_payload,'reviewReason',r.review_reason,
        'createdAt',r.created_at,'updatedAt',r.updated_at,'reviewedAt',r.reviewed_at
      ) order by r.created_at desc)
      from (
        select * from public.product_change_requests
        where producer_id=producer_row.id
        order by created_at desc limit 20
      ) r
      join public.products p on p.id=r.product_id
    ), '[]'::jsonb),
    'batches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',b.id,'traceCode',b.trace_code,'batchCode',b.batch_code,
        'productId',b.product_id,'productName',p.name,'variantId',b.variant_id,
        'status',b.status,'harvestDate',b.harvest_date,'productionDate',b.production_date,
        'packagingDate',b.packaging_date,'bestBeforeDate',b.best_before_date,
        'reviewReason',b.review_reason,'submittedAt',b.submitted_at,
        'reviewedAt',b.reviewed_at,'releasedAt',b.released_at,'updatedAt',b.updated_at
      ) order by b.updated_at desc)
      from (
        select * from public.product_batches
        where producer_id=producer_row.id
        order by updated_at desc limit 20
      ) b
      join public.products p on p.id=b.product_id
    ), '[]'::jsonb),
    'recentPayouts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'currency',p.currency,'amountMinor',p.amount_minor,'status',p.status,
        'provider',p.provider,'providerReference',p.provider_reference,'note',p.note,
        'scheduledAt',p.scheduled_at,'processedAt',p.processed_at,'createdAt',p.created_at
      ) order by p.created_at desc)
      from (
        select * from private.producer_payouts
        where producer_id=producer_row.id
        order by created_at desc limit 10
      ) p
    ), '[]'::jsonb)
  ) into base;

  select jsonb_build_object(
    'followerCount', (select count(*) from private.producer_follows f where f.producer_id=producer_row.id),
    'orderCount', (select count(distinct oi.order_id) from public.order_items oi where oi.producer_id=producer_row.id),
    'openOrderCount', (
      select count(distinct oi.order_id)
      from public.order_items oi join public.orders o on o.id=oi.order_id
      where oi.producer_id=producer_row.id
        and o.status in ('confirmed','preparing','partially_shipped','shipped')
    ),
    'customerCount', (
      select count(distinct o.user_id)
      from public.order_items oi join public.orders o on o.id=oi.order_id
      where oi.producer_id=producer_row.id and o.status not in ('draft','cancelled')
    ),
    'recentOrders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',x.id,'orderNumber',x.order_number,'status',x.status,
        'fulfillmentStatus',x.fulfillment_status,'currency',x.currency,
        'producerTotalMinor',x.producer_total_minor,'placedAt',x.placed_at,'createdAt',x.created_at
      ) order by x.created_at desc)
      from (
        select o.id,o.order_number,o.status,o.fulfillment_status,o.currency,
               sum(oi.line_total_minor)::bigint producer_total_minor,o.placed_at,o.created_at
        from public.order_items oi join public.orders o on o.id=oi.order_id
        where oi.producer_id=producer_row.id
        group by o.id,o.order_number,o.status,o.fulfillment_status,o.currency,o.placed_at,o.created_at
        order by o.created_at desc limit 10
      ) x
    ), '[]'::jsonb)
  ) into commerce;

  return base || jsonb_build_object('commerce', commerce);
end;
$$;

drop function if exists private.get_my_producer_dashboard_v1();

create or replace function private.get_my_producer_application_draft_v5(p_application_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  caller_id uuid := auth.uid();
  result jsonb;
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;

  select jsonb_build_object(
    'application_id', a.id,
    'applicant_type', a.applicant_type,
    'status', a.status,
    'seller_classification', a.seller_classification,
    'activity_types', a.activity_types,
    'brand_name', a.brand_name,
    'public_name', a.public_name,
    'description', a.description,
    'production_location', jsonb_build_object(
      'country_code', a.production_country_code,
      'province', a.production_province,
      'district', a.production_district,
      'village', a.production_village,
      'village_is_custom', a.production_village_is_custom,
      'latitude', a.production_latitude,
      'longitude', a.production_longitude
    ),
    'production_country_code', a.production_country_code,
    'production_province', a.production_province,
    'production_district', a.production_district,
    'production_village', a.production_village,
    'production_village_is_custom', a.production_village_is_custom,
    'production_latitude', a.production_latitude,
    'production_longitude', a.production_longitude,
    'product_categories', a.product_categories,
    'food_compliance_status', a.food_compliance_status,
    'fulfillment_methods', a.fulfillment_methods,
    'average_dispatch_days', a.average_dispatch_days,
    'cold_chain_capable', a.cold_chain_capable,
    'planned_products', a.planned_products,
    'sourcing_models', a.sourcing_models,
    'organic_claim_status', a.organic_claim_status,
    'organic_certifier_name', coalesce(a.organic_certifier_name,''),
    'organic_certificate_number', coalesce(private.decrypt_producer_kyc(k.organic_certificate_number_ciphertext),''),
    'organic_certificate_expires_on', a.organic_certificate_expires_on,
    'village_product_commitment', a.village_product_commitment,
    'traceability_commitment', a.traceability_commitment,
    'product_truth_commitment', a.product_truth_commitment,
    'production_practice_notes', a.production_practice_notes,
    'submitted_at', a.submitted_at,
    'rejection_reason', a.rejection_reason,
    'created_at', a.created_at,
    'updated_at', a.updated_at,
    'legal_name', k.legal_name,
    'identifier', case when a.applicant_type='individual'
      then private.decrypt_producer_kyc(k.national_id_ciphertext)
      else private.decrypt_producer_kyc(k.tax_number_ciphertext) end,
    'tax_office', coalesce(k.tax_office,''),
    'mersis_number', coalesce(private.decrypt_producer_kyc(k.mersis_number_ciphertext),''),
    'tax_exemption_number', coalesce(private.decrypt_producer_kyc(k.tax_exemption_number_ciphertext),''),
    'food_registration_number', coalesce(private.decrypt_producer_kyc(k.food_registration_number_ciphertext),''),
    'iban', coalesce(private.decrypt_producer_kyc(k.iban_ciphertext),''),
    'phone', k.phone,
    'contact_email', k.contact_email,
    'contact_email_verified_at', k.contact_email_verified_at,
    'phone_verified_at', k.phone_verified_at,
    'address', k.address,
    'consent_version', k.consent_version,
    'existing_document_types', coalesce((
      select jsonb_agg(distinct d.document_type)
      from private.producer_documents d
      where d.application_id=a.id and d.verification_status<>'rejected'
    ), '[]'::jsonb)
  ) into result
  from public.producer_applications a
  join private.producer_application_kyc k on k.application_id=a.id
  where a.applicant_user_id=caller_id
    and (p_application_id is null or a.id=p_application_id)
  order by case when a.status in ('draft','needs_information') then 0 else 1 end,
           a.updated_at desc
  limit 1;

  return result;
end;
$$;

drop function if exists public.get_my_producer_application_draft_v2(uuid);
drop function if exists private.get_my_producer_application_draft_v3(uuid);
drop function if exists private.get_my_producer_application_draft_v4(uuid);

delete from public.producers p
where p.slug <> 'golden-oremar'
  and p.status='closed'
  and p.owner_user_id is null
  and p.application_id is null
  and p.deleted_at is null
  and not exists (select 1 from private.event_reservation_finance x where x.producer_id=p.id)
  and not exists (select 1 from private.payment_item_splits x where x.producer_id=p.id)
  and not exists (select 1 from private.producer_event_submissions x where x.producer_id=p.id)
  and not exists (select 1 from private.producer_follows x where x.producer_id=p.id)
  and not exists (select 1 from private.producer_ledger_entries x where x.producer_id=p.id)
  and not exists (select 1 from private.producer_payment_accounts x where x.producer_id=p.id)
  and not exists (select 1 from private.producer_payouts x where x.producer_id=p.id)
  and not exists (select 1 from private.producer_trust_badge_events x where x.producer_id=p.id)
  and not exists (select 1 from private.product_editorial_drafts x where x.producer_id=p.id)
  and not exists (select 1 from private.product_moderation_events x where x.producer_id=p.id)
  and not exists (select 1 from public.content_entries x where x.related_producer_id=p.id)
  and not exists (select 1 from public.conversations x where x.producer_id=p.id)
  and not exists (select 1 from public.events x where x.producer_id=p.id)
  and not exists (select 1 from public.order_items x where x.producer_id=p.id)
  and not exists (select 1 from public.producer_location_change_requests x where x.producer_id=p.id)
  and not exists (select 1 from public.product_batches x where x.producer_id=p.id)
  and not exists (select 1 from public.product_change_requests x where x.producer_id=p.id)
  and not exists (select 1 from public.product_provenance x where x.source_producer_id=p.id)
  and not exists (select 1 from public.products x where x.producer_id=p.id);

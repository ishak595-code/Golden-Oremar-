-- LIVE APPLIED to Supabase project rmfcziawxjgcnxexbrvw.
-- Canonical source record for the producer-owned batch editor read model.

create or replace function private.get_my_product_batch_editor_v1(p_batch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  caller_id uuid := auth.uid();
  batch_row public.product_batches%rowtype;
  product_row public.products%rowtype;
  result jsonb;
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;

  select b.* into batch_row
  from public.product_batches b
  join public.producers producer on producer.id=b.producer_id
  where b.id=p_batch_id
    and producer.owner_user_id=caller_id
    and producer.deleted_at is null;

  if batch_row.id is null then
    raise exception 'batch_not_found_or_access_denied' using errcode='42501';
  end if;

  select * into product_row from public.products where id=batch_row.product_id;

  select jsonb_build_object(
    'id',batch_row.id,
    'traceCode',batch_row.trace_code,
    'batchCode',batch_row.batch_code,
    'status',batch_row.status,
    'productId',batch_row.product_id,
    'productSlug',product_row.slug,
    'productName',product_row.name,
    'variantId',batch_row.variant_id,
    'harvestDate',batch_row.harvest_date,
    'productionDate',batch_row.production_date,
    'packagingDate',batch_row.packaging_date,
    'bestBeforeDate',batch_row.best_before_date,
    'origin',jsonb_build_object(
      'countryCode',batch_row.origin_country_code,
      'province',batch_row.origin_province,
      'district',batch_row.origin_district,
      'village',batch_row.origin_village,
      'latitude',batch_row.origin_latitude,
      'longitude',batch_row.origin_longitude
    ),
    'productionMethod',batch_row.production_method,
    'initialQuantity',batch_row.initial_quantity,
    'quantityUnit',batch_row.quantity_unit,
    'publicNotes',batch_row.public_notes,
    'reviewReason',batch_row.review_reason,
    'submittedAt',batch_row.submitted_at,
    'reviewedAt',batch_row.reviewed_at,
    'releasedAt',batch_row.released_at,
    'createdAt',batch_row.created_at,
    'updatedAt',batch_row.updated_at,
    'events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,
        'eventType',e.event_type,
        'eventAt',e.event_at,
        'locationLabel',e.location_label,
        'publicNote',e.public_note,
        'visibility',e.visibility,
        'createdAt',e.created_at
      ) order by e.event_at,e.id)
      from public.product_batch_events e
      where e.batch_id=batch_row.id
    ),'[]'::jsonb),
    'certifications',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,
        'type',c.certificate_type,
        'issuer',c.issuer,
        'certificateNumber',c.certificate_number,
        'issuedAt',c.issued_at,
        'expiresAt',c.expires_at,
        'status',c.status,
        'linked',exists(
          select 1 from public.product_batch_certifications bc
          where bc.batch_id=batch_row.id and bc.certification_id=c.id
        )
      ) order by c.certificate_type,c.issuer)
      from public.product_certifications c
      where c.product_id=batch_row.product_id
        and c.status='valid'
        and (c.expires_at is null or c.expires_at>=current_date)
    ),'[]'::jsonb)
  ) into result;

  return result;
end;
$function$;

create or replace function public.get_my_product_batch_editor_v1(p_batch_id uuid)
returns jsonb
language sql
stable
set search_path=''
as $function$
  select private.get_my_product_batch_editor_v1(p_batch_id);
$function$;

revoke all on function public.get_my_product_batch_editor_v1(uuid) from public, anon;
grant execute on function public.get_my_product_batch_editor_v1(uuid) to authenticated;

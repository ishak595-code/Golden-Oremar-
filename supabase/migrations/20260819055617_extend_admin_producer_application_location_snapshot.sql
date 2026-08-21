create or replace function private.admin_list_producer_applications_v3()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  base jsonb;
  result jsonb;
begin
  base := public.admin_list_producer_applications_v2();
  select coalesce(jsonb_agg(item || jsonb_build_object(
    'planned_products', application.planned_products,
    'sourcing_models', application.sourcing_models,
    'organic_claim_status', application.organic_claim_status,
    'organic_certifier_name', application.organic_certifier_name,
    'organic_certificate_expires_on', application.organic_certificate_expires_on,
    'village_product_commitment', application.village_product_commitment,
    'traceability_commitment', application.traceability_commitment,
    'product_truth_commitment', application.product_truth_commitment,
    'production_practice_notes', application.production_practice_notes,
    'production_country_code', application.production_country_code,
    'production_province', application.production_province,
    'production_district', application.production_district,
    'production_village', application.production_village,
    'production_village_is_custom', application.production_village_is_custom
  )), '[]'::jsonb)
  into result
  from jsonb_array_elements(base) item
  join public.producer_applications application on application.id = (item ->> 'id')::uuid;
  return result;
end;
$function$;

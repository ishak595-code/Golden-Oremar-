-- Make the current producer onboarding consent contract canonical without reopening the legacy client entrypoint.

alter function public.save_producer_application_draft(
  uuid,text,text,text,text,text,text[],text,text,text,text,text,text,jsonb,text
) rename to save_producer_application_draft_legacy_v1;

revoke all on function public.save_producer_application_draft_legacy_v1(
  uuid,text,text,text,text,text,text[],text,text,text,text,text,text,jsonb,text
) from public, anon, authenticated, service_role;

create function public.save_producer_application_draft(
  p_application_id uuid,
  p_applicant_type text,
  p_brand_name text,
  p_public_name text,
  p_description text,
  p_production_location text,
  p_product_categories text[],
  p_legal_name text,
  p_identifier text,
  p_tax_office text,
  p_iban text,
  p_phone text,
  p_contact_email text,
  p_address jsonb,
  p_consent_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  application_id uuid;
begin
  if p_consent_version <> 'producer-onboarding-v2-2026-08-19' then
    raise exception 'producer_consent_required' using errcode = '22023';
  end if;

  result := public.save_producer_application_draft_legacy_v1(
    p_application_id,
    p_applicant_type,
    p_brand_name,
    p_public_name,
    p_description,
    p_production_location,
    p_product_categories,
    p_legal_name,
    p_identifier,
    p_tax_office,
    p_iban,
    p_phone,
    p_contact_email,
    p_address,
    'producer-onboarding-v1-2026-08-14'
  );

  application_id := (result ->> 'application_id')::uuid;

  update private.producer_application_kyc
  set consent_version = p_consent_version,
      consented_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where producer_application_kyc.application_id = application_id;

  return result;
end;
$$;

revoke all on function public.save_producer_application_draft(
  uuid,text,text,text,text,text,text[],text,text,text,text,text,text,jsonb,text
) from public, anon, authenticated, service_role;

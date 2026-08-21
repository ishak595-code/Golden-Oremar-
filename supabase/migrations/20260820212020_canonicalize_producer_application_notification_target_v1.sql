create or replace function public.admin_review_producer_application(p_application_id uuid, p_status text, p_reason text, p_commission_basis_points integer)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid := (select auth.uid());
  application public.producer_applications%rowtype;
  producer_id uuid;
  producer_slug text;
  required_document_verified boolean;
begin
  if caller_id is null or not coalesce(private.is_admin(), false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  if p_status not in ('under_review', 'needs_information', 'approved', 'rejected') then
    raise exception 'invalid_producer_application_status' using errcode = '22023';
  end if;

  if p_status in ('needs_information', 'rejected')
    and char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'producer_review_reason_required' using errcode = '22023';
  end if;

  if p_commission_basis_points is null or p_commission_basis_points not between 0 and 3000 then
    raise exception 'invalid_producer_commission' using errcode = '22023';
  end if;

  select application_row.*
  into application
  from public.producer_applications application_row
  where application_row.id = p_application_id
  for update;

  if application.id is null then
    raise exception 'producer_application_not_found' using errcode = 'P0002';
  end if;

  if application.status in ('approved', 'rejected', 'withdrawn') then
    raise exception 'producer_application_already_final' using errcode = '55000';
  end if;

  if p_status = 'approved' then
    if application.status not in ('submitted', 'under_review') then
      raise exception 'producer_application_not_ready' using errcode = '55000';
    end if;

    select case
      when application.applicant_type = 'individual' then exists (
        select 1
        from private.producer_documents document
        where document.application_id = application.id
          and document.document_type = 'identity'
          and document.verification_status = 'verified'
      )
      else exists (
        select 1
        from private.producer_documents document
        where document.application_id = application.id
          and document.document_type in ('tax_certificate', 'business_registration')
          and document.verification_status = 'verified'
      )
    end
    into required_document_verified;

    if not coalesce(required_document_verified, false) then
      raise exception 'required_producer_document_not_verified' using errcode = '55000';
    end if;

    producer_slug := trim(both '-' from regexp_replace(
      lower(translate(
        application.brand_name,
        'çğıöşüÇĞİÖŞÜ',
        'cgiosuCGIOSU'
      )),
      '[^a-z0-9]+',
      '-',
      'g'
    ));

    if producer_slug = '' then
      producer_slug := 'uretici';
    end if;
    producer_slug := left(producer_slug, 120) || '-' || left(application.id::text, 8);

    insert into public.producers(
      owner_user_id,
      application_id,
      slug,
      display_name,
      description,
      production_location,
      status,
      is_verified,
      commission_basis_points
    ) values (
      application.applicant_user_id,
      application.id,
      producer_slug,
      application.brand_name,
      application.description,
      application.production_location,
      'active',
      true,
      p_commission_basis_points
    )
    on conflict (owner_user_id) do update set
      application_id = excluded.application_id,
      display_name = excluded.display_name,
      description = excluded.description,
      production_location = excluded.production_location,
      status = 'active',
      is_verified = true,
      commission_basis_points = excluded.commission_basis_points,
      deleted_at = null
    returning id into producer_id;

    insert into private.user_roles(user_id, role, granted_by)
    values (application.applicant_user_id, 'producer', caller_id)
    on conflict (user_id, role) do update set
      granted_by = excluded.granted_by,
      granted_at = timezone('utc', now()),
      expires_at = null;
  end if;

  update public.producer_applications
  set status = p_status,
      reviewed_at = timezone('utc', now()),
      reviewed_by = caller_id,
      rejection_reason = case
        when p_status in ('needs_information', 'rejected') then btrim(p_reason)
        else null
      end
  where id = application.id;

  insert into public.notifications(user_id, type, title, message, action_url, metadata)
  values (
    application.applicant_user_id,
    'producer',
    case p_status
      when 'approved' then 'Üretici başvurunuz onaylandı'
      when 'rejected' then 'Üretici başvurunuz sonuçlandı'
      when 'needs_information' then 'Üretici başvurunuz için ek bilgi gerekiyor'
      else 'Üretici başvurunuz inceleniyor'
    end,
    case p_status
      when 'approved' then 'Mağazanız oluşturuldu. Üretici paneline erişebilirsiniz.'
      when 'rejected' then 'Başvurunuz reddedildi. Gerekçeyi başvuru ekranında görebilirsiniz.'
      when 'needs_information' then 'Başvurunuzu güncelleyip yeniden göndermeniz gerekiyor.'
      else 'Başvurunuz yönetici incelemesine alındı.'
    end,
    '/?tab=account&view=vendor-apply',
    jsonb_build_object('application_id', application.id, 'status', p_status, 'producer_id', producer_id)
  );

  insert into private.outbox_events(aggregate_type, aggregate_id, event_type, payload)
  values (
    'producer_application',
    application.id,
    'producer_application.' || p_status,
    jsonb_build_object(
      'application_id', application.id,
      'applicant_user_id', application.applicant_user_id,
      'reviewed_by', caller_id,
      'producer_id', producer_id
    )
  );

  return jsonb_build_object(
    'application_id', application.id,
    'status', p_status,
    'producer_id', producer_id
  );
end;
$$;

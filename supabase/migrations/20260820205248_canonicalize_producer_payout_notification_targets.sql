create or replace function private.request_my_producer_payout_v2(p_currency text, p_amount_minor bigint, p_note text default null::text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare uid uuid:=auth.uid(); p public.producers%rowtype; currency_code text:=upper(btrim(coalesce(p_currency,''))); balance jsonb; available bigint; destination jsonb; row private.producer_payouts%rowtype; admin_user uuid;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if currency_code !~ '^[A-Z]{3}$' or p_amount_minor is null or p_amount_minor<=0 then raise exception 'invalid_payout_request' using errcode='22023'; end if;
  if char_length(coalesce(p_note,''))>1000 then raise exception 'payout_note_too_long' using errcode='22023'; end if;
  select * into p from public.producers where owner_user_id=uid and deleted_at is null order by created_at desc limit 1 for update;
  if p.id is null then raise exception 'producer_profile_required' using errcode='42501'; end if;
  if p.status<>'active' or not p.is_verified then raise exception 'active_verified_producer_required' using errcode='55000'; end if;
  balance:=private.get_producer_balance_v1(p.id,currency_code); available:=(balance->>'availableToPayoutMinor')::bigint;
  if p_amount_minor>available then raise exception 'payout_exceeds_available_balance' using errcode='22023'; end if;
  destination:=private.get_producer_bank_destination_v1(p.id);
  insert into private.producer_payouts(producer_id,currency,amount_minor,status,provider,note,created_by,scheduled_at,requested_at,channel,request_source,destination_application_id,destination_account_holder,destination_iban_ciphertext,destination_iban_masked)
  values(p.id,currency_code,p_amount_minor,'requested','bank_transfer',nullif(btrim(coalesce(p_note,'')),''),uid,timezone('utc',now()),timezone('utc',now()),'manual_bank_transfer','producer',(destination->>'applicationId')::uuid,destination->>'accountHolder',destination->>'ibanCiphertext',destination->>'ibanMasked') returning * into row;
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('producer_payout',row.id,'producer_payout.requested',jsonb_build_object('payout_id',row.id,'producer_id',p.id,'currency',currency_code,'amount_minor',p_amount_minor,'actor_user_id',uid,'channel','manual_bank_transfer'));
  for admin_user in select distinct ur.user_id from private.user_roles ur join public.profiles pr on pr.id=ur.user_id where ur.role='super_admin' and (ur.expires_at is null or ur.expires_at>timezone('utc',now())) and pr.status='active' and pr.deleted_at is null loop
    insert into public.notifications(user_id,type,title,message,action_url,metadata) values(admin_user,'producer','Yeni satıcı çekim talebi',p.display_name||' için banka transferi bekleyen çekim talebi var.','/?tab=admin&adminView=producer-payouts',jsonb_build_object('payoutId',row.id,'producerId',p.id,'amountMinor',p_amount_minor,'currency',currency_code));
  end loop;
  return jsonb_build_object('id',row.id,'producerId',p.id,'currency',currency_code,'amountMinor',p_amount_minor,'status','requested','channel','manual_bank_transfer','destinationIbanMasked',row.destination_iban_masked,'destinationAccountHolder',row.destination_account_holder,'requestedAt',row.requested_at);
end;
$$;

create or replace function private.super_admin_update_producer_payout_v2(p_payout_id uuid, p_status text, p_reference text default null::text, p_note text default null::text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare uid uuid:=auth.uid(); row private.producer_payouts%rowtype; next_status text:=lower(btrim(coalesce(p_status,''))); owner_id uuid; provider_value text;
begin
  if uid is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if next_status not in('processing','paid','failed','cancelled') then raise exception 'invalid_payout_status' using errcode='22023'; end if;
  if char_length(coalesce(p_reference,''))>180 or char_length(coalesce(p_note,''))>1000 then raise exception 'invalid_payout_field' using errcode='22023'; end if;
  select * into row from private.producer_payouts where id=p_payout_id for update;
  if row.id is null then raise exception 'payout_not_found' using errcode='P0002'; end if;
  if row.channel='provider_marketplace' then
    if not (row.status='processing' and next_status in('paid','failed')) then raise exception 'invalid_payout_transition' using errcode='22023'; end if;
    provider_value:='iyzico';
  else
    if not ((row.status in('requested','scheduled') and next_status in('processing','paid','failed','cancelled')) or (row.status='processing' and next_status in('paid','failed','cancelled'))) then raise exception 'invalid_payout_transition' using errcode='22023'; end if;
    provider_value:='bank_transfer';
  end if;
  if next_status='paid' and char_length(btrim(coalesce(p_reference,'')))<4 then raise exception 'payout_payment_reference_required' using errcode='22023'; end if;
  update private.producer_payouts set status=next_status,provider=provider_value,provider_reference=case when nullif(btrim(coalesce(p_reference,'')),'') is not null then btrim(p_reference) else provider_reference end,note=case when nullif(btrim(coalesce(p_note,'')),'') is not null then btrim(p_note) else note end,processed_by=uid,processed_at=case when next_status in('paid','failed','cancelled') then timezone('utc',now()) else processed_at end,updated_at=timezone('utc',now()) where id=row.id returning * into row;
  select owner_user_id into owner_id from public.producers where id=row.producer_id;
  if owner_id is not null and next_status in('paid','failed','cancelled') then
    insert into public.notifications(user_id,type,title,message,action_url,metadata) values(owner_id,'producer',case next_status when 'paid' then 'Satıcı ödemeniz tamamlandı' when 'failed' then 'Satıcı ödemeniz sonuçlanamadı' else 'Çekim talebiniz iptal edildi' end,case next_status when 'paid' then 'Ödeme hedef IBAN hesabınıza gönderildi ve transfer referansı kaydedildi.' when 'failed' then 'Ödeme işlemi tamamlanamadı. Finans ekranından durumu takip edebilirsiniz.' else 'Bekleyen çekim talebi iptal edildi.' end,'/?tab=account&view=seller%3Afinance',jsonb_build_object('payoutId',row.id,'status',next_status,'amountMinor',row.amount_minor,'currency',row.currency));
  end if;
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('producer_payout',row.id,'producer_payout.'||next_status,jsonb_build_object('payout_id',row.id,'producer_id',row.producer_id,'status',next_status,'channel',row.channel,'actor_user_id',uid));
  return jsonb_build_object('id',row.id,'producerId',row.producer_id,'currency',row.currency,'amountMinor',row.amount_minor,'status',row.status,'channel',row.channel,'provider',row.provider,'providerReference',row.provider_reference,'processedAt',row.processed_at);
end;
$$;

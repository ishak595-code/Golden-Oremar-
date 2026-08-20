alter table private.producer_payouts add column if not exists channel text not null default 'manual_bank_transfer';
alter table private.producer_payouts add column if not exists request_source text not null default 'legacy_admin';
alter table private.producer_payouts add column if not exists source_order_id uuid references public.orders(id) on delete restrict;
alter table private.producer_payouts add column if not exists requested_at timestamptz;
alter table private.producer_payouts add column if not exists destination_application_id uuid references public.producer_applications(id) on delete set null;
alter table private.producer_payouts add column if not exists destination_account_holder text;
alter table private.producer_payouts add column if not exists destination_iban_ciphertext text;
alter table private.producer_payouts add column if not exists destination_iban_masked text;
alter table private.producer_payouts add column if not exists provider_settlement_released_at timestamptz;

update private.producer_payouts set requested_at=coalesce(requested_at,scheduled_at,created_at) where requested_at is null;

alter table private.producer_payouts drop constraint if exists producer_payouts_status_check;
alter table private.producer_payouts add constraint producer_payouts_status_check check(status in('requested','scheduled','processing','paid','failed','cancelled'));

do $$ begin
  if not exists(select 1 from pg_constraint where conname='producer_payouts_channel_check' and conrelid='private.producer_payouts'::regclass) then alter table private.producer_payouts add constraint producer_payouts_channel_check check(channel in('provider_marketplace','manual_bank_transfer')); end if;
  if not exists(select 1 from pg_constraint where conname='producer_payouts_request_source_check' and conrelid='private.producer_payouts'::regclass) then alter table private.producer_payouts add constraint producer_payouts_request_source_check check(request_source in('producer','super_admin','super_admin_settlement','legacy_admin')); end if;
  if not exists(select 1 from pg_constraint where conname='producer_payouts_destination_holder_length_check' and conrelid='private.producer_payouts'::regclass) then alter table private.producer_payouts add constraint producer_payouts_destination_holder_length_check check(destination_account_holder is null or char_length(destination_account_holder)<=300); end if;
  if not exists(select 1 from pg_constraint where conname='producer_payouts_destination_mask_length_check' and conrelid='private.producer_payouts'::regclass) then alter table private.producer_payouts add constraint producer_payouts_destination_mask_length_check check(destination_iban_masked is null or char_length(destination_iban_masked)<=80); end if;
end $$;

create index if not exists producer_payouts_queue_idx on private.producer_payouts(status,created_at desc);
create index if not exists producer_payouts_channel_idx on private.producer_payouts(channel,status,created_at desc);
create index if not exists producer_payouts_source_order_idx on private.producer_payouts(source_order_id) where source_order_id is not null;
create unique index if not exists producer_payouts_provider_order_producer_uidx on private.producer_payouts(source_order_id,producer_id,channel) where source_order_id is not null and channel='provider_marketplace';

create or replace function private.mask_tr_iban_v1(p_value text)
returns text language plpgsql immutable set search_path='' as $$
declare v text:=upper(regexp_replace(coalesce(p_value,''),'[^A-Za-z0-9]','','g'));
begin if v !~ '^TR[0-9]{24}$' then return null; end if; return substr(v,1,6)||' **** **** **** **** '||right(v,4); end;
$$;
revoke all on function private.mask_tr_iban_v1(text) from public,anon,authenticated;

create or replace function private.get_producer_bank_destination_v1(p_producer_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.producers%rowtype; k private.producer_application_kyc%rowtype; iban_value text; holder_value text;
begin
  select * into p from public.producers where id=p_producer_id and deleted_at is null;
  if p.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  if p.application_id is null then raise exception 'producer_application_required' using errcode='55000'; end if;
  select * into k from private.producer_application_kyc where application_id=p.application_id;
  if k.application_id is null then raise exception 'producer_kyc_missing' using errcode='55000'; end if;
  iban_value:=private.decrypt_producer_kyc(k.iban_ciphertext); holder_value:=nullif(btrim(coalesce(k.bank_account_holder,'')),'');
  if not private.is_valid_tr_iban_v1(iban_value) or holder_value is null then raise exception 'producer_bank_identity_incomplete' using errcode='55000'; end if;
  return jsonb_build_object('applicationId',p.application_id,'iban',upper(regexp_replace(iban_value,'[^A-Za-z0-9]','','g')),'ibanMasked',private.mask_tr_iban_v1(iban_value),'accountHolder',holder_value,'ibanCiphertext',k.iban_ciphertext);
end;
$$;
revoke all on function private.get_producer_bank_destination_v1(uuid) from public,anon,authenticated;

create or replace function private.get_producer_balance_v1(p_producer_id uuid,p_currency text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare currency_code text:=upper(btrim(coalesce(p_currency,''))); pending_net bigint:=0; available_ledger bigint:=0; reserved_payout bigint:=0; paid_payout bigint:=0; provider_processing bigint:=0; manual_requested bigint:=0; available_to_payout bigint:=0;
begin
  if currency_code !~ '^[A-Z]{3}$' then raise exception 'invalid_currency' using errcode='22023'; end if;
  select coalesce(sum(case when availability_status='pending' then producer_net_minor else 0 end),0)::bigint,coalesce(sum(case when availability_status='available' then producer_net_minor else 0 end),0)::bigint into pending_net,available_ledger from private.producer_ledger_entries where producer_id=p_producer_id and currency=currency_code;
  select coalesce(sum(amount_minor) filter(where status in('requested','scheduled','processing')),0)::bigint,coalesce(sum(amount_minor) filter(where status='paid'),0)::bigint,coalesce(sum(amount_minor) filter(where channel='provider_marketplace' and status='processing'),0)::bigint,coalesce(sum(amount_minor) filter(where channel='manual_bank_transfer' and status in('requested','scheduled','processing')),0)::bigint into reserved_payout,paid_payout,provider_processing,manual_requested from private.producer_payouts where producer_id=p_producer_id and currency=currency_code;
  available_to_payout:=greatest(available_ledger-reserved_payout-paid_payout,0);
  return jsonb_build_object('producerId',p_producer_id,'currency',currency_code,'pendingMinor',pending_net,'availableLedgerMinor',available_ledger,'reservedPayoutMinor',reserved_payout,'paidPayoutMinor',paid_payout,'providerTransferProcessingMinor',provider_processing,'manualWithdrawalPendingMinor',manual_requested,'availableToPayoutMinor',available_to_payout,'lifetimeNetMinor',pending_net+available_ledger);
end;
$$;

create or replace function private.request_my_producer_payout_v2(p_currency text,p_amount_minor bigint,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
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
  for admin_user in select distinct ur.user_id from private.user_roles ur join public.profiles pr on pr.id=ur.user_id where ur.role='super_admin' and (ur.expires_at is null or ur.expires_at>timezone('utc',now())) and pr.status='active' and pr.deleted_at is null loop insert into public.notifications(user_id,type,title,message,action_url,metadata) values(admin_user,'producer','Yeni satıcı çekim talebi',p.display_name||' için banka transferi bekleyen çekim talebi var.',null,jsonb_build_object('payoutId',row.id,'producerId',p.id,'amountMinor',p_amount_minor,'currency',currency_code)); end loop;
  return jsonb_build_object('id',row.id,'producerId',p.id,'currency',currency_code,'amountMinor',p_amount_minor,'status','requested','channel','manual_bank_transfer','destinationIbanMasked',row.destination_iban_masked,'destinationAccountHolder',row.destination_account_holder,'requestedAt',row.requested_at);
end;
$$;
revoke all on function private.request_my_producer_payout_v2(text,bigint,text) from public,anon;
grant execute on function private.request_my_producer_payout_v2(text,bigint,text) to authenticated;
create or replace function public.request_my_producer_payout_v2(p_currency text,p_amount_minor bigint,p_note text default null) returns jsonb language sql security invoker set search_path='' as $$select private.request_my_producer_payout_v2(p_currency,p_amount_minor,p_note);$$;
revoke all on function public.request_my_producer_payout_v2(text,bigint,text) from public,anon;
grant execute on function public.request_my_producer_payout_v2(text,bigint,text) to authenticated;

create or replace function private.cancel_my_producer_payout_v2(p_payout_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p_id uuid; row private.producer_payouts%rowtype;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select id into p_id from public.producers where owner_user_id=uid and deleted_at is null order by created_at desc limit 1;
  if p_id is null then raise exception 'producer_profile_required' using errcode='42501'; end if;
  select * into row from private.producer_payouts where id=p_payout_id and producer_id=p_id for update;
  if row.id is null then raise exception 'payout_not_found' using errcode='P0002'; end if;
  if row.channel<>'manual_bank_transfer' or row.request_source<>'producer' or row.status<>'requested' then raise exception 'payout_cannot_be_cancelled' using errcode='55000'; end if;
  update private.producer_payouts set status='cancelled',processed_by=uid,processed_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=row.id returning * into row;
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('producer_payout',row.id,'producer_payout.cancelled',jsonb_build_object('payout_id',row.id,'producer_id',p_id,'actor_user_id',uid,'source','producer'));
  return jsonb_build_object('id',row.id,'status',row.status);
end;
$$;
revoke all on function private.cancel_my_producer_payout_v2(uuid) from public,anon;
grant execute on function private.cancel_my_producer_payout_v2(uuid) to authenticated;
create or replace function public.cancel_my_producer_payout_v2(p_payout_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.cancel_my_producer_payout_v2(p_payout_id);$$;
revoke all on function public.cancel_my_producer_payout_v2(uuid) from public,anon;
grant execute on function public.cancel_my_producer_payout_v2(uuid) to authenticated;

create or replace function private.list_my_producer_payouts_v2(p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p_id uuid; result jsonb;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_limit not between 1 and 100 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;
  select id into p_id from public.producers where owner_user_id=uid and deleted_at is null order by created_at desc limit 1;
  if p_id is null then raise exception 'producer_profile_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'currency',q.currency,'amountMinor',q.amount_minor,'status',q.status,'channel',q.channel,'requestSource',q.request_source,'sourceOrderId',q.source_order_id,'provider',q.provider,'providerReference',q.provider_reference,'note',q.note,'destinationAccountHolder',q.destination_account_holder,'destinationIbanMasked',coalesce(q.destination_iban_masked,case when q.destination_iban_ciphertext is not null then private.mask_tr_iban_v1(private.decrypt_producer_kyc(q.destination_iban_ciphertext)) else null end),'requestedAt',q.requested_at,'scheduledAt',q.scheduled_at,'providerSettlementReleasedAt',q.provider_settlement_released_at,'processedAt',q.processed_at,'createdAt',q.created_at) order by q.created_at desc),'[]'::jsonb) into result from (select * from private.producer_payouts where producer_id=p_id order by created_at desc limit p_limit offset p_offset) q;
  return result;
end;
$$;
revoke all on function private.list_my_producer_payouts_v2(integer,integer) from public,anon;
grant execute on function private.list_my_producer_payouts_v2(integer,integer) to authenticated;
create or replace function public.list_my_producer_payouts_v2(p_limit integer default 50,p_offset integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$select private.list_my_producer_payouts_v2(p_limit,p_offset);$$;
revoke all on function public.list_my_producer_payouts_v2(integer,integer) from public,anon;
grant execute on function public.list_my_producer_payouts_v2(integer,integer) to authenticated;

create or replace function private.super_admin_list_producer_payouts_v2(p_status text default null,p_limit integer default 100,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); status_filter text:=nullif(lower(btrim(coalesce(p_status,''))),''); result jsonb;
begin
  if uid is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if status_filter is not null and status_filter not in('requested','scheduled','processing','paid','failed','cancelled') then raise exception 'invalid_payout_status' using errcode='22023'; end if;
  if p_limit not between 1 and 500 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;
  insert into private.sensitive_access_log(actor_user_id,resource_type,resource_id,purpose) values(uid,'producer_payout_queue',uid,'Süper Admin satıcı ödeme kuyruğunu ve ödeme hedefi IBAN bilgilerini görüntüledi.');
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'producerId',q.producer_id,'producerName',q.display_name,'ownerUserId',q.owner_user_id,'ownerEmail',q.owner_email,'currency',q.currency,'amountMinor',q.amount_minor,'status',q.status,'channel',q.channel,'requestSource',q.request_source,'sourceOrderId',q.source_order_id,'orderNumber',q.order_number,'provider',q.provider,'providerReference',q.provider_reference,'note',q.note,'destinationAccountHolder',coalesce(q.destination_account_holder,q.current_holder),'destinationIban',coalesce(case when q.destination_iban_ciphertext is not null then private.decrypt_producer_kyc(q.destination_iban_ciphertext) else null end,case when q.current_iban_ciphertext is not null then private.decrypt_producer_kyc(q.current_iban_ciphertext) else null end),'destinationIbanMasked',coalesce(q.destination_iban_masked,private.mask_tr_iban_v1(coalesce(case when q.destination_iban_ciphertext is not null then private.decrypt_producer_kyc(q.destination_iban_ciphertext) else null end,case when q.current_iban_ciphertext is not null then private.decrypt_producer_kyc(q.current_iban_ciphertext) else null end))),'requestedAt',q.requested_at,'scheduledAt',q.scheduled_at,'providerSettlementReleasedAt',q.provider_settlement_released_at,'processedAt',q.processed_at,'createdAt',q.created_at,'balance',private.get_producer_balance_v1(q.producer_id,q.currency)) order by q.created_at desc),'[]'::jsonb) into result
  from (select po.*,p.display_name,p.owner_user_id,au.email owner_email,o.order_number,k.bank_account_holder current_holder,k.iban_ciphertext current_iban_ciphertext from private.producer_payouts po join public.producers p on p.id=po.producer_id left join auth.users au on au.id=p.owner_user_id left join public.orders o on o.id=po.source_order_id left join private.producer_application_kyc k on k.application_id=p.application_id where status_filter is null or po.status=status_filter order by po.created_at desc limit p_limit offset p_offset) q;
  return result;
end;
$$;
revoke all on function private.super_admin_list_producer_payouts_v2(text,integer,integer) from public,anon;
grant execute on function private.super_admin_list_producer_payouts_v2(text,integer,integer) to authenticated;
create or replace function public.super_admin_list_producer_payouts_v2(p_status text default null,p_limit integer default 100,p_offset integer default 0) returns jsonb language sql security invoker set search_path='' as $$select private.super_admin_list_producer_payouts_v2(p_status,p_limit,p_offset);$$;
revoke all on function public.super_admin_list_producer_payouts_v2(text,integer,integer) from public,anon;
grant execute on function public.super_admin_list_producer_payouts_v2(text,integer,integer) to authenticated;

create or replace function private.super_admin_update_producer_payout_v2(p_payout_id uuid,p_status text,p_reference text default null,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); row private.producer_payouts%rowtype; next_status text:=lower(btrim(coalesce(p_status,''))); owner_id uuid; provider_value text;
begin
  if uid is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if next_status not in('processing','paid','failed','cancelled') then raise exception 'invalid_payout_status' using errcode='22023'; end if;
  if char_length(coalesce(p_reference,''))>180 or char_length(coalesce(p_note,''))>1000 then raise exception 'invalid_payout_field' using errcode='22023'; end if;
  select * into row from private.producer_payouts where id=p_payout_id for update;
  if row.id is null then raise exception 'payout_not_found' using errcode='P0002'; end if;
  if row.channel='provider_marketplace' then if not (row.status='processing' and next_status in('paid','failed')) then raise exception 'invalid_payout_transition' using errcode='22023'; end if; provider_value:='iyzico'; else if not ((row.status in('requested','scheduled') and next_status in('processing','paid','failed','cancelled')) or (row.status='processing' and next_status in('paid','failed','cancelled'))) then raise exception 'invalid_payout_transition' using errcode='22023'; end if; provider_value:='bank_transfer'; end if;
  if next_status='paid' and char_length(btrim(coalesce(p_reference,'')))<4 then raise exception 'payout_payment_reference_required' using errcode='22023'; end if;
  update private.producer_payouts set status=next_status,provider=provider_value,provider_reference=case when nullif(btrim(coalesce(p_reference,'')),'') is not null then btrim(p_reference) else provider_reference end,note=case when nullif(btrim(coalesce(p_note,'')),'') is not null then btrim(p_note) else note end,processed_by=uid,processed_at=case when next_status in('paid','failed','cancelled') then timezone('utc',now()) else processed_at end,updated_at=timezone('utc',now()) where id=row.id returning * into row;
  select owner_user_id into owner_id from public.producers where id=row.producer_id;
  if owner_id is not null and next_status in('paid','failed','cancelled') then insert into public.notifications(user_id,type,title,message,action_url,metadata) values(owner_id,'producer',case next_status when 'paid' then 'Satıcı ödemeniz tamamlandı' when 'failed' then 'Satıcı ödemeniz sonuçlanamadı' else 'Çekim talebiniz iptal edildi' end,case next_status when 'paid' then 'Ödeme hedef IBAN hesabınıza gönderildi ve transfer referansı kaydedildi.' when 'failed' then 'Ödeme işlemi tamamlanamadı. Finans ekranından durumu takip edebilirsiniz.' else 'Bekleyen çekim talebi iptal edildi.' end,'/account',jsonb_build_object('payoutId',row.id,'status',next_status,'amountMinor',row.amount_minor,'currency',row.currency)); end if;
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('producer_payout',row.id,'producer_payout.'||next_status,jsonb_build_object('payout_id',row.id,'producer_id',row.producer_id,'status',next_status,'channel',row.channel,'actor_user_id',uid));
  return jsonb_build_object('id',row.id,'producerId',row.producer_id,'currency',row.currency,'amountMinor',row.amount_minor,'status',row.status,'channel',row.channel,'provider',row.provider,'providerReference',row.provider_reference,'processedAt',row.processed_at);
end;
$$;
revoke all on function private.super_admin_update_producer_payout_v2(uuid,text,text,text) from public,anon;
grant execute on function private.super_admin_update_producer_payout_v2(uuid,text,text,text) to authenticated;
create or replace function public.super_admin_update_producer_payout_v2(p_payout_id uuid,p_status text,p_reference text default null,p_note text default null) returns jsonb language sql security invoker set search_path='' as $$select private.super_admin_update_producer_payout_v2(p_payout_id,p_status,p_reference,p_note);$$;
revoke all on function public.super_admin_update_producer_payout_v2(uuid,text,text,text) from public,anon;
grant execute on function public.super_admin_update_producer_payout_v2(uuid,text,text,text) to authenticated;

create or replace function private.record_provider_payouts_on_settlement_release_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='released' and (tg_op='INSERT' or old.status is distinct from 'released') then
    insert into private.producer_payouts(producer_id,currency,amount_minor,status,provider,created_by,processed_by,scheduled_at,requested_at,channel,request_source,source_order_id,destination_application_id,destination_account_holder,destination_iban_ciphertext,provider_settlement_released_at)
    select le.producer_id,o.currency,sum(le.producer_net_minor)::bigint,'processing','iyzico',new.released_by,new.released_by,coalesce(new.released_at,timezone('utc',now())),coalesce(new.requested_at,new.released_at,timezone('utc',now())),'provider_marketplace','super_admin_settlement',new.order_id,p.application_id,k.bank_account_holder,k.iban_ciphertext,coalesce(new.released_at,timezone('utc',now())) from private.producer_ledger_entries le join public.orders o on o.id=le.order_id join public.producers p on p.id=le.producer_id left join private.producer_application_kyc k on k.application_id=p.application_id where le.order_id=new.order_id and le.entry_type='sale' and le.availability_status='available' group by le.producer_id,o.currency,p.application_id,k.bank_account_holder,k.iban_ciphertext on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.record_provider_payouts_on_settlement_release_v1() from public,anon,authenticated;
drop trigger if exists record_provider_payouts_on_settlement_release on private.order_settlement_releases;
create trigger record_provider_payouts_on_settlement_release after insert or update of status on private.order_settlement_releases for each row execute function private.record_provider_payouts_on_settlement_release_v1();

insert into private.producer_payouts(producer_id,currency,amount_minor,status,provider,created_by,processed_by,scheduled_at,requested_at,channel,request_source,source_order_id,destination_application_id,destination_account_holder,destination_iban_ciphertext,provider_settlement_released_at)
select le.producer_id,o.currency,sum(le.producer_net_minor)::bigint,'processing','iyzico',rr.released_by,rr.released_by,coalesce(rr.released_at,rr.updated_at),coalesce(rr.requested_at,rr.released_at,rr.updated_at),'provider_marketplace','super_admin_settlement',rr.order_id,p.application_id,k.bank_account_holder,k.iban_ciphertext,coalesce(rr.released_at,rr.updated_at) from private.order_settlement_releases rr join public.orders o on o.id=rr.order_id join private.producer_ledger_entries le on le.order_id=rr.order_id join public.producers p on p.id=le.producer_id left join private.producer_application_kyc k on k.application_id=p.application_id where rr.status='released' and le.entry_type='sale' and le.availability_status='available' group by rr.order_id,le.producer_id,o.currency,rr.released_by,rr.released_at,rr.requested_at,rr.updated_at,p.application_id,k.bank_account_holder,k.iban_ciphertext on conflict do nothing;

revoke all on function public.admin_schedule_producer_payout_v1(uuid,text,bigint,text) from authenticated;
revoke all on function public.admin_update_producer_payout_v1(uuid,text,text,text,text) from authenticated;
revoke all on function private.admin_schedule_producer_payout_v1(uuid,text,bigint,text) from authenticated;
revoke all on function private.admin_update_producer_payout_v1(uuid,text,text,text,text) from authenticated;

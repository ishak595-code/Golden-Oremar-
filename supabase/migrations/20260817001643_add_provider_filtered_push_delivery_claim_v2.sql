create or replace function private.claim_push_deliveries_v2(
  p_limit integer,
  p_worker_id text,
  p_providers text[]
)
returns table(
  delivery_id bigint,
  provider text,
  platform text,
  environment text,
  push_token text,
  title text,
  body text,
  action_url text,
  metadata jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_providers text[];
begin
  if p_limit not between 1 and 500
     or char_length(btrim(coalesce(p_worker_id,''))) not between 2 and 120 then
    raise exception 'invalid_push_worker_request' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct lower(btrim(value))), array[]::text[])
    into normalized_providers
  from unnest(coalesce(p_providers, array[]::text[])) value
  where lower(btrim(value)) in ('fcm','apns');

  if coalesce(cardinality(normalized_providers),0)=0 then
    raise exception 'push_provider_required' using errcode='22023';
  end if;

  return query
  with claimed as (
    select delivery.id
    from private.push_deliveries delivery
    join private.device_push_tokens token
      on token.id=delivery.device_token_id
     and token.disabled_at is null
     and lower(token.provider)=any(normalized_providers)
    where delivery.status='pending'
      and delivery.available_at<=timezone('utc',now())
      and delivery.attempts<5
    order by delivery.id
    for update of delivery skip locked
    limit p_limit
  ), updated as (
    update private.push_deliveries delivery
       set status='processing',
           attempts=attempts+1,
           locked_at=timezone('utc',now()),
           locked_by=btrim(p_worker_id),
           updated_at=timezone('utc',now())
      from claimed
     where delivery.id=claimed.id
    returning delivery.*
  )
  select updated.id,
         token.provider,
         token.platform,
         token.environment,
         extensions.pgp_sym_decrypt(token.token_ciphertext,private.get_push_token_key_v1())::text,
         notification.title,
         notification.message,
         notification.action_url,
         notification.metadata
    from updated
    join private.device_push_tokens token on token.id=updated.device_token_id
    join public.notifications notification on notification.id=updated.notification_id;
end;
$$;

create or replace function public.claim_push_deliveries_v2(
  p_limit integer,
  p_worker_id text,
  p_providers text[]
)
returns table(
  delivery_id bigint,
  provider text,
  platform text,
  environment text,
  push_token text,
  title text,
  body text,
  action_url text,
  metadata jsonb
)
language sql
set search_path = ''
as $$
  select * from private.claim_push_deliveries_v2(p_limit,p_worker_id,p_providers);
$$;

revoke all on function public.claim_push_deliveries_v2(integer,text,text[]) from public, anon, authenticated;
grant execute on function public.claim_push_deliveries_v2(integer,text,text[]) to service_role;

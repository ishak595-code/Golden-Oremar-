-- Drift closure: producer KYC encryption/decryption (vault-key backed), the
-- customer cart get-or-create helper, and the order inventory release routine.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, byte-for-byte verified by md5 against the live database, not
-- hand-reconstructed. Applying is a no-op against live.

CREATE OR REPLACE FUNCTION private.decrypt_producer_kyc(value text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when value is null then null
    else extensions.pgp_sym_decrypt(
      decode(value, 'base64'),
      private.producer_kyc_key()
    )
  end;
$function$
;

CREATE OR REPLACE FUNCTION private.encrypt_producer_kyc(value text)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when nullif(btrim(value), '') is null then null
    else encode(
      extensions.pgp_sym_encrypt(
        btrim(value),
        private.producer_kyc_key(),
        'cipher-algo=aes256, compress-algo=1'
      ),
      'base64'
    )
  end;
$function$
;

CREATE OR REPLACE FUNCTION private.get_or_create_customer_cart_v1(p_user_id uuid)
 RETURNS carts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cart_row public.carts%rowtype;
begin
  if p_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cart:'||p_user_id::text,85031));

  update public.carts
  set status='abandoned',updated_at=timezone('utc',now())
  where user_id=p_user_id and status='active' and expires_at is not null and expires_at<=timezone('utc',now());

  select * into cart_row from public.carts where user_id=p_user_id and status='active' for update;
  if cart_row.id is null then
    insert into public.carts(user_id,status,currency,expires_at)
    values(p_user_id,'active','TRY',timezone('utc',now())+interval '30 days')
    returning * into cart_row;
  end if;
  return cart_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.release_order_inventory(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  reservation record;
  movement_id bigint;
begin
  for reservation in
    select
      item.variant_id,
      sum(item.quantity)::integer as quantity
    from public.order_items item
    join public.products product on product.id = item.product_id
    where item.order_id = p_order_id
      and item.variant_id is not null
      and product.stock_mode in ('tracked', 'seasonal')
    group by item.variant_id
    order by item.variant_id
  loop
    movement_id := null;

    insert into private.inventory_movements(
      variant_id,
      movement_type,
      quantity_delta,
      reference_type,
      reference_id,
      reason,
      idempotency_key,
      actor_user_id
    ) values (
      reservation.variant_id,
      'release',
      reservation.quantity,
      'order',
      p_order_id,
      'Unpaid order stock reservation released',
      'order:' || p_order_id::text || ':release:' || reservation.variant_id::text,
      (select auth.uid())
    )
    on conflict (idempotency_key) do nothing
    returning id into movement_id;

    if movement_id is not null then
      update public.product_inventory inventory
      set reserved_quantity = greatest(0, inventory.reserved_quantity - reservation.quantity),
          version = inventory.version + 1,
          updated_at = timezone('utc', now())
      where inventory.variant_id = reservation.variant_id;
    end if;
  end loop;
end;
$function$
;

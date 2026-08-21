alter table private.order_gifts add column if not exists occasion text not null default 'just_because';
alter table private.order_gifts add column if not exists presentation_style text not null default 'oremar_gold';
alter table private.order_gifts add column if not exists card_title text;

alter table private.order_gifts drop constraint if exists order_gifts_occasion_check;
alter table private.order_gifts add constraint order_gifts_occasion_check check (occasion in ('just_because','birthday','love','thank_you','celebration','get_well','new_home','new_baby'));
alter table private.order_gifts drop constraint if exists order_gifts_presentation_style_check;
alter table private.order_gifts add constraint order_gifts_presentation_style_check check (presentation_style in ('oremar_gold','mountain_warmth','minimal_elegance'));
alter table private.order_gifts drop constraint if exists order_gifts_card_title_check;
alter table private.order_gifts add constraint order_gifts_card_title_check check (card_title is null or (char_length(btrim(card_title)) between 2 and 100 and card_title !~ '[[:cntrl:]]'));

create or replace function private.create_customer_order_v4(p_items jsonb, p_shipping_address jsonb, p_customer_note text, p_coupon_code text, p_gift jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  caller_id uuid:=auth.uid();
  base jsonb;
  order_id uuid;
  recipient_name text;
  recipient_phone text;
  recipient_email text;
  gift_message text;
  sender_name text;
  hide_price boolean:=true;
  country_code text;
  occasion_value text:='just_because';
  presentation_style_value text:='oremar_gold';
  card_title_value text;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_shipping_address is null or jsonb_typeof(p_shipping_address)<>'object' then raise exception 'invalid_shipping_address' using errcode='22023'; end if;
  country_code:=upper(btrim(coalesce(p_shipping_address->>'country_code',p_shipping_address->>'countryCode','')));
  if country_code !~ '^[A-Z]{2}$' then raise exception 'invalid_shipping_country' using errcode='22023'; end if;
  if p_gift is not null and jsonb_typeof(p_gift)<>'object' then raise exception 'invalid_gift_payload' using errcode='22023'; end if;
  if p_gift is not null then
    recipient_name:=btrim(coalesce(p_gift->>'recipientName',p_gift->>'recipient_name',''));
    recipient_phone:=nullif(btrim(coalesce(p_gift->>'recipientPhone',p_gift->>'recipient_phone','')),'');
    recipient_email:=nullif(lower(btrim(coalesce(p_gift->>'recipientEmail',p_gift->>'recipient_email',''))),'');
    gift_message:=nullif(btrim(coalesce(p_gift->>'message',p_gift->>'giftMessage','')),'');
    sender_name:=nullif(btrim(coalesce(p_gift->>'senderName','')),'');
    occasion_value:=lower(btrim(coalesce(p_gift->>'occasion','just_because')));
    presentation_style_value:=lower(btrim(coalesce(p_gift->>'presentationStyle','oremar_gold')));
    card_title_value:=nullif(btrim(coalesce(p_gift->>'cardTitle','')),'');
    if p_gift ? 'hidePrice' and jsonb_typeof(p_gift->'hidePrice')<>'boolean' then raise exception 'invalid_gift_hide_price' using errcode='22023'; end if;
    hide_price:=coalesce((p_gift->>'hidePrice')::boolean,true);
    if char_length(recipient_name) not between 2 and 120 or recipient_name ~ '[[:cntrl:]]' then raise exception 'gift_recipient_name_required' using errcode='22023'; end if;
    if recipient_phone is not null and (char_length(recipient_phone)>40 or recipient_phone ~ '[[:cntrl:]]' or char_length(regexp_replace(recipient_phone,'[^0-9]','','g')) not between 7 and 20) then raise exception 'invalid_gift_recipient_phone' using errcode='22023'; end if;
    if recipient_email is not null and (char_length(recipient_email)>254 or recipient_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'invalid_gift_recipient_email' using errcode='22023'; end if;
    if gift_message is not null and char_length(gift_message)>1000 then raise exception 'gift_message_too_long' using errcode='22023'; end if;
    if sender_name is not null and (char_length(sender_name)>120 or sender_name ~ '[[:cntrl:]]') then raise exception 'gift_sender_name_too_long' using errcode='22023'; end if;
    if occasion_value not in ('just_because','birthday','love','thank_you','celebration','get_well','new_home','new_baby') then raise exception 'invalid_gift_occasion' using errcode='22023'; end if;
    if presentation_style_value not in ('oremar_gold','mountain_warmth','minimal_elegance') then raise exception 'invalid_gift_presentation_style' using errcode='22023'; end if;
    if card_title_value is not null and (char_length(card_title_value) not between 2 and 100 or card_title_value ~ '[[:cntrl:]]') then raise exception 'invalid_gift_card_title' using errcode='22023'; end if;
  end if;
  base:=private.create_customer_order_v3(p_items,p_shipping_address,p_customer_note,p_coupon_code,p_idempotency_key);
  order_id:=(base->>'orderId')::uuid;
  if p_gift is not null then
    insert into private.order_gifts(order_id,user_id,recipient_name,recipient_phone,recipient_email,gift_message,sender_name,hide_price,occasion,presentation_style,card_title)
    values(order_id,caller_id,recipient_name,recipient_phone,recipient_email,gift_message,sender_name,hide_price,occasion_value,presentation_style_value,card_title_value)
    on conflict(order_id) do update set
      recipient_name=excluded.recipient_name,recipient_phone=excluded.recipient_phone,recipient_email=excluded.recipient_email,
      gift_message=excluded.gift_message,sender_name=excluded.sender_name,hide_price=excluded.hide_price,occasion=excluded.occasion,
      presentation_style=excluded.presentation_style,card_title=excluded.card_title,updated_at=timezone('utc',now());
  end if;
  return base||jsonb_build_object('gift',p_gift is not null,'giftOccasion',case when p_gift is null then null else occasion_value end,'giftPresentationStyle',case when p_gift is null then null else presentation_style_value end);
end;
$function$;

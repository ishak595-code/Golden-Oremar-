create or replace function private.upsert_customer_address_v2_impl(
  p_address_id uuid,
  p_label text,
  p_recipient_name text,
  p_phone text,
  p_country_code text,
  p_administrative_area text,
  p_city text,
  p_locality text,
  p_address_line1 text,
  p_address_line2 text,
  p_postal_code text,
  p_delivery_notes text,
  p_is_default boolean
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  caller_id uuid:=auth.uid();
  address_row public.addresses%rowtype;
  make_default boolean;
  phone_value text:=btrim(coalesce(p_phone,''));
  phone_digits text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  country_value text:=upper(btrim(coalesce(p_country_code,'')));
  admin_value text:=nullif(btrim(coalesce(p_administrative_area,'')),'');
  city_value text:=btrim(coalesce(p_city,''));
  locality_value text:=nullif(btrim(coalesce(p_locality,'')),'');
  line1_value text:=btrim(coalesce(p_address_line1,''));
  line2_value text:=nullif(btrim(coalesce(p_address_line2,'')),'');
  merged_line text;
  province_value text;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=caller_id and status='active' and deleted_at is null) then raise exception 'active_profile_required' using errcode='42501'; end if;

  if char_length(btrim(coalesce(p_label,''))) not between 1 and 60
     or char_length(btrim(coalesce(p_recipient_name,''))) not between 2 and 120
     or char_length(phone_value)>40
     or char_length(phone_digits) not between 7 and 20
     or country_value !~ '^[A-Z]{2}$'
     or (admin_value is not null and char_length(admin_value)>120)
     or char_length(city_value) not between 1 and 120
     or (locality_value is not null and char_length(locality_value)>160)
     or char_length(line1_value) not between 5 and 1000
     or (line2_value is not null and char_length(line2_value)>500)
     or char_length(coalesce(p_postal_code,''))>30
     or char_length(coalesce(p_delivery_notes,''))>500
     or btrim(coalesce(p_label,'')) ~ '[[:cntrl:]]'
     or btrim(coalesce(p_recipient_name,'')) ~ '[[:cntrl:]]'
     or phone_value ~ '[[:cntrl:]]'
     or city_value ~ '[[:cntrl:]]'
     or line1_value ~ '[[:cntrl:]]'
  then raise exception 'invalid_address' using errcode='22023'; end if;

  if admin_value is not null and admin_value ~ '[[:cntrl:]]' then raise exception 'invalid_address' using errcode='22023'; end if;
  if locality_value is not null and locality_value ~ '[[:cntrl:]]' then raise exception 'invalid_address' using errcode='22023'; end if;
  if line2_value is not null and line2_value ~ '[[:cntrl:]]' then raise exception 'invalid_address' using errcode='22023'; end if;

  merged_line:=line1_value;
  if line2_value is not null then merged_line:=merged_line||E'\n'||line2_value; end if;
  if char_length(merged_line)>1000 then raise exception 'invalid_address' using errcode='22023'; end if;
  province_value:=coalesce(admin_value,city_value);

  perform pg_advisory_xact_lock(hashtextextended(caller_id::text,85027));
  if p_address_id is not null and not exists(select 1 from public.addresses where id=p_address_id and user_id=caller_id and deleted_at is null) then raise exception 'address_not_found' using errcode='P0002'; end if;
  if p_address_id is null and (select count(*) from public.addresses where user_id=caller_id and deleted_at is null)>=20 then raise exception 'address_limit_exceeded' using errcode='54000'; end if;

  make_default:=coalesce(p_is_default,false) or not exists(select 1 from public.addresses where user_id=caller_id and deleted_at is null and is_default=true);
  if make_default then update public.addresses set is_default=false,updated_at=timezone('utc',now()) where user_id=caller_id and deleted_at is null and is_default=true; end if;

  if p_address_id is null then
    insert into public.addresses(user_id,label,recipient_name,phone,country_code,province,district,neighborhood,address_line,postal_code,delivery_notes,is_default)
    values(caller_id,btrim(p_label),btrim(p_recipient_name),phone_value,country_value,province_value,city_value,locality_value,merged_line,nullif(btrim(coalesce(p_postal_code,'')),''),nullif(btrim(coalesce(p_delivery_notes,'')),''),make_default)
    returning * into address_row;
  else
    update public.addresses
    set label=btrim(p_label),recipient_name=btrim(p_recipient_name),phone=phone_value,country_code=country_value,province=province_value,district=city_value,
        neighborhood=locality_value,address_line=merged_line,postal_code=nullif(btrim(coalesce(p_postal_code,'')),''),delivery_notes=nullif(btrim(coalesce(p_delivery_notes,'')),''),
        is_default=make_default,updated_at=timezone('utc',now())
    where id=p_address_id and user_id=caller_id and deleted_at is null
    returning * into address_row;
  end if;
  return to_jsonb(address_row);
end;
$function$;

create or replace function public.upsert_customer_address_v2(
  p_address_id uuid,
  p_label text,
  p_recipient_name text,
  p_phone text,
  p_country_code text,
  p_administrative_area text,
  p_city text,
  p_locality text,
  p_address_line1 text,
  p_address_line2 text,
  p_postal_code text,
  p_delivery_notes text,
  p_is_default boolean
)
returns jsonb
language sql
set search_path to ''
as $function$
  select private.upsert_customer_address_v2_impl(p_address_id,p_label,p_recipient_name,p_phone,p_country_code,p_administrative_area,p_city,p_locality,p_address_line1,p_address_line2,p_postal_code,p_delivery_notes,p_is_default);
$function$;
revoke all on function public.upsert_customer_address_v2(uuid,text,text,text,text,text,text,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.upsert_customer_address_v2(uuid,text,text,text,text,text,text,text,text,text,text,text,boolean) to authenticated;

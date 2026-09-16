-- Drift closure: core helper functions (hashing, slugify, identity validation,
-- role checks, reference resolution) that exist live in the "golden-oremar"
-- project but were never captured in a versioned migration. Bodies below are
-- verbatim pg_get_functiondef output from the live database, not
-- hand-reconstructed. Applying is a no-op against live; this only makes the
-- repository able to rebuild the schema from scratch.

CREATE OR REPLACE FUNCTION private.get_push_token_key_v1()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare key_value text;
begin
  select operational_config->>'pushTokenKey' into key_value from private.brand_secrets where brand_slug='golden-oremar';
  if char_length(coalesce(key_value,''))<32 then raise exception 'push_token_key_missing' using errcode='55000'; end if;
  return key_value;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.hash_coupon_code_v1(p_code text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  normalized text := private.normalize_coupon_code_v1(p_code);
  pepper text;
begin
  select secret.operational_config->>'couponPepper'
  into pepper
  from private.brand_secrets secret
  where secret.brand_slug='golden-oremar';

  if char_length(coalesce(pepper,'')) < 32 then
    raise exception 'coupon_secret_missing' using errcode='55000';
  end if;

  return encode(
    extensions.hmac(
      convert_to(normalized,'UTF8'),
      convert_to(pepper,'UTF8'),
      'sha256'
    ),
    'hex'
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.hash_push_token_v1(p_token text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare token_value text:=btrim(coalesce(p_token,''));
begin
  if char_length(token_value) not between 20 and 4096 then raise exception 'invalid_push_token' using errcode='22023'; end if;
  return encode(extensions.hmac(convert_to(token_value,'UTF8'),convert_to(private.get_push_token_key_v1(),'UTF8'),'sha256'),'hex');
end;
$function$
;

CREATE OR REPLACE FUNCTION private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    private.has_role('admin')
    or private.has_role('super_admin');
$function$
;

CREATE OR REPLACE FUNCTION private.is_valid_tckn(value text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  digits integer[];
begin
  if value is null or value !~ '^[1-9][0-9]{10}$' then
    return false;
  end if;

  digits := array[
    substring(value, 1, 1)::integer,
    substring(value, 2, 1)::integer,
    substring(value, 3, 1)::integer,
    substring(value, 4, 1)::integer,
    substring(value, 5, 1)::integer,
    substring(value, 6, 1)::integer,
    substring(value, 7, 1)::integer,
    substring(value, 8, 1)::integer,
    substring(value, 9, 1)::integer,
    substring(value, 10, 1)::integer,
    substring(value, 11, 1)::integer
  ];

  return digits[10] = mod(
      7 * (digits[1] + digits[3] + digits[5] + digits[7] + digits[9])
      - (digits[2] + digits[4] + digits[6] + digits[8]) + 100,
      10
    )
    and digits[11] = mod(
      digits[1] + digits[2] + digits[3] + digits[4] + digits[5]
      + digits[6] + digits[7] + digits[8] + digits[9] + digits[10],
      10
    );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.resolve_product_id_v1(p_reference text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select product.id
  from public.products product
  where product.deleted_at is null
    and (
      product.id::text = btrim(coalesce(p_reference, ''))
      or product.legacy_id = btrim(coalesce(p_reference, ''))
      or product.slug = btrim(coalesce(p_reference, ''))
    )
  order by product.created_at
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION private.slugify_tr_v1(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select trim(both '-' from regexp_replace(
    translate(lower(coalesce(p_value, '')), 'çğıöşüâîû', 'cgiosuaiu'),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
$function$
;

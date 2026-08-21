create or replace function private.brand_hex_luminance_v1(p_hex text)
returns double precision
language plpgsql
immutable
strict
set search_path to ''
as $$
declare
  raw text := upper(btrim(p_hex));
  bytes bytea;
  r double precision;
  g double precision;
  b double precision;
  lr double precision;
  lg double precision;
  lb double precision;
begin
  if raw !~ '^#[0-9A-F]{6}$' then
    raise exception 'invalid_brand_hex_color' using errcode='22023';
  end if;
  bytes := decode(substr(raw,2,6),'hex');
  r := get_byte(bytes,0) / 255.0;
  g := get_byte(bytes,1) / 255.0;
  b := get_byte(bytes,2) / 255.0;
  lr := case when r <= 0.03928 then r / 12.92 else power((r + 0.055) / 1.055, 2.4) end;
  lg := case when g <= 0.03928 then g / 12.92 else power((g + 0.055) / 1.055, 2.4) end;
  lb := case when b <= 0.03928 then b / 12.92 else power((b + 0.055) / 1.055, 2.4) end;
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
end;
$$;

create or replace function private.brand_contrast_ratio_v1(p_foreground text,p_background text)
returns double precision
language sql
immutable
strict
set search_path to ''
as $$
  with l as (
    select private.brand_hex_luminance_v1(p_foreground) as a,
           private.brand_hex_luminance_v1(p_background) as b
  )
  select (greatest(a,b)+0.05)/(least(a,b)+0.05) from l;
$$;

create or replace function private.normalize_brand_appearance_v1(p_appearance jsonb)
returns jsonb
language plpgsql
immutable
set search_path to ''
as $$
declare
  default_theme text;
  color_scheme text;
  tokens jsonb;
  normalized_tokens jsonb;
  required_keys constant text[] := array['background','card','text','muted','border','brandGold','brandGreen','brandEarth','onGold','onGreen'];
  key text;
  value text;
begin
  if p_appearance is null or jsonb_typeof(p_appearance)<>'object' then
    raise exception 'invalid_brand_appearance' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_object_keys(p_appearance) k where k not in ('defaultTheme','colorScheme','tokens')) then
    raise exception 'unsupported_brand_appearance_setting' using errcode='22023';
  end if;
  default_theme := lower(btrim(coalesce(p_appearance->>'defaultTheme','')));
  if default_theme not in ('custom','light','dark','emerald','ruby','champagne') then
    raise exception 'invalid_brand_default_theme' using errcode='22023';
  end if;
  color_scheme := lower(btrim(coalesce(p_appearance->>'colorScheme','')));
  if color_scheme not in ('light','dark') then
    raise exception 'invalid_brand_color_scheme' using errcode='22023';
  end if;
  tokens := p_appearance->'tokens';
  if jsonb_typeof(tokens)<>'object' then
    raise exception 'invalid_brand_appearance_tokens' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_object_keys(tokens) k where not (k=any(required_keys))) then
    raise exception 'unsupported_brand_appearance_token' using errcode='22023';
  end if;
  foreach key in array required_keys loop
    if not (tokens ? key) then raise exception 'missing_brand_appearance_token:%',key using errcode='22023'; end if;
    value := upper(btrim(coalesce(tokens->>key,'')));
    if value !~ '^#[0-9A-F]{6}$' then raise exception 'invalid_brand_appearance_token:%',key using errcode='22023'; end if;
    normalized_tokens := coalesce(normalized_tokens,'{}'::jsonb) || jsonb_build_object(key,value);
  end loop;
  if private.brand_contrast_ratio_v1(normalized_tokens->>'text',normalized_tokens->>'background') < 4.5 then
    raise exception 'insufficient_brand_text_contrast' using errcode='22023';
  end if;
  if private.brand_contrast_ratio_v1(normalized_tokens->>'onGreen',normalized_tokens->>'brandGreen') < 4.5 then
    raise exception 'insufficient_brand_green_contrast' using errcode='22023';
  end if;
  if private.brand_contrast_ratio_v1(normalized_tokens->>'onGold',normalized_tokens->>'brandGold') < 4.5 then
    raise exception 'insufficient_brand_gold_contrast' using errcode='22023';
  end if;
  return jsonb_build_object('defaultTheme',default_theme,'colorScheme',color_scheme,'tokens',normalized_tokens);
end;
$$;

create or replace function private.get_public_brand_appearance_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  raw jsonb;
  normalized jsonb;
begin
  select public_config->'appearance' into raw from public.brand_settings where slug='golden-oremar';
  if raw is null then
    raw := jsonb_build_object(
      'defaultTheme','custom',
      'colorScheme','light',
      'tokens',jsonb_build_object(
        'background','#F7F8F6','card','#FFFFFF','text','#14261C','muted','#52675C','border','#D7E0DA',
        'brandGold','#8A6810','brandGreen','#145A32','brandEarth','#7A431F','onGold','#FFFFFF','onGreen','#FFFFFF'
      )
    );
  end if;
  normalized := private.normalize_brand_appearance_v1(raw);
  return normalized;
end;
$$;

create or replace function private.super_admin_get_brand_appearance_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then
    raise exception 'super_admin_required' using errcode='42501';
  end if;
  return private.get_public_brand_appearance_v1();
end;
$$;

create or replace function private.super_admin_update_brand_appearance_v1(p_appearance jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  normalized jsonb;
  updated_at timestamptz;
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then
    raise exception 'super_admin_required' using errcode='42501';
  end if;
  normalized := private.normalize_brand_appearance_v1(p_appearance);
  update public.brand_settings
  set public_config=jsonb_set(coalesce(public_config,'{}'::jsonb),'{appearance}',normalized,true)
  where slug='golden-oremar'
  returning brand_settings.updated_at into updated_at;
  if not found then raise exception 'brand_configuration_not_found' using errcode='P0002'; end if;
  return normalized || jsonb_build_object('updatedAt',updated_at);
end;
$$;

update public.brand_settings
set public_config=jsonb_set(
  coalesce(public_config,'{}'::jsonb),
  '{appearance}',
  private.normalize_brand_appearance_v1(coalesce(public_config->'appearance',jsonb_build_object(
    'defaultTheme','custom','colorScheme','light','tokens',jsonb_build_object(
      'background','#F7F8F6','card','#FFFFFF','text','#14261C','muted','#52675C','border','#D7E0DA',
      'brandGold','#8A6810','brandGreen','#145A32','brandEarth','#7A431F','onGold','#FFFFFF','onGreen','#FFFFFF'
    )
  ))),
  true
)
where slug='golden-oremar';

create or replace function public.get_public_brand_appearance_v1()
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $$ select private.get_public_brand_appearance_v1(); $$;

create or replace function public.super_admin_get_brand_appearance_v1()
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $$ select private.super_admin_get_brand_appearance_v1(); $$;

create or replace function public.super_admin_update_brand_appearance_v1(p_appearance jsonb)
returns jsonb
language sql
security invoker
set search_path to ''
as $$ select private.super_admin_update_brand_appearance_v1(p_appearance); $$;

revoke all on function private.brand_hex_luminance_v1(text) from public,anon,authenticated;
revoke all on function private.brand_contrast_ratio_v1(text,text) from public,anon,authenticated;
revoke all on function private.normalize_brand_appearance_v1(jsonb) from public,anon,authenticated;
revoke all on function private.get_public_brand_appearance_v1() from public,anon,authenticated;
revoke all on function private.super_admin_get_brand_appearance_v1() from public,anon,authenticated;
revoke all on function private.super_admin_update_brand_appearance_v1(jsonb) from public,anon,authenticated;
grant execute on function private.get_public_brand_appearance_v1() to anon,authenticated;
grant execute on function private.super_admin_get_brand_appearance_v1() to authenticated;
grant execute on function private.super_admin_update_brand_appearance_v1(jsonb) to authenticated;

revoke all on function public.get_public_brand_appearance_v1() from public,anon,authenticated;
revoke all on function public.super_admin_get_brand_appearance_v1() from public,anon,authenticated;
revoke all on function public.super_admin_update_brand_appearance_v1(jsonb) from public,anon,authenticated;
grant execute on function public.get_public_brand_appearance_v1() to anon,authenticated;
grant execute on function public.super_admin_get_brand_appearance_v1() to authenticated;
grant execute on function public.super_admin_update_brand_appearance_v1(jsonb) to authenticated;
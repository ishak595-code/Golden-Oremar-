create or replace function private.normalize_brand_appearance_v1(p_appearance jsonb)
returns jsonb
language plpgsql
immutable
set search_path to ''
as $function$
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
  if private.brand_contrast_ratio_v1(normalized_tokens->>'muted',normalized_tokens->>'background') < 4.5 then
    raise exception 'insufficient_brand_muted_contrast' using errcode='22023';
  end if;
  if private.brand_contrast_ratio_v1(normalized_tokens->>'text',normalized_tokens->>'card') < 4.5 then
    raise exception 'insufficient_brand_card_text_contrast' using errcode='22023';
  end if;
  if private.brand_contrast_ratio_v1(normalized_tokens->>'onGreen',normalized_tokens->>'brandGreen') < 4.5 then
    raise exception 'insufficient_brand_green_contrast' using errcode='22023';
  end if;
  if private.brand_contrast_ratio_v1(normalized_tokens->>'onGold',normalized_tokens->>'brandGold') < 4.5 then
    raise exception 'insufficient_brand_gold_contrast' using errcode='22023';
  end if;
  return jsonb_build_object('defaultTheme',default_theme,'colorScheme',color_scheme,'tokens',normalized_tokens);
end;
$function$;

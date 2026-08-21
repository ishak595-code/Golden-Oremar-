create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  raw_name text;
  raw_phone text;
  raw_locale text;
begin
  raw_name := btrim(coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Yeni Üye'
  ));
  raw_name := regexp_replace(raw_name, '[[:cntrl:]]', ' ', 'g');
  raw_name := regexp_replace(raw_name, '[[:space:]]+', ' ', 'g');
  raw_name := left(btrim(raw_name), 120);
  if char_length(raw_name) < 2 then
    raw_name := 'Yeni Üye';
  end if;

  raw_phone := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  if raw_phone is not null then
    if char_length(raw_phone) > 40
       or raw_phone ~ '[[:cntrl:]]'
       or char_length(regexp_replace(raw_phone, '[^0-9]', '', 'g')) not between 7 and 20 then
      raw_phone := null;
    end if;
  end if;

  raw_locale := lower(split_part(replace(coalesce(new.raw_user_meta_data ->> 'locale', 'tr'), '_', '-'), '-', 1));
  if raw_locale not in ('tr','en','de','fr','ku','ar') then
    raw_locale := 'tr';
  end if;

  insert into public.profiles(id, display_name, phone, locale)
  values (new.id, raw_name, raw_phone, raw_locale)
  on conflict (id) do nothing;

  insert into private.user_roles(user_id, role)
  values (new.id, 'customer')
  on conflict (user_id, role) do nothing;

  return new;
end;
$function$;

create table if not exists private.user_app_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text null check (theme is null or theme in ('light','dark','emerald','ruby','champagne')),
  notification_sound text not null default 'oremar-drop' check (notification_sound in ('oremar-drop','mountain-birds','dawn-rooster','partridge-call','highland-bell')),
  notification_sound_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now())
);

revoke all on table private.user_app_preferences from public,anon,authenticated;

create or replace function private.get_my_app_preferences_impl_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  row_value private.user_app_preferences%rowtype;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=uid and p.status='active' and p.deleted_at is null) then raise exception 'active_profile_required' using errcode='42501'; end if;
  select * into row_value from private.user_app_preferences p where p.user_id=uid;
  if row_value.user_id is null then
    return jsonb_build_object('theme',null,'notificationSound','oremar-drop','notificationSoundEnabled',true,'updatedAt',null);
  end if;
  return jsonb_build_object('theme',row_value.theme,'notificationSound',row_value.notification_sound,'notificationSoundEnabled',row_value.notification_sound_enabled,'updatedAt',row_value.updated_at);
end;
$$;

create or replace function private.update_my_app_preferences_impl_v1(
  p_theme text default null,
  p_notification_sound text default null,
  p_notification_sound_enabled boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  normalized_theme text:=nullif(lower(btrim(coalesce(p_theme,''))),'');
  normalized_sound text:=nullif(lower(btrim(coalesce(p_notification_sound,''))),'');
  row_value private.user_app_preferences%rowtype;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=uid and p.status='active' and p.deleted_at is null) then raise exception 'active_profile_required' using errcode='42501'; end if;
  if normalized_theme is not null and normalized_theme not in ('light','dark','emerald','ruby','champagne') then raise exception 'invalid_app_theme' using errcode='22023'; end if;
  if normalized_sound is not null and normalized_sound not in ('oremar-drop','mountain-birds','dawn-rooster','partridge-call','highland-bell') then raise exception 'invalid_notification_sound' using errcode='22023'; end if;
  if normalized_theme is null and normalized_sound is null and p_notification_sound_enabled is null then raise exception 'app_preference_update_required' using errcode='22023'; end if;

  insert into private.user_app_preferences(user_id,theme,notification_sound,notification_sound_enabled)
  values(uid,normalized_theme,coalesce(normalized_sound,'oremar-drop'),coalesce(p_notification_sound_enabled,true))
  on conflict(user_id) do update set
    theme=coalesce(normalized_theme,private.user_app_preferences.theme),
    notification_sound=coalesce(normalized_sound,private.user_app_preferences.notification_sound),
    notification_sound_enabled=coalesce(p_notification_sound_enabled,private.user_app_preferences.notification_sound_enabled),
    updated_at=timezone('utc',now())
  returning * into row_value;

  return jsonb_build_object('theme',row_value.theme,'notificationSound',row_value.notification_sound,'notificationSoundEnabled',row_value.notification_sound_enabled,'updatedAt',row_value.updated_at);
end;
$$;

revoke all on function private.get_my_app_preferences_impl_v1() from public,anon;
revoke all on function private.update_my_app_preferences_impl_v1(text,text,boolean) from public,anon;
grant execute on function private.get_my_app_preferences_impl_v1() to authenticated;
grant execute on function private.update_my_app_preferences_impl_v1(text,text,boolean) to authenticated;

create or replace function public.get_my_app_preferences_v1()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.get_my_app_preferences_impl_v1(); $$;

create or replace function public.update_my_app_preferences_v1(
  p_theme text default null,
  p_notification_sound text default null,
  p_notification_sound_enabled boolean default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select private.update_my_app_preferences_impl_v1(p_theme,p_notification_sound,p_notification_sound_enabled); $$;

revoke all on function public.get_my_app_preferences_v1() from public,anon;
revoke all on function public.update_my_app_preferences_v1(text,text,boolean) from public,anon;
grant execute on function public.get_my_app_preferences_v1() to authenticated;
grant execute on function public.update_my_app_preferences_v1(text,text,boolean) to authenticated;

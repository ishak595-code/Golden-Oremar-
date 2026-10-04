-- Golden Oremar notification sounds on Android push.
-- Android notification channels have a fixed sound, so the app creates one
-- channel per Golden Oremar sound (res/raw/go_sound_*.wav) plus a silent one.
-- push-dispatch asks this function which sound each claimed delivery's
-- customer chose (private.user_app_preferences) and posts to that channel.
-- Service-role only; returns nothing but the sound choice.
create or replace function private.push_delivery_sound_preferences_v1(p_delivery_ids bigint[])
returns table(delivery_id bigint, notification_sound text, notification_sound_enabled boolean)
language sql
stable
security definer
set search_path to ''
as $$
  select delivery.id,
         coalesce(preference.notification_sound, 'oremar-drop'),
         coalesce(preference.notification_sound_enabled, true)
    from private.push_deliveries delivery
    left join private.user_app_preferences preference on preference.user_id = delivery.user_id
   where delivery.id = any(coalesce(p_delivery_ids, array[]::bigint[]))
     and delivery.status = 'processing'
   limit 500;
$$;

create or replace function public.push_delivery_sound_preferences_v1(p_delivery_ids bigint[])
returns table(delivery_id bigint, notification_sound text, notification_sound_enabled boolean)
language sql
stable
set search_path to ''
as $$
  select * from private.push_delivery_sound_preferences_v1(p_delivery_ids);
$$;

revoke all on function private.push_delivery_sound_preferences_v1(bigint[]) from public, anon, authenticated;
revoke all on function public.push_delivery_sound_preferences_v1(bigint[]) from public, anon, authenticated;
grant execute on function private.push_delivery_sound_preferences_v1(bigint[]) to service_role;
grant execute on function public.push_delivery_sound_preferences_v1(bigint[]) to service_role;

-- Exempt the Super Admin role from mandatory staff TOTP MFA.
--
-- Decision by the platform owner (2026-09-26): he is currently the only
-- administrator and the only Super Admin, and the TOTP enrolment and per-login
-- code entry are impractical for him (he is visually impaired and works with
-- assistive technology). With MFA required, the Super Admin account had no
-- verified factor and every product.update / product.publish call was refused
-- with admin_required, so no product could be saved or approved.
--
-- Scope, deliberately narrow:
--   * only 'super_admin' leaves the list; support, content_editor, operations,
--     moderator and admin still require MFA exactly as before. A team member
--     added later with any of those roles cannot skip it
--   * a user who holds super_admin AND another staff role still requires MFA,
--     because the check is "any listed role"
--   * every gate reads this one function (has_permission,
--     authorization_context_core_v1, admin_session_status_impl_v1,
--     staff_mfa_state_v1 and the MFA audit/guard functions), and each treats
--     "not required" as satisfied, so no other change is needed
--   * roles, permissions, break-glass recovery and the MFA tables are untouched;
--     reverting is re-adding 'super_admin' to the list
--
-- Compensating control: the Super Admin account is now protected by its
-- password alone. It must be long and unique, and Supabase Auth leaked-password
-- protection should be switched on.
--
-- Verified on production with the real Super Admin account and no stubs, at
-- AAL1: MFA required = false, staff MFA state = null, has_permission
-- product.update = true, product.publish = true. In a rolled-back block, the
-- same account with an added 'admin' role required MFA again (true), and a
-- follow-up read confirmed only its customer and super_admin roles remain.
-- SECURITY DEFINER and grants ({postgres=X/postgres}) unchanged.
-- md5(pg_get_functiondef) after apply: 498179301b7b899bd4fb6cdc135b3961

create or replace function private.user_requires_staff_mfa_v1(p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$ select p_user_id is not null and exists( select 1 from private.user_roles ur join public.profiles profile on profile.id=ur.user_id where ur.user_id=p_user_id and ur.role in ('support','content_editor','operations','moderator','admin') and (ur.expires_at is null or ur.expires_at>timezone('utc',now())) and profile.status='active' and profile.deleted_at is null and not coalesce((private.platform_access_block_v1(ur.user_id)->>'blocked')::boolean,false) ); $function$;

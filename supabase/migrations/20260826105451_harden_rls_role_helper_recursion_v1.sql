-- Prevent recursive RLS evaluation through public.profiles.
--
-- private.is_admin() delegates to private.has_role(). The role helper reads
-- public.profiles to ensure the account is active. Because profiles SELECT RLS
-- also calls private.is_admin(), an invoker-security has_role() can recurse when
-- evaluated from another RLS policy, including storage.objects policies.
--
-- Keep identity bound to auth.uid(), but execute the trusted predicate as the
-- postgres-owned SECURITY DEFINER function so its internal profile lookup does
-- not re-enter customer-facing RLS.

alter function private.has_role(text) security definer;

comment on function private.has_role(text) is
  'RLS-safe role predicate. SECURITY DEFINER prevents recursive public.profiles RLS evaluation while still binding identity to auth.uid().';

-- Minimal stand-in for what Supabase provides before any app migration runs.
--
-- Used only by scripts/schema/replay-migrations.mjs to rebuild the database
-- from supabase/migrations on a plain local Postgres and compare it with the
-- live catalogue. A real Supabase project (or `supabase start`) already has
-- all of this; never apply it there.

do $$ begin
  create role anon nologin noinherit;
  exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin noinherit bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create role authenticator login noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_admin superuser; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_auth_admin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_storage_admin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role dashboard_user; exception when duplicate_object then null; end $$;
do $$ begin create role pgsodium_keyiduser; exception when duplicate_object then null; end $$;
grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, service_role to postgres;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_trgm with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
alter database postgres set search_path = "$user", public, extensions;
set search_path = "$user", public, extensions;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
create type auth.factor_type as enum ('totp', 'webauthn', 'phone');
create type auth.factor_status as enum ('unverified', 'verified');
create type auth.aal_level as enum ('aal1', 'aal2', 'aal3');
create table auth.users (instance_id uuid, id uuid primary key, aud varchar, role varchar, email varchar, encrypted_password varchar, email_confirmed_at timestamptz, invited_at timestamptz, confirmation_token varchar, confirmation_sent_at timestamptz, recovery_token varchar, recovery_sent_at timestamptz, email_change_token_new varchar, email_change varchar, email_change_sent_at timestamptz, last_sign_in_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, is_super_admin boolean, created_at timestamptz, updated_at timestamptz, phone text, phone_confirmed_at timestamptz, phone_change text, phone_change_token varchar, phone_change_sent_at timestamptz, confirmed_at timestamptz, email_change_token_current varchar, email_change_confirm_status smallint, banned_until timestamptz, reauthentication_token varchar, reauthentication_sent_at timestamptz, is_sso_user boolean default false, deleted_at timestamptz, is_anonymous boolean default false);
create table auth.identities (provider_id text, user_id uuid references auth.users(id) on delete cascade, identity_data jsonb, provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz, email text, id uuid primary key default gen_random_uuid());
create table auth.mfa_factors (id uuid primary key, user_id uuid references auth.users(id) on delete cascade, friendly_name text, factor_type auth.factor_type, status auth.factor_status, created_at timestamptz, updated_at timestamptz, secret text, phone text, last_challenged_at timestamptz, web_authn_credential jsonb, web_authn_aaguid uuid, last_webauthn_challenge_data jsonb);
create table auth.mfa_challenges (id uuid primary key, factor_id uuid references auth.mfa_factors(id) on delete cascade, created_at timestamptz, verified_at timestamptz, ip_address inet, otp_code text, web_authn_session_data jsonb);
create table auth.sessions (id uuid primary key, user_id uuid references auth.users(id) on delete cascade, created_at timestamptz, updated_at timestamptz, factor_id uuid, aal auth.aal_level, not_after timestamptz, refreshed_at timestamp, user_agent text, ip inet, tag text, oauth_client_id uuid, refresh_token_hmac_key text, refresh_token_counter bigint, scopes text);
create table auth.refresh_tokens (instance_id uuid, id bigserial primary key, token varchar, user_id varchar, revoked boolean, created_at timestamptz, updated_at timestamptz, parent varchar, session_id uuid);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '')::text $$;
create function auth.email() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.email', true), '')::text $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text not null, owner uuid, created_at timestamptz default now(), updated_at timestamptz default now(), public boolean default false, avif_autodetection boolean default false, file_size_limit bigint, allowed_mime_types text[], owner_id text, type text default 'STANDARD', versioning_status text);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, created_at timestamptz default now(), updated_at timestamptz default now(), last_accessed_at timestamptz default now(), metadata jsonb, path_tokens text[] generated always as (string_to_array(name, '/')) stored, version text, owner_id text, user_metadata jsonb, archived_at timestamptz, is_delete_marker boolean, is_versioned boolean);
alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;
create function storage.foldername(name text) returns text[] language plpgsql immutable as $$ declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[1:array_length(_parts, 1) - 1]; end $$;
create function storage.filename(name text) returns text language plpgsql immutable as $$ declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[array_length(_parts, 1)]; end $$;
create function storage.extension(name text) returns text language plpgsql immutable as $$ declare _parts text[]; _filename text; begin select string_to_array(name, '/') into _parts; select _parts[array_length(_parts, 1)] into _filename; return reverse(split_part(reverse(_filename), '.', 1)); end $$;

create schema if not exists vault;
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, description text default '', secret text not null, key_id uuid, nonce bytea, created_at timestamptz default now(), updated_at timestamptz default now());
create view vault.decrypted_secrets as select id, name, description, secret, secret as decrypted_secret, key_id, nonce, created_at, updated_at from vault.secrets;
create function vault.create_secret(new_secret text, new_name text default null, new_description text default '', new_key_id uuid default null) returns uuid language sql as $$ insert into vault.secrets (secret, name, description) values (new_secret, new_name, coalesce(new_description, '')) returning id $$;
create function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null, new_description text default null, new_key_id uuid default null) returns void language sql as $$ update vault.secrets set secret = coalesce(new_secret, secret), name = coalesce(new_name, name), description = coalesce(new_description, description), updated_at = now() where id = secret_id $$;

-- pg_cron and pg_net are not in a plain Postgres: the harness skips their
-- CREATE EXTENSION and these stand-ins accept the calls.
create schema if not exists cron;
create table cron.job (jobid bigserial primary key, schedule text, command text, nodename text default 'localhost', nodeport integer default 5432, database text default current_database(), username text default current_user, active boolean default true, jobname text unique);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$ insert into cron.job (jobname, schedule, command) values (job_name, schedule, command) on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $$;
create function cron.unschedule(job_name text) returns boolean language sql as $$ with d as (delete from cron.job where jobname = job_name returning 1) select exists(select 1 from d) $$;
create function cron.unschedule(job_id bigint) returns boolean language sql as $$ with d as (delete from cron.job where jobid = job_id returning 1) select exists(select 1 from d) $$;
create schema if not exists net;
create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds integer default 5000) returns bigint language sql as $$ select 0::bigint $$;
create function net.http_get(url text, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000) returns bigint language sql as $$ select 0::bigint $$;

create schema if not exists realtime;
create schema if not exists supabase_functions;
create publication supabase_realtime;

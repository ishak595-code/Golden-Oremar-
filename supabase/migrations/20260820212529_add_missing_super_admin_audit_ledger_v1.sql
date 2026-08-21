create table if not exists private.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 3 and 160),
  target_type text not null check (char_length(target_type) between 2 and 120),
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc',now())
);

alter table private.admin_audit_logs enable row level security;
revoke all on table private.admin_audit_logs from public, anon, authenticated;
revoke all on sequence private.admin_audit_logs_id_seq from public, anon, authenticated;
grant select, insert on table private.admin_audit_logs to service_role;
grant usage, select on sequence private.admin_audit_logs_id_seq to service_role;

create index if not exists admin_audit_logs_actor_created_idx
  on private.admin_audit_logs(actor_user_id, created_at desc);
create index if not exists admin_audit_logs_target_created_idx
  on private.admin_audit_logs(target_type, target_id, created_at desc);
create index if not exists admin_audit_logs_action_created_idx
  on private.admin_audit_logs(action, created_at desc);

create index if not exists role_permissions_permission_key_idx
  on private.role_permissions(permission_key);

create index if not exists role_permissions_granted_by_idx
  on private.role_permissions(granted_by);
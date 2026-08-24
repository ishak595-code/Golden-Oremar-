create table if not exists private.permissions (
  permission_key text primary key,
  domain text not null,
  description text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint permissions_key_format_check check (permission_key ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  constraint permissions_domain_format_check check (domain ~ '^[a-z][a-z0-9_]*$'),
  constraint permissions_domain_matches_key_check check (domain = split_part(permission_key,'.',1)),
  constraint permissions_description_length_check check (char_length(description) between 3 and 300)
);

create table if not exists private.role_permissions (
  role text not null,
  permission_key text not null references private.permissions(permission_key) on update cascade on delete restrict,
  granted_at timestamptz not null default timezone('utc', now()),
  granted_by uuid null references auth.users(id) on delete set null,
  primary key (role, permission_key),
  constraint role_permissions_role_check check (role in ('customer','producer','support','content_editor','operations','moderator','admin','super_admin'))
);

revoke all on table private.permissions from public, anon, authenticated;
revoke all on table private.role_permissions from public, anon, authenticated;
grant select on table private.permissions, private.role_permissions to service_role;

insert into private.permissions(permission_key,domain,description,is_active) values
('admin.access','admin','Yönetim çalışma alanına giriş yapabilme.',true),
('user.read','user','Yönetim kapsamındaki kullanıcı kayıtlarını okuyabilme.',true),
('user.manage','user','Kritik olmayan kullanıcı yönetim işlemlerini yapabilme.',true),
('user.suspend','user','Uygun kullanıcı hesaplarını askıya alabilme veya engelleyebilme.',true),
('user.restore','user','Uygun kullanıcı hesaplarını yeniden etkinleştirebilme.',true),
('user.erase','user','Hesap silme veya anonimleştirme gibi geri dönüşü zor işlemleri yapabilme.',true),
('role.read','role','Platform rol atamalarını okuyabilme.',true),
('role.manage','role','Platform rol atamalarını değiştirebilme ve yönetişim rolü verebilme.',true),
('seller.read','seller','Satıcı profili ve operasyonel satıcı durumunu okuyabilme.',true),
('seller.sensitive_read','seller','KYC, banka ve hassas satıcı doğrulama verisini gerekli iş amacıyla okuyabilme.',true),
('seller.review','seller','Satıcı başvurularını incelemeye alabilme.',true),
('seller.approve','seller','Satıcı başvurusunu onaylayabilme.',true),
('seller.reject','seller','Satıcı başvurusunu reddedebilme.',true),
('seller.request_information','seller','Satıcı adayından ek bilgi isteyebilme.',true),
('seller.suspend','seller','Onaylı satıcı hesabını askıya alabilme.',true),
('seller.restore','seller','Uygun satıcı hesabını yeniden etkinleştirebilme.',true),
('product.read','product','Ürün yönetim ve moderasyon verisini okuyabilme.',true),
('product.create','product','Yetkili kaynak kapsamında ürün oluşturabilme.',true),
('product.update','product','Yetkili kaynak kapsamında ürün içeriğini güncelleyebilme.',true),
('product.moderate','product','Ürün moderasyon kuyruğunu inceleyebilme.',true),
('product.approve','product','Ürünü moderasyon sonucunda onaylayabilme.',true),
('product.reject','product','Ürünü moderasyon sonucunda reddedebilme.',true),
('product.suspend','product','Yayındaki ürünü güven veya uygunluk gerekçesiyle askıya alabilme.',true),
('product.archive','product','Yetkili kaynak kapsamında ürünü arşivleyebilme.',true),
('product.remove','product','Geri dönüşü zor yönetim ürünü kaldırma işlemini yapabilme.',true),
('review.read','review','Yorum moderasyon verisini okuyabilme.',true),
('review.moderate','review','Yorumları moderasyon kapsamında inceleyebilme.',true),
('review.publish','review','Uygun yorumu yayınlayabilme.',true),
('review.reject','review','Uygun olmayan yorumu reddedebilme.',true),
('review.remove','review','Yayınlanmış yorumu moderasyon gerekçesiyle gizleyebilme.',true),
('report.read','report','Kullanıcı içerik şikayetlerini okuyabilme.',true),
('report.moderate','report','Kullanıcı içerik şikayetlerini sonuçlandırabilme.',true),
('message.moderate','message','Mesaj güvenliği ve içerik moderasyonu yapabilme.',true),
('order.read','order','Sipariş operasyon verisini okuyabilme.',true),
('order.manage','order','Sipariş hazırlama ve fulfillment operasyonunu yönetebilme.',true),
('order.cancel','order','Yetki ve durum kuralları içinde sipariş iptal edebilme.',true),
('refund.read','refund','İade ve refund operasyon verisini okuyabilme.',true),
('refund.request','refund','Kendi kapsamı içinde refund veya iade talebi başlatabilme.',true),
('refund.approve','refund','İade kararını operasyonel olarak onaylayabilme.',true),
('refund.execute','refund','Gerçek para iadesi yürütme veya kaydetme işlemini yapabilme.',true),
('finance.read','finance','Finansal operasyon özetlerini okuyabilme.',true),
('finance.manage','finance','Platform finans operasyonlarını yönetebilme.',true),
('payout.read','payout','Satıcı payout durumunu okuyabilme.',true),
('payout.request','payout','Kendi satıcı kapsamı içinde payout talebi oluşturabilme.',true),
('payout.review','payout','Satıcı payout taleplerini operasyonel olarak inceleyebilme.',true),
('payout.release','payout','Satıcı hakediş veya payout serbest bırakma işlemini yürütebilme.',true),
('payment.read','payment','Ödeme sistemi sağlık ve durum verisini okuyabilme.',true),
('payment.manage','payment','Ödeme sağlayıcısı ve tahsilat konfigürasyonunu değiştirebilme.',true),
('content.read','content','Yönetim içeriklerini okuyabilme.',true),
('content.create','content','Yönetim içeriği oluşturabilme.',true),
('content.update','content','Yönetim içeriğini düzenleyebilme.',true),
('content.publish','content','Yönetim içeriğini yayınlayabilme.',true),
('content.moderate','content','Kullanıcı veya editoryal içeriği moderasyon amacıyla inceleyebilme.',true),
('campaign.read','campaign','Kampanya ve kupon yapılarını okuyabilme.',true),
('campaign.manage','campaign','Kampanya ve kupon yapılarını yönetebilme.',true),
('notification.read','notification','Bildirim operasyonlarını okuyabilme.',true),
('notification.send','notification','Yetkili hedeflere bildirim gönderebilme.',true),
('notification.manage','notification','Bildirim yapılandırması ve operasyonunu yönetebilme.',true),
('support.read','support','Destek görüşmeleri ve destek durumunu okuyabilme.',true),
('support.manage','support','Destek görüşmelerini operasyonel olarak yönetebilme.',true),
('audit.read','audit','Yönetim audit kayıtlarını okuyabilme.',true),
('analytics.read','analytics','Yönetim KPI ve analitik özetlerini okuyabilme.',true),
('security.read','security','Güvenlik olayları ve güvenlik durumunu okuyabilme.',true),
('security.manage','security','Platform güvenlik kuralları ve kritik güvenlik kontrollerini değiştirebilme.',true),
('system.read','system','Sistem ve production readiness durumunu okuyabilme.',true),
('system.configure','system','Release, entegrasyon veya platform sistem yapılandırmasını değiştirebilme.',true),
('inventory.read','inventory','Stok ve inventory operasyon verisini okuyabilme.',true),
('inventory.manage','inventory','Stok ve inventory operasyonunu yönetebilme.',true),
('shipping.read','shipping','Kargo ve shipping readiness verisini okuyabilme.',true),
('shipping.manage','shipping','Kargo ve shipping operasyonunu yönetebilme.',true),
('event.read','event','Etkinlik yönetim verisini okuyabilme.',true),
('event.manage','event','Etkinlik operasyonunu ve içeriğini yönetebilme.',true),
('event.moderate','event','Etkinlik ve satıcı etkinlik gönderimlerini moderasyon amacıyla inceleyebilme.',true),
('storefront.read','storefront','Mağaza vitrini yönetim verisini okuyabilme.',true),
('storefront.manage','storefront','Yetkili mağaza vitrini içeriğini yönetebilme.',true),
('storefront.moderate','storefront','Mağaza vitrini içeriğini moderasyon amacıyla inceleyebilme.',true)
on conflict(permission_key) do update set domain=excluded.domain,description=excluded.description,is_active=excluded.is_active,updated_at=timezone('utc',now());

with grants(role, permission_key) as (
  values
  ('customer','refund.request'),('customer','support.read'),
  ('producer','product.read'),('producer','product.create'),('producer','product.update'),('producer','product.archive'),('producer','order.read'),('producer','order.manage'),('producer','finance.read'),('producer','payout.read'),('producer','payout.request'),('producer','event.read'),('producer','event.manage'),('producer','storefront.read'),('producer','storefront.manage'),('producer','support.read'),
  ('support','admin.access'),('support','user.read'),('support','order.read'),('support','refund.read'),('support','support.read'),('support','support.manage'),('support','notification.read'),
  ('content_editor','admin.access'),('content_editor','product.read'),('content_editor','content.read'),('content_editor','content.create'),('content_editor','content.update'),('content_editor','content.publish'),('content_editor','campaign.read'),('content_editor','campaign.manage'),('content_editor','event.read'),('content_editor','event.manage'),('content_editor','storefront.read'),('content_editor','storefront.manage'),('content_editor','notification.read'),
  ('moderator','admin.access'),('moderator','seller.read'),('moderator','product.read'),('moderator','product.moderate'),('moderator','product.approve'),('moderator','product.reject'),('moderator','product.suspend'),('moderator','review.read'),('moderator','review.moderate'),('moderator','review.publish'),('moderator','review.reject'),('moderator','review.remove'),('moderator','report.read'),('moderator','report.moderate'),('moderator','message.moderate'),('moderator','content.read'),('moderator','content.moderate'),('moderator','event.read'),('moderator','event.moderate'),('moderator','storefront.read'),('moderator','storefront.moderate'),
  ('operations','admin.access'),('operations','user.read'),('operations','user.manage'),('operations','user.suspend'),('operations','user.restore'),('operations','seller.read'),('operations','seller.sensitive_read'),('operations','seller.review'),('operations','seller.approve'),('operations','seller.reject'),('operations','seller.request_information'),('operations','seller.suspend'),('operations','seller.restore'),('operations','product.read'),('operations','product.update'),('operations','product.moderate'),('operations','product.approve'),('operations','product.reject'),('operations','product.suspend'),('operations','product.archive'),('operations','review.read'),('operations','review.moderate'),('operations','review.publish'),('operations','review.reject'),('operations','review.remove'),('operations','report.read'),('operations','report.moderate'),('operations','message.moderate'),('operations','order.read'),('operations','order.manage'),('operations','order.cancel'),('operations','refund.read'),('operations','refund.approve'),('operations','finance.read'),('operations','payout.read'),('operations','payout.review'),('operations','content.read'),('operations','campaign.read'),('operations','campaign.manage'),('operations','notification.read'),('operations','notification.send'),('operations','notification.manage'),('operations','support.read'),('operations','support.manage'),('operations','analytics.read'),('operations','inventory.read'),('operations','inventory.manage'),('operations','shipping.read'),('operations','shipping.manage'),('operations','event.read'),('operations','event.manage'),('operations','event.moderate'),('operations','storefront.read'),('operations','storefront.manage'),('operations','storefront.moderate'),
  ('admin','admin.access'),('admin','user.read'),('admin','user.manage'),('admin','user.suspend'),('admin','user.restore'),('admin','role.read'),('admin','seller.read'),('admin','seller.sensitive_read'),('admin','seller.review'),('admin','seller.approve'),('admin','seller.reject'),('admin','seller.request_information'),('admin','seller.suspend'),('admin','seller.restore'),('admin','product.read'),('admin','product.create'),('admin','product.update'),('admin','product.moderate'),('admin','product.approve'),('admin','product.reject'),('admin','product.suspend'),('admin','product.archive'),('admin','review.read'),('admin','review.moderate'),('admin','review.publish'),('admin','review.reject'),('admin','review.remove'),('admin','report.read'),('admin','report.moderate'),('admin','message.moderate'),('admin','order.read'),('admin','order.manage'),('admin','order.cancel'),('admin','refund.read'),('admin','refund.approve'),('admin','refund.execute'),('admin','finance.read'),('admin','finance.manage'),('admin','payout.read'),('admin','payout.review'),('admin','payment.read'),('admin','content.read'),('admin','content.create'),('admin','content.update'),('admin','content.publish'),('admin','content.moderate'),('admin','campaign.read'),('admin','campaign.manage'),('admin','notification.read'),('admin','notification.send'),('admin','notification.manage'),('admin','support.read'),('admin','support.manage'),('admin','audit.read'),('admin','analytics.read'),('admin','security.read'),('admin','system.read'),('admin','inventory.read'),('admin','inventory.manage'),('admin','shipping.read'),('admin','shipping.manage'),('admin','event.read'),('admin','event.manage'),('admin','event.moderate'),('admin','storefront.read'),('admin','storefront.manage'),('admin','storefront.moderate')
)
insert into private.role_permissions(role,permission_key)
select role,permission_key from grants
on conflict(role,permission_key) do nothing;

insert into private.role_permissions(role,permission_key)
select 'super_admin',permission_key from private.permissions where is_active=true
on conflict(role,permission_key) do nothing;

do $$
begin
  if exists(select 1 from pg_constraint where conrelid='private.user_roles'::regclass and conname='user_roles_role_check_v2') then
    alter table private.user_roles drop constraint user_roles_role_check_v2;
  end if;
  alter table private.user_roles add constraint user_roles_role_check_v2 check (role in ('customer','producer','support','content_editor','operations','moderator','admin','super_admin')) not valid;
  alter table private.user_roles validate constraint user_roles_role_check_v2;
  if exists(select 1 from pg_constraint where conrelid='private.user_roles'::regclass and conname='user_roles_role_check') then
    alter table private.user_roles drop constraint user_roles_role_check;
  end if;
  alter table private.user_roles rename constraint user_roles_role_check_v2 to user_roles_role_check;
end $$;

create or replace function private.user_has_permission_v1(p_user_id uuid,p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select p_user_id is not null
    and p_permission_key is not null
    and exists(
      select 1
      from private.user_roles ur
      join private.role_permissions rp on rp.role=ur.role
      join private.permissions permission on permission.permission_key=rp.permission_key and permission.is_active=true
      join public.profiles profile on profile.id=ur.user_id
      where ur.user_id=p_user_id
        and rp.permission_key=p_permission_key
        and (ur.expires_at is null or ur.expires_at>timezone('utc',now()))
        and profile.status='active'
        and profile.deleted_at is null
        and not coalesce((private.platform_access_block_v1(ur.user_id)->>'blocked')::boolean,false)
    );
$$;

create or replace function private.has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select private.user_has_permission_v1((select auth.uid()),p_permission_key);
$$;

create or replace function private.require_permission(p_permission_key text)
returns void
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if p_permission_key is null or p_permission_key !~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$' then
    raise exception 'invalid_permission_key' using errcode='22023';
  end if;
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  if not private.has_permission(p_permission_key) then
    raise exception 'permission_required:%',p_permission_key using errcode='42501';
  end if;
end;
$$;

revoke all on function private.user_has_permission_v1(uuid,text) from public,anon,authenticated;
revoke all on function private.require_permission(text) from public,anon,authenticated;
revoke all on function private.has_permission(text) from public,anon;
grant execute on function private.has_permission(text) to authenticated,service_role;
grant execute on function private.user_has_permission_v1(uuid,text) to service_role;

create or replace function public.authorization_has_permission_v1(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$ select private.has_permission(p_permission_key); $$;
revoke all on function public.authorization_has_permission_v1(text) from public,anon;
grant execute on function public.authorization_has_permission_v1(text) to authenticated,service_role;

create or replace function public.authorization_context_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  profile public.profiles%rowtype;
  roles_json jsonb;
  permissions_json jsonb;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into profile from public.profiles where id=uid;
  if profile.id is null then raise exception 'profile_not_found' using errcode='P0002'; end if;
  select coalesce(jsonb_agg(role order by priority),'[]'::jsonb) into roles_json
  from (
    select distinct ur.role,
      case ur.role when 'super_admin' then 1 when 'admin' then 2 when 'operations' then 3 when 'moderator' then 4 when 'content_editor' then 5 when 'support' then 6 when 'producer' then 7 when 'customer' then 8 else 99 end priority
    from private.user_roles ur
    where ur.user_id=uid and (ur.expires_at is null or ur.expires_at>timezone('utc',now()))
  ) active_roles;
  if profile.status='active' and profile.deleted_at is null and not coalesce((private.platform_access_block_v1(uid)->>'blocked')::boolean,false) then
    select coalesce(jsonb_agg(permission_key order by permission_key),'[]'::jsonb) into permissions_json
    from (
      select distinct rp.permission_key
      from private.user_roles ur
      join private.role_permissions rp on rp.role=ur.role
      join private.permissions permission on permission.permission_key=rp.permission_key and permission.is_active=true
      where ur.user_id=uid and (ur.expires_at is null or ur.expires_at>timezone('utc',now()))
    ) effective_permissions;
  else
    permissions_json:='[]'::jsonb;
  end if;
  return jsonb_build_object(
    'userId',uid,
    'accountStatus',profile.status,
    'roles',roles_json,
    'permissions',permissions_json,
    'canAccessAdmin',private.has_permission('admin.access'),
    'isAdmin',private.has_role('admin') or private.has_role('super_admin'),
    'isSuperAdmin',private.has_role('super_admin')
  );
end;
$$;
revoke all on function public.authorization_context_v1() from public,anon;
grant execute on function public.authorization_context_v1() to authenticated,service_role;

alter table private.admin_audit_logs add column if not exists correlation_id uuid;
alter table private.admin_audit_logs add column if not exists before_state jsonb;
alter table private.admin_audit_logs add column if not exists after_state jsonb;

create or replace function private.write_admin_audit_v2(
  p_action text,
  p_target_type text,
  p_target_id text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_details jsonb default '{}'::jsonb,
  p_correlation_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare new_id bigint;
begin
  if char_length(btrim(coalesce(p_action,''))) not between 3 and 160 then raise exception 'invalid_audit_action' using errcode='22023'; end if;
  if char_length(btrim(coalesce(p_target_type,''))) not between 2 and 120 then raise exception 'invalid_audit_target_type' using errcode='22023'; end if;
  if p_target_id is not null and char_length(p_target_id)>300 then raise exception 'invalid_audit_target_id' using errcode='22023'; end if;
  if p_details is null or jsonb_typeof(p_details)<>'object' then raise exception 'invalid_audit_details' using errcode='22023'; end if;
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details,correlation_id,before_state,after_state)
  values(auth.uid(),btrim(p_action),btrim(p_target_type),p_target_id,p_details,coalesce(p_correlation_id,gen_random_uuid()),p_before,p_after)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function private.write_admin_audit_v2(text,text,text,jsonb,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.write_admin_audit_v2(text,text,text,jsonb,jsonb,jsonb,uuid) to service_role;

create or replace function private.audit_role_permission_change_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is not null then
    insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details,correlation_id,before_state,after_state)
    values(
      auth.uid(),
      'authorization.role_permission_changed',
      'role_permission',
      coalesce(new.role,old.role)||':'||coalesce(new.permission_key,old.permission_key),
      jsonb_build_object('operation',tg_op),
      gen_random_uuid(),
      case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end
    );
  end if;
  return coalesce(new,old);
end;
$$;

drop trigger if exists role_permissions_audit_v1 on private.role_permissions;
create trigger role_permissions_audit_v1 after insert or update or delete on private.role_permissions for each row execute function private.audit_role_permission_change_v1();

create or replace function private.protect_last_super_admin_role_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare remaining_count integer;
declare removing boolean:=false;
begin
  if old.role<>'super_admin' then return coalesce(new,old); end if;
  if tg_op='DELETE' then removing:=true;
  elsif new.role<>'super_admin' then removing:=true;
  elsif new.expires_at is not null and new.expires_at<=timezone('utc',now()) then removing:=true;
  end if;
  if removing and auth.uid() is not null then
    select count(*) into remaining_count
    from private.user_roles ur
    join public.profiles profile on profile.id=ur.user_id
    where ur.role='super_admin'
      and ur.user_id<>old.user_id
      and (ur.expires_at is null or ur.expires_at>timezone('utc',now()))
      and profile.status='active' and profile.deleted_at is null
      and not coalesce((private.platform_access_block_v1(ur.user_id)->>'blocked')::boolean,false);
    if remaining_count=0 then raise exception 'last_super_admin_cannot_be_removed' using errcode='42501'; end if;
  end if;
  return coalesce(new,old);
end;
$$;

drop trigger if exists protect_last_super_admin_role_v1 on private.user_roles;
create trigger protect_last_super_admin_role_v1 before delete or update of role,expires_at on private.user_roles for each row execute function private.protect_last_super_admin_role_v1();

create or replace function public.authorization_policy_self_test_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare permission_count integer; role_count integer;
begin
  select count(*) into permission_count from private.permissions where is_active=true;
  select count(distinct role) into role_count from private.role_permissions;
  if permission_count<60 or role_count<>8 then raise exception 'authorization_contract_invalid' using errcode='55000'; end if;
  if exists(select 1 from private.role_permissions where role='moderator' and permission_key in ('refund.execute','payout.release','role.manage','system.configure','payment.manage','security.manage','finance.manage','user.erase','product.remove')) then raise exception 'moderator_privilege_escalation' using errcode='55000'; end if;
  if exists(select 1 from private.role_permissions where role='support' and permission_key in ('refund.execute','payout.release','role.manage','system.configure','payment.manage','security.manage')) then raise exception 'support_privilege_escalation' using errcode='55000'; end if;
  if exists(select 1 from private.role_permissions where role='operations' and permission_key in ('refund.execute','payout.release','role.manage','system.configure','payment.manage','security.manage','user.erase','product.remove')) then raise exception 'operations_privilege_escalation' using errcode='55000'; end if;
  if exists(select 1 from private.role_permissions where role='admin' and permission_key in ('payout.release','role.manage','system.configure','payment.manage','security.manage','user.erase','product.remove')) then raise exception 'admin_privilege_escalation' using errcode='55000'; end if;
  if exists(select 1 from private.role_permissions where role in ('customer','producer') and permission_key='admin.access') then raise exception 'customer_or_producer_admin_access' using errcode='55000'; end if;
  if exists(select 1 from private.permissions p where p.is_active=true and not exists(select 1 from private.role_permissions rp where rp.role='super_admin' and rp.permission_key=p.permission_key)) then raise exception 'super_admin_missing_permission' using errcode='55000'; end if;
  return jsonb_build_object('ok',true,'permissionCount',permission_count,'roleCount',role_count);
end;
$$;
revoke all on function public.authorization_policy_self_test_v1() from public,anon;
grant execute on function public.authorization_policy_self_test_v1() to authenticated,service_role;
-- Seller notification triggers for order events and product publication
-- Creates durable in-app notifications when orders are placed, cancelled, or products are published

-- Function to notify sellers when order is placed
create or replace function private.notify_seller_on_order_placed_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  customer_user_id uuid;
  order_number_value text;
  producer_record record;
begin
  -- Get order and customer details
  select o.customer_id, o.order_number
  into customer_user_id, order_number_value
  from public.orders o
  where o.id = NEW.id;

  -- Notify each distinct producer (in case order has products from multiple sellers)
  for producer_record in
    select distinct
      pr.user_id as producer_user_id,
      (select count(distinct oi2.product_id) 
       from public.order_items oi2 
       join public.products p2 on p2.id = oi2.product_id
       where oi2.order_id = NEW.id and p2.producer_id = pr.id) as product_count
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    join public.producers pr on pr.id = p.producer_id
    where oi.order_id = NEW.id and pr.user_id is not null
  loop
    insert into public.notifications(user_id, type, title, message, action_url, metadata)
    values (
      producer_record.producer_user_id,
      'seller_order_placed',
      'Yeni sipariş alındı',
      order_number_value || ' numaralı sipariş için ' || producer_record.product_count || ' ürün hazırlığı bekleniyor.',
      '/?tab=account&view=seller:orders',
      jsonb_build_object('orderId', NEW.id, 'orderNumber', order_number_value, 'productCount', producer_record.product_count)
    );
  end loop;

  -- Notify customer
  if customer_user_id is not null then
    insert into public.notifications(user_id, type, title, message, action_url, metadata)
    values (
      customer_user_id,
      'order_confirmed',
      'Siparişiniz alındı',
      order_number_value || ' numaralı siparişiniz onaylandı ve hazırlık aşamasına alındı.',
      '/?tab=account&view=orders:' || NEW.id,
      jsonb_build_object('orderId', NEW.id, 'orderNumber', order_number_value)
    );
  end if;

  return NEW;
end;
$$;

-- Function to notify sellers when order is cancelled
create or replace function private.notify_seller_on_order_cancelled_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  customer_user_id uuid;
  order_number_value text;
  producer_record record;
begin
  if NEW.status = 'cancelled' and OLD.status <> 'cancelled' then
    -- Get order details
    select o.customer_id, o.order_number
    into customer_user_id, order_number_value
    from public.orders o
    where o.id = NEW.id;

    -- Notify each distinct producer
    for producer_record in
      select distinct pr.user_id as producer_user_id
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      join public.producers pr on pr.id = p.producer_id
      where oi.order_id = NEW.id and pr.user_id is not null
    loop
      insert into public.notifications(user_id, type, title, message, action_url, metadata)
      values (
        producer_record.producer_user_id,
        'seller_order_cancelled',
        'Sipariş iptal edildi',
        order_number_value || ' numaralı sipariş müşteri tarafından iptal edildi.',
        '/?tab=account&view=seller:orders',
        jsonb_build_object('orderId', NEW.id, 'orderNumber', order_number_value)
      );
    end loop;

    -- Notify customer
    if customer_user_id is not null then
      insert into public.notifications(user_id, type, title, message, action_url, metadata)
      values (
        customer_user_id,
        'order_cancelled_confirmed',
        'Sipariş iptal edildi',
        order_number_value || ' numaralı siparişiniz iptal edildi. İade işlemi başlatıldı.',
        '/?tab=account&view=orders:' || NEW.id,
        jsonb_build_object('orderId', NEW.id, 'orderNumber', order_number_value)
      );
    end if;
  end if;

  return NEW;
end;
$$;

-- Function to notify seller when product is published/approved
create or replace function private.notify_seller_on_product_published_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  producer_user_id uuid;
  product_name_value text;
  product_slug_value text;
begin
  if NEW.status = 'published' and (OLD.status is null or OLD.status <> 'published') then
    select 
      pr.user_id,
      p.name,
      p.slug
    into producer_user_id, product_name_value, product_slug_value
    from public.products p
    join public.producers pr on pr.id = p.producer_id
    where p.id = NEW.id;

    if producer_user_id is not null then
      insert into public.notifications(user_id, type, title, message, action_url, metadata)
      values (
        producer_user_id,
        'seller_product_published',
        'Ürününüz yayınlandı',
        product_name_value || ' canlı katalogda yayına alındı ve müşteriler tarafından görülebilir.',
        '/?tab=product-detail&product=' || coalesce(product_slug_value, NEW.id::text),
        jsonb_build_object('productId', NEW.id, 'productSlug', product_slug_value)
      );
    end if;
  end if;

  return NEW;
end;
$$;

-- Function to notify super admin on product submission for review
create or replace function private.notify_admin_on_product_review_needed_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  admin_user_id uuid;
  producer_name_value text;
  product_name_value text;
begin
  if NEW.status = 'pending_review' and (OLD.status is null or OLD.status <> 'pending_review') then
    -- Get any super admin user
    select u.id into admin_user_id
    from auth.users u
    join public.profiles p on p.id = u.id
    where exists (
      select 1 from private.staff_roles sr 
      where sr.user_id = u.id and sr.role in ('super_admin', 'admin')
    )
    limit 1;

    if admin_user_id is not null then
      select 
        prod.display_name,
        p.name
      into producer_name_value, product_name_value
      from public.products p
      join public.producers prod on prod.id = p.producer_id
      where p.id = NEW.id;

      insert into public.notifications(user_id, type, title, message, action_url, metadata)
      values (
        admin_user_id,
        'admin_product_review_needed',
        'Ürün inceleme bekliyor',
        producer_name_value || ' tarafından ' || product_name_value || ' incelemeye gönderildi.',
        '/?tab=admin&view=products',
        jsonb_build_object('productId', NEW.id, 'producerName', producer_name_value)
      );
    end if;
  end if;

  return NEW;
end;
$$;

-- Create triggers
drop trigger if exists trigger_notify_seller_on_order_placed on public.orders;
create trigger trigger_notify_seller_on_order_placed
  after insert on public.orders
  for each row
  when (NEW.status <> 'pending_payment')
  execute function private.notify_seller_on_order_placed_v1();

drop trigger if exists trigger_notify_seller_on_order_cancelled on public.orders;
create trigger trigger_notify_seller_on_order_cancelled
  after update on public.orders
  for each row
  when (NEW.status = 'cancelled' and OLD.status <> 'cancelled')
  execute function private.notify_seller_on_order_cancelled_v1();

drop trigger if exists trigger_notify_seller_on_product_published on public.products;
create trigger trigger_notify_seller_on_product_published
  after update on public.products
  for each row
  when (NEW.status = 'published' and OLD.status <> 'published')
  execute function private.notify_seller_on_product_published_v1();

drop trigger if exists trigger_notify_admin_on_product_review_needed on public.products;
create trigger trigger_notify_admin_on_product_review_needed
  after update on public.products
  for each row
  when (NEW.status = 'pending_review' and (OLD.status is null or OLD.status <> 'pending_review'))
  execute function private.notify_admin_on_product_review_needed_v1();

revoke all on function private.notify_seller_on_order_placed_v1() from public;
revoke all on function private.notify_seller_on_order_cancelled_v1() from public;
revoke all on function private.notify_seller_on_product_published_v1() from public;
revoke all on function private.notify_admin_on_product_review_needed_v1() from public;

-- Ensure notifications table has RLS enabled
do $$
begin
  if not (select exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relname = 'notifications' and n.nspname = 'public' and c.relrowsecurity
  )) then
    alter table public.notifications enable row level security;
  end if;
end;
$$;

-- Policy: Users can only read their own notifications
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select
  using (auth.uid() = user_id);

-- Policy: Only system functions can insert notifications (already protected via SECURITY DEFINER triggers)
drop policy if exists notifications_insert_system on public.notifications;
create policy notifications_insert_system on public.notifications
  for insert
  with check (false); -- Prevent direct inserts; only via triggers/functions

-- Policy: Users can update their own notifications (mark as read)
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update
  using (auth.uid() = user_id);

-- Align notification status labels with the order screen wording (OrdersPanel statusText).
create or replace function private.order_status_label_tr_v1(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(coalesce(p_status, ''))
    when 'draft' then 'Taslak'
    when 'pending_payment' then 'Ödeme bekleniyor'
    when 'confirmed' then 'Onaylandı'
    when 'preparing' then 'Hazırlanıyor'
    when 'partially_shipped' then 'Kısmen gönderildi'
    when 'shipped' then 'Kargoda'
    when 'delivered' then 'Teslim edildi'
    when 'completed' then 'Tamamlandı'
    when 'cancelled' then 'İptal edildi'
    when 'refunded' then 'İade edildi'
    else null
  end;
$$;

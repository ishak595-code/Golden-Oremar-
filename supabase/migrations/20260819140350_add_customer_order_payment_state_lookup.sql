create or replace function public.get_my_order_payment_state_v1(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller_id uuid:=auth.uid(); target public.orders%rowtype;
begin
 if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_order_id is null then raise exception 'order_id_required' using errcode='22023'; end if;
 select * into target from public.orders where id=p_order_id and user_id=caller_id;
 if target.id is null then raise exception 'order_not_found' using errcode='P0002'; end if;
 return jsonb_build_object('orderId',target.id,'orderNumber',target.order_number,'orderStatus',target.status,'paymentStatus',target.payment_status,'reservationExpiresAt',target.reservation_expires_at,'totalMinor',target.total_minor,'currency',target.currency);
end;$$;
revoke all on function public.get_my_order_payment_state_v1(uuid) from public,anon;
grant execute on function public.get_my_order_payment_state_v1(uuid) to authenticated;

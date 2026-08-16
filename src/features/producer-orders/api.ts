import { supabase } from '../../lib/supabase';

export type ProducerOrderScope = 'open' | 'shipped' | 'all';

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export async function listProducerOrders(scope: ProducerOrderScope = 'open', limit = 30, offset = 0) {
  const { data, error } = await supabase.rpc('list_my_producer_orders_v1', {
    p_scope: scope,
    p_limit: limit,
    p_offset: offset,
  });
  return unwrap<any>(data, error);
}

export async function getProducerOrderDetail(orderId: string) {
  const { data, error } = await supabase.rpc('get_my_producer_order_detail_v1', {
    p_order_id: orderId,
  });
  return unwrap<any>(data, error);
}

export async function markProducerOrderItemsProcessing(orderId: string, orderItemIds: string[]) {
  if (!orderItemIds.length) throw new Error('Hazırlanacak en az bir sipariş kalemi seçin.');
  const { data, error } = await supabase.rpc('producer_mark_order_items_processing_v1', {
    p_order_id: orderId,
    p_order_item_ids: orderItemIds,
  });
  return unwrap<any>(data, error);
}

export async function createProducerShipment(input: {
  orderId: string;
  items: Array<{ orderItemId: string; quantity: number }>;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string | null;
  estimatedDeliveryAt?: string | null;
}) {
  if (!input.items.length) throw new Error('Kargoya verilecek en az bir sipariş kalemi seçin.');
  const { data, error } = await supabase.rpc('producer_create_shipment_v1', {
    p_order_id: input.orderId,
    p_items: input.items,
    p_carrier: input.carrier.trim(),
    p_tracking_number: input.trackingNumber.trim(),
    p_tracking_url: input.trackingUrl?.trim() || null,
    p_estimated_delivery_at: input.estimatedDeliveryAt || null,
  });
  return unwrap<any>(data, error);
}

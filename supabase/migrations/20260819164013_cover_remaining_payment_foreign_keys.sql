create index if not exists payment_intents_payment_method_idx on private.payment_intents(payment_method_id) where payment_method_id is not null;
create index if not exists payment_item_splits_order_item_idx on private.payment_item_splits(order_item_id) where order_item_id is not null;

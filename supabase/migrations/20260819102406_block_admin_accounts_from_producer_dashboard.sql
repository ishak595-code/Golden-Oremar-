create or replace function private.get_my_producer_dashboard_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare caller_id uuid:=auth.uid(); producer public.producers%rowtype; result jsonb;
begin
 if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if coalesce(private.is_admin(),false) then raise exception 'producer_portal_separate_from_admin' using errcode='42501'; end if;
 select * into producer from public.producers p where p.owner_user_id=caller_id and p.deleted_at is null order by p.created_at desc limit 1;
 if producer.id is null then raise exception 'producer_profile_required' using errcode='42501'; end if;
 select jsonb_build_object(
   'profile',private.get_my_producer_profile_v1(),
   'inventory',case when producer.status='active' and producer.is_verified then private.list_my_producer_inventory_v1() else '[]'::jsonb end,
   'finance',private.get_my_producer_finance_summary_v1(),
   'summary',jsonb_build_object(
     'draftProducts',(select count(*) from public.products p where p.producer_id=producer.id and p.status='draft' and p.deleted_at is null),
     'reviewProducts',(select count(*) from public.products p where p.producer_id=producer.id and p.status='review' and p.deleted_at is null),
     'publishedProducts',(select count(*) from public.products p where p.producer_id=producer.id and p.status='published' and p.is_active=true and p.deleted_at is null),
     'rejectedProducts',(select count(*) from public.products p where p.producer_id=producer.id and p.status='rejected' and p.deleted_at is null),
     'pendingChanges',(select count(*) from public.product_change_requests r where r.producer_id=producer.id and r.status='pending'),
     'draftBatches',(select count(*) from public.product_batches b where b.producer_id=producer.id and b.status='draft'),
     'reviewBatches',(select count(*) from public.product_batches b where b.producer_id=producer.id and b.status='review'),
     'releasedBatches',(select count(*) from public.product_batches b where b.producer_id=producer.id and b.status='released'),
     'lowStockVariants',(select count(*) from public.product_inventory i join public.product_variants v on v.id=i.variant_id join public.products p on p.id=v.product_id where p.producer_id=producer.id and p.stock_mode in ('tracked','seasonal') and greatest(0,i.available_quantity-i.reserved_quantity)<=i.reorder_level)
   ),
   'changeRequests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'productId',r.product_id,'productName',p.name,'status',r.status,'proposedPayload',r.proposed_payload,'reviewReason',r.review_reason,'createdAt',r.created_at,'updatedAt',r.updated_at,'reviewedAt',r.reviewed_at) order by r.created_at desc) from (select * from public.product_change_requests where producer_id=producer.id order by created_at desc limit 20) r join public.products p on p.id=r.product_id),'[]'::jsonb),
   'batches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'traceCode',b.trace_code,'batchCode',b.batch_code,'productId',b.product_id,'productName',p.name,'variantId',b.variant_id,'status',b.status,'harvestDate',b.harvest_date,'productionDate',b.production_date,'packagingDate',b.packaging_date,'bestBeforeDate',b.best_before_date,'reviewReason',b.review_reason,'submittedAt',b.submitted_at,'reviewedAt',b.reviewed_at,'releasedAt',b.released_at,'updatedAt',b.updated_at) order by b.updated_at desc) from (select * from public.product_batches where producer_id=producer.id order by updated_at desc limit 20) b join public.products p on p.id=b.product_id),'[]'::jsonb),
   'recentPayouts',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'currency',p.currency,'amountMinor',p.amount_minor,'status',p.status,'provider',p.provider,'providerReference',p.provider_reference,'note',p.note,'scheduledAt',p.scheduled_at,'processedAt',p.processed_at,'createdAt',p.created_at) order by p.created_at desc) from (select * from private.producer_payouts where producer_id=producer.id order by created_at desc limit 10) p),'[]'::jsonb)
 ) into result;
 return result;
end;
$$;

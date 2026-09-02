create or replace function private.management_product_commerce_editor_v1(p_product_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  product_row public.products%rowtype;
  owner_id uuid;
  profile public.product_commerce_profiles%rowtype;
begin
  if caller_id is null or not coalesce(private.has_permission('product.update'),false) then raise exception 'permission_required:product.update' using errcode='42501'; end if;
  select * into product_row from public.products where id=p_product_id and deleted_at is null;
  if product_row.id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
  select owner_user_id into owner_id from public.producers where id=product_row.producer_id;
  if owner_id is distinct from caller_id and not coalesce(private.has_permission('product.approve'),false) then raise exception 'product_owner_or_admin_required' using errcode='42501'; end if;
  select * into profile from public.product_commerce_profiles where product_id=product_row.id;
  return jsonb_build_object(
    'product',jsonb_build_object('id',product_row.id,'name',product_row.name,'slug',product_row.slug,'stockMode',product_row.stock_mode,'preorderLeadDays',product_row.preorder_lead_days),
    'profile',case when profile.product_id is null then jsonb_build_object('optionSchema','[]'::jsonb,'seasonalityMode','year_round','seasonStartMonth',null,'seasonEndMonth',null,'preorderEnabled',product_row.stock_mode='preorder','preparationDaysMin',null,'preparationDaysMax',product_row.preorder_lead_days,'customerSeasonNote',null,'researchBasis',null,'researchSourceLabel',null) else jsonb_build_object('optionSchema',profile.option_schema,'seasonalityMode',profile.seasonality_mode,'seasonStartMonth',profile.season_start_month,'seasonEndMonth',profile.season_end_month,'preorderEnabled',profile.preorder_enabled,'preparationDaysMin',profile.preparation_days_min,'preparationDaysMax',profile.preparation_days_max,'customerSeasonNote',profile.customer_season_note,'researchBasis',profile.research_basis,'researchSourceLabel',profile.research_source_label,'updatedAt',profile.updated_at) end,
    'windows',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'seasonYear',w.season_year,'opensAt',w.preorder_opens_at,'closesAt',w.preorder_closes_at,'fulfillmentStartsAt',w.fulfillment_starts_at,'fulfillmentEndsAt',w.fulfillment_ends_at,'status',w.status,'confirmed',w.is_confirmed,'publicNote',w.public_note,'internalNote',w.internal_note) order by w.season_year desc,w.created_at desc) from public.product_sales_windows w where w.product_id=product_row.id),'[]'::jsonb),
    'canConfirmWindow',coalesce(private.has_permission('product.approve'),false)
  );
end;
$$;

create or replace function public.management_product_commerce_editor_v1(p_product_id uuid)
returns jsonb language sql set search_path='' as $$ select private.management_product_commerce_editor_v1(p_product_id); $$;
revoke all on function public.management_product_commerce_editor_v1(uuid) from public;
grant execute on function public.management_product_commerce_editor_v1(uuid) to authenticated;

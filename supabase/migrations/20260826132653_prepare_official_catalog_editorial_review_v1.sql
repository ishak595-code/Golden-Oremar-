create or replace function private.product_editorial_payload_from_published_v1(p_product_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$declare product_row public.products%rowtype; entry public.content_entries%rowtype; safety jsonb; warning_texts jsonb; payload jsonb; begin
  select * into product_row from public.products p where p.id=p_product_id and p.deleted_at is null;
  if product_row.id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
  select * into entry from public.content_entries ce where ce.related_product_id=p_product_id and ce.content_type='product_health' and ce.locale='tr' and ce.status='published' and ce.deleted_at is null order by ce.updated_at desc limit 1;
  if entry.id is null then raise exception 'published_product_health_required' using errcode='55000'; end if;
  if jsonb_typeof(entry.metadata->'editorialV1')='object' then payload:=entry.metadata->'editorialV1'; else
    safety:=case when jsonb_typeof(entry.metadata->'safetyV2')='object' then entry.metadata->'safetyV2' else '{}'::jsonb end;
    select coalesce(jsonb_agg(to_jsonb(w.item->>'text')) filter(where nullif(btrim(w.item->>'text'),'') is not null),'[]'::jsonb) into warning_texts from jsonb_array_elements(case when jsonb_typeof(safety->'warnings')='array' then safety->'warnings' else '[]'::jsonb end) as w(item);
    payload:=jsonb_build_object('title',entry.title,'summary',entry.summary,'productInfo',jsonb_build_object('ingredients',coalesce(entry.metadata->'productInfoV1'->'ingredients','[]'::jsonb),'nutrition',coalesce(entry.metadata->'productInfoV1'->'nutrition','{}'::jsonb),'usageNotes',coalesce(entry.metadata->'productInfoV1'->'usageNotes','[]'::jsonb)),'safety',jsonb_build_object('storage',coalesce(safety->'storage'->'items','[]'::jsonb),'preparation',coalesce(safety->'preparation'->'items','[]'::jsonb),'warnings',warning_texts,'allergens',coalesce(safety->'allergens'->'known','[]'::jsonb),'allergenNote',coalesce(safety->'allergens'->>'text','')),'recipe',coalesce(entry.metadata->'recipeV1',jsonb_build_object('enabled',false,'ingredients','[]'::jsonb,'steps','[]'::jsonb)));
  end if;
  return private.normalize_product_editorial_payload_v1(payload);
end;$$;
revoke all on function private.product_editorial_payload_from_published_v1(uuid) from public,anon,authenticated;

do $backfill$ declare source_count integer; ready_count integer; migration_actor uuid; begin
  select ur.user_id into migration_actor from private.user_roles ur join public.profiles pf on pf.id=ur.user_id where ur.role='super_admin' and (ur.expires_at is null or ur.expires_at>timezone('utc',now())) and pf.status='active' and pf.deleted_at is null order by ur.user_id limit 1;
  if migration_actor is null then raise exception 'active_super_admin_required_for_editorial_backfill' using errcode='55000'; end if;
  select count(*)::integer into source_count from public.products p join public.producers pr on pr.id=p.producer_id where p.deleted_at is null and p.status='draft' and pr.store_kind='official' and pr.deleted_at is null;
  select count(*)::integer into ready_count from public.products p join public.producers pr on pr.id=p.producer_id join public.categories c on c.id=p.category_id and c.is_active=true left join public.product_provenance pp on pp.product_id=p.id where p.deleted_at is null and p.status='draft' and pr.store_kind='official' and pr.status='active' and pr.is_verified=true and pr.deleted_at is null and coalesce(pp.origin_verified,false)=true and char_length(btrim(coalesce(p.description,'')))>=20 and char_length(btrim(coalesce(p.story,'')))>=20 and exists(select 1 from public.product_variants v where v.product_id=p.id and v.is_active=true and v.price_minor>0) and exists(select 1 from public.content_entries e where e.related_product_id=p.id and e.content_type='product_health' and e.locale='tr' and e.status='published' and e.deleted_at is null) and private.product_media_integrity_ok_v1(p.id);
  if source_count<>ready_count then raise exception 'official_catalog_review_backfill_not_ready:%/%',ready_count,source_count using errcode='55000'; end if;
  insert into private.product_editorial_drafts(product_id,producer_id,locale,payload,status,submitted_by,submitted_at,reviewed_by,reviewed_at,review_note,updated_at)
  select p.id,p.producer_id,'tr',private.product_editorial_payload_from_published_v1(p.id),'review',migration_actor,timezone('utc',now()),null,null,null,timezone('utc',now()) from public.products p join public.producers pr on pr.id=p.producer_id where p.deleted_at is null and p.status='draft' and pr.store_kind='official' and pr.deleted_at is null and not exists(select 1 from private.product_editorial_drafts d where d.product_id=p.id and d.locale='tr');
  update public.products p set status='review',is_active=false,published_at=null,updated_at=timezone('utc',now()) from public.producers pr where pr.id=p.producer_id and pr.store_kind='official' and pr.deleted_at is null and p.deleted_at is null and p.status='draft' and exists(select 1 from private.product_editorial_drafts d where d.product_id=p.id and d.locale='tr' and d.status='review');
  if (select count(*) from public.products p join public.producers pr on pr.id=p.producer_id where p.deleted_at is null and pr.store_kind='official' and p.status='review')<>source_count then raise exception 'official_catalog_review_backfill_count_mismatch' using errcode='55000'; end if;
end $backfill$;

update storage.buckets
set file_size_limit=52428800,
    allowed_mime_types=array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm','video/quicktime']::text[]
where id='catalog-public';

create or replace function private.verified_product_video_path_v1(p_path text)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  normalized text:=btrim(coalesce(p_path,''));
  mime text;
  size_bytes bigint;
begin
  if normalized='' or char_length(normalized)>1200 or normalized~*'^[a-z][a-z0-9+.-]*:' or normalized like '/%' then return null; end if;
  if exists(select 1 from unnest(string_to_array(normalized,'/')) part where part in ('','.','..')) then return null; end if;
  select lower(coalesce(o.metadata->>'mimetype','')), nullif(o.metadata->>'size','')::bigint
    into mime,size_bytes
  from storage.objects o
  where o.bucket_id='catalog-public' and o.name=normalized
  limit 1;
  if mime not in ('video/mp4','video/webm','video/quicktime') then return null; end if;
  if size_bytes is null or size_bytes<=0 or size_bytes>52428800 then return null; end if;
  return normalized;
exception when others then
  return null;
end;
$$;
revoke all on function private.verified_product_video_path_v1(text) from public;

create table if not exists private.product_editorial_drafts(
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  producer_id uuid not null references public.producers(id) on delete cascade,
  locale text not null default 'tr' check(locale in ('tr','en','de','fr','ku','ar')),
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  status text not null default 'draft' check(status in ('draft','review','rejected','approved')),
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  unique(product_id,locale)
);
create index if not exists product_editorial_drafts_status_idx on private.product_editorial_drafts(status,updated_at desc);

create or replace function private.editorial_text_array_v1(p_value jsonb,p_label text,p_max_items integer,p_max_len integer)
returns jsonb
language plpgsql
immutable
set search_path to ''
as $$
declare result jsonb:='[]'::jsonb; item jsonb; value text; count_items integer:=0;
begin
  if p_value is null then return result; end if;
  if jsonb_typeof(p_value)<>'array' or jsonb_array_length(p_value)>p_max_items then raise exception 'invalid_%',p_label using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_value) loop
    if jsonb_typeof(item)<>'string' then raise exception 'invalid_%',p_label using errcode='22023'; end if;
    value:=btrim(trim(both '"' from item::text));
    if value<>'' then
      if char_length(value)>p_max_len or value~E'[\\u0000-\\u001F\\u007F]' then raise exception 'invalid_%',p_label using errcode='22023'; end if;
      count_items:=count_items+1;
      result:=result||to_jsonb(value);
    end if;
  end loop;
  if count_items>p_max_items then raise exception 'invalid_%',p_label using errcode='22023'; end if;
  return result;
end;
$$;
revoke all on function private.editorial_text_array_v1(jsonb,text,integer,integer) from public;

create or replace function private.normalize_product_editorial_payload_v1(p_payload jsonb)
returns jsonb
language plpgsql
immutable
set search_path to ''
as $$
declare
  title_value text; summary_value text; info jsonb; safety jsonb; recipe jsonb; nutrition jsonb;
  ingredients jsonb; usage_notes jsonb; storage_items jsonb; prep_items jsonb; warning_items jsonb; allergens jsonb; recipe_ingredients jsonb; recipe_steps jsonb;
  recipe_enabled boolean:=false; serving_size text; allergen_note text; recipe_title text; servings integer; prep_minutes integer; cook_minutes integer;
  nutrition_result jsonb:='{}'::jsonb; key text; numeric_value numeric;
  allowed_nutrition constant text[]:=array['energyKcal','proteinG','carbohydrateG','sugarsG','fatG','saturatedFatG','fiberG','saltG'];
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>131072 then raise exception 'invalid_product_editorial_payload' using errcode='22023'; end if;
  title_value:=btrim(coalesce(p_payload->>'title',''));
  summary_value:=btrim(coalesce(p_payload->>'summary',''));
  if char_length(title_value) not between 2 and 180 or char_length(summary_value)>1000 then raise exception 'invalid_product_editorial_text' using errcode='22023'; end if;
  info:=coalesce(p_payload->'productInfo','{}'::jsonb); safety:=coalesce(p_payload->'safety','{}'::jsonb); recipe:=coalesce(p_payload->'recipe','{}'::jsonb);
  if jsonb_typeof(info)<>'object' or jsonb_typeof(safety)<>'object' or jsonb_typeof(recipe)<>'object' then raise exception 'invalid_product_editorial_sections' using errcode='22023'; end if;
  ingredients:=private.editorial_text_array_v1(info->'ingredients','ingredients',80,300);
  usage_notes:=private.editorial_text_array_v1(info->'usageNotes','usage_notes',30,500);
  storage_items:=private.editorial_text_array_v1(safety->'storage','storage',20,500);
  prep_items:=private.editorial_text_array_v1(safety->'preparation','preparation',30,500);
  warning_items:=private.editorial_text_array_v1(safety->'warnings','warnings',20,700);
  allergens:=private.editorial_text_array_v1(safety->'allergens','allergens',30,160);
  allergen_note:=btrim(coalesce(safety->>'allergenNote',''));
  if char_length(allergen_note)>1000 then raise exception 'invalid_allergen_note' using errcode='22023'; end if;
  nutrition:=coalesce(info->'nutrition','{}'::jsonb);
  if jsonb_typeof(nutrition)<>'object' or pg_column_size(nutrition)>8192 then raise exception 'invalid_nutrition_payload' using errcode='22023'; end if;
  serving_size:=btrim(coalesce(nutrition->>'servingSize',''));
  if char_length(serving_size)>80 then raise exception 'invalid_serving_size' using errcode='22023'; end if;
  if serving_size<>'' then nutrition_result:=jsonb_set(nutrition_result,'{servingSize}',to_jsonb(serving_size),true); end if;
  foreach key in array allowed_nutrition loop
    if nutrition ? key then
      if jsonb_typeof(nutrition->key)<>'number' then raise exception 'invalid_nutrition_value' using errcode='22023'; end if;
      numeric_value:=(nutrition->>key)::numeric;
      if numeric_value<0 or numeric_value>100000 then raise exception 'nutrition_value_out_of_range' using errcode='22023'; end if;
      nutrition_result:=jsonb_set(nutrition_result,array[key],to_jsonb(numeric_value),true);
    end if;
  end loop;
  if recipe ? 'enabled' then
    if jsonb_typeof(recipe->'enabled')<>'boolean' then raise exception 'invalid_recipe_enabled' using errcode='22023'; end if;
    recipe_enabled:=(recipe->>'enabled')::boolean;
  end if;
  recipe_title:=btrim(coalesce(recipe->>'title',''));
  if char_length(recipe_title)>180 then raise exception 'invalid_recipe_title' using errcode='22023'; end if;
  recipe_ingredients:=private.editorial_text_array_v1(recipe->'ingredients','recipe_ingredients',60,300);
  recipe_steps:=private.editorial_text_array_v1(recipe->'steps','recipe_steps',40,1000);
  if recipe ? 'servings' then servings=(recipe->>'servings')::integer; if servings<1 or servings>100 then raise exception 'invalid_recipe_servings' using errcode='22023'; end if; end if;
  if recipe ? 'prepMinutes' then prep_minutes=(recipe->>'prepMinutes')::integer; if prep_minutes<0 or prep_minutes>1440 then raise exception 'invalid_recipe_prep_minutes' using errcode='22023'; end if; end if;
  if recipe ? 'cookMinutes' then cook_minutes=(recipe->>'cookMinutes')::integer; if cook_minutes<0 or cook_minutes>1440 then raise exception 'invalid_recipe_cook_minutes' using errcode='22023'; end if; end if;
  if recipe_enabled and (char_length(recipe_title)<2 or jsonb_array_length(recipe_ingredients)=0 or jsonb_array_length(recipe_steps)=0) then raise exception 'recipe_content_incomplete' using errcode='22023'; end if;
  return jsonb_build_object(
    'title',title_value,'summary',summary_value,
    'productInfo',jsonb_build_object('ingredients',ingredients,'nutrition',nutrition_result,'usageNotes',usage_notes),
    'safety',jsonb_build_object('storage',storage_items,'preparation',prep_items,'warnings',warning_items,'allergens',allergens,'allergenNote',allergen_note),
    'recipe',jsonb_strip_nulls(jsonb_build_object('enabled',recipe_enabled,'title',nullif(recipe_title,''),'servings',servings,'prepMinutes',prep_minutes,'cookMinutes',cook_minutes,'ingredients',recipe_ingredients,'steps',recipe_steps))
  );
exception when invalid_text_representation then
  raise exception 'invalid_product_editorial_number' using errcode='22023';
end;
$$;
revoke all on function private.normalize_product_editorial_payload_v1(jsonb) from public;

create or replace function private.publish_product_editorial_v1(p_product_id uuid,p_payload jsonb,p_actor uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  normalized jsonb:=private.normalize_product_editorial_payload_v1(p_payload);
  product_row public.products%rowtype; existing public.content_entries%rowtype; entry_id uuid; existing_safety jsonb; warning_objects jsonb; metadata_value jsonb;
begin
  select * into product_row from public.products p where p.id=p_product_id and p.deleted_at is null;
  if product_row.id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
  select * into existing from public.content_entries ce where ce.related_product_id=p_product_id and ce.content_type='product_health' and ce.locale='tr' and ce.deleted_at is null order by ce.updated_at desc limit 1;
  existing_safety:=case when jsonb_typeof(existing.metadata->'safetyV2')='object' then existing.metadata->'safetyV2' else '{}'::jsonb end;
  select coalesce(jsonb_agg(jsonb_build_object('code','editorial_note','severity','info','text',value)),'[]'::jsonb) into warning_objects
  from jsonb_array_elements_text(normalized->'safety'->'warnings') value;
  metadata_value:=coalesce(existing.metadata,'{}'::jsonb)||jsonb_build_object(
    'editorialV1',normalized,
    'productInfoV1',normalized->'productInfo',
    'recipeV1',normalized->'recipe',
    'safetyV2',jsonb_build_object(
      'schemaVersion',2,
      'guidanceKind',coalesce(nullif(existing_safety->>'guidanceKind',''),'food_safety'),
      'safetyClass',coalesce(nullif(existing_safety->>'safetyClass',''),'general_product'),
      'storage',jsonb_build_object('title','Saklama','items',normalized->'safety'->'storage'),
      'preparation',jsonb_build_object('title','Hazırlama / kullanım','items',normalized->'safety'->'preparation'),
      'warnings',warning_objects,
      'allergens',jsonb_build_object('known',normalized->'safety'->'allergens','verifyLabel',true,'text',normalized->'safety'->>'allergenNote'),
      'verificationNeeded',case when jsonb_typeof(existing_safety->'verificationNeeded')='array' then existing_safety->'verificationNeeded' else '[]'::jsonb end,
      'claimPolicy','Bu içerik ürün/gıda güvenliği ve kullanım bilgisidir; hastalık tanısı, tedavisi veya önlenmesi iddiası değildir.',
      'sources',case when jsonb_typeof(existing_safety->'sources')='array' then existing_safety->'sources' else '[]'::jsonb end
    )
  );
  if existing.id is null then
    insert into public.content_entries(content_type,slug,title,summary,body_markdown,body_html_sanitized,author_user_id,related_product_id,related_producer_id,status,locale,metadata,published_at)
    values('product_health','product-health-'||product_row.slug,normalized->>'title',normalized->>'summary','', '',p_actor,product_row.id,product_row.producer_id,'published','tr',metadata_value,timezone('utc',now()))
    returning id into entry_id;
  else
    update public.content_entries set title=normalized->>'title',summary=normalized->>'summary',author_user_id=p_actor,related_producer_id=product_row.producer_id,status='published',metadata=metadata_value,published_at=coalesce(existing.published_at,timezone('utc',now())),updated_at=timezone('utc',now()) where id=existing.id returning id into entry_id;
  end if;
  return entry_id;
end;
$$;
revoke all on function private.publish_product_editorial_v1(uuid,jsonb,uuid) from public;

create or replace function private.get_product_editorial_editor_v1(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  caller_id uuid:=auth.uid(); product_id uuid:=private.resolve_product_id_v1(p_reference); product_row public.products%rowtype; producer_row public.producers%rowtype; entry public.content_entries%rowtype; draft private.product_editorial_drafts%rowtype; published_payload jsonb; safety jsonb; warning_texts jsonb;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if product_id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
  select * into product_row from public.products p where p.id=product_id and p.deleted_at is null;
  select * into producer_row from public.producers p where p.id=product_row.producer_id and p.deleted_at is null;
  if not coalesce(private.is_admin(),false) and producer_row.owner_user_id is distinct from caller_id then raise exception 'product_access_denied' using errcode='42501'; end if;
  select * into entry from public.content_entries ce where ce.related_product_id=product_id and ce.content_type='product_health' and ce.locale='tr' and ce.deleted_at is null order by ce.updated_at desc limit 1;
  if entry.id is not null and jsonb_typeof(entry.metadata->'editorialV1')='object' then published_payload:=entry.metadata->'editorialV1';
  elsif entry.id is not null then
    safety:=case when jsonb_typeof(entry.metadata->'safetyV2')='object' then entry.metadata->'safetyV2' else '{}'::jsonb end;
    select coalesce(jsonb_agg(to_jsonb(item->>'text')) filter(where nullif(btrim(item->>'text'),'') is not null),'[]'::jsonb) into warning_texts from jsonb_array_elements(case when jsonb_typeof(safety->'warnings')='array' then safety->'warnings' else '[]'::jsonb end) item;
    published_payload:=jsonb_build_object('title',entry.title,'summary',entry.summary,'productInfo',jsonb_build_object('ingredients',coalesce(entry.metadata->'productInfoV1'->'ingredients','[]'::jsonb),'nutrition',coalesce(entry.metadata->'productInfoV1'->'nutrition','{}'::jsonb),'usageNotes',coalesce(entry.metadata->'productInfoV1'->'usageNotes','[]'::jsonb)),'safety',jsonb_build_object('storage',coalesce(safety->'storage'->'items','[]'::jsonb),'preparation',coalesce(safety->'preparation'->'items','[]'::jsonb),'warnings',warning_texts,'allergens',coalesce(safety->'allergens'->'known','[]'::jsonb),'allergenNote',coalesce(safety->'allergens'->>'text','')),'recipe',coalesce(entry.metadata->'recipeV1',jsonb_build_object('enabled',false,'ingredients','[]'::jsonb,'steps','[]'::jsonb)));
  else
    published_payload:=jsonb_build_object('title',product_row.name||' | Saklama ve Kullanım','summary','','productInfo',jsonb_build_object('ingredients','[]'::jsonb,'nutrition','{}'::jsonb,'usageNotes','[]'::jsonb),'safety',jsonb_build_object('storage','[]'::jsonb,'preparation','[]'::jsonb,'warnings','[]'::jsonb,'allergens','[]'::jsonb,'allergenNote',''),'recipe',jsonb_build_object('enabled',false,'ingredients','[]'::jsonb,'steps','[]'::jsonb));
  end if;
  select * into draft from private.product_editorial_drafts d where d.product_id=product_id and d.locale='tr';
  return jsonb_build_object('productId',product_row.id,'productName',product_row.name,'producerId',product_row.producer_id,'storeKind',producer_row.store_kind,'canPublish',coalesce(private.is_admin(),false),'published',published_payload,'draft',case when draft.id is null then null else jsonb_build_object('id',draft.id,'status',draft.status,'payload',draft.payload,'reviewNote',draft.review_note,'updatedAt',draft.updated_at) end,'videoPath',private.verified_product_video_path_v1(product_row.specifications->>'video'));
end;
$$;
revoke all on function private.get_product_editorial_editor_v1(text) from public;

create or replace function public.get_product_editorial_editor_v1(p_reference text)
returns jsonb language sql stable set search_path to '' as $$ select private.get_product_editorial_editor_v1(p_reference); $$;
grant execute on function public.get_product_editorial_editor_v1(text) to authenticated;

create or replace function private.save_product_editorial_v1(p_reference text,p_payload jsonb,p_action text,p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  caller_id uuid:=auth.uid(); product_id uuid:=private.resolve_product_id_v1(p_reference); product_row public.products%rowtype; producer_row public.producers%rowtype; normalized jsonb; action_value text:=lower(btrim(coalesce(p_action,''))); note_value text:=btrim(coalesce(p_note,'')); row_id uuid; current_status text;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if product_id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
  select * into product_row from public.products p where p.id=product_id and p.deleted_at is null;
  select * into producer_row from public.producers p where p.id=product_row.producer_id and p.deleted_at is null;
  if not coalesce(private.is_admin(),false) and producer_row.owner_user_id is distinct from caller_id then raise exception 'product_access_denied' using errcode='42501'; end if;
  if action_value not in ('save','submit','publish','reject') then raise exception 'invalid_editorial_action' using errcode='22023'; end if;
  if action_value in ('save','submit','publish') then normalized:=private.normalize_product_editorial_payload_v1(p_payload); end if;
  if action_value='publish' then
    if not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
    perform private.publish_product_editorial_v1(product_id,normalized,caller_id);
    insert into private.product_editorial_drafts(product_id,producer_id,locale,payload,status,submitted_by,submitted_at,reviewed_by,reviewed_at,review_note,updated_at)
    values(product_id,product_row.producer_id,'tr',normalized,'approved',caller_id,timezone('utc',now()),caller_id,timezone('utc',now()),null,timezone('utc',now()))
    on conflict(product_id,locale) do update set payload=excluded.payload,status='approved',submitted_by=excluded.submitted_by,submitted_at=excluded.submitted_at,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,review_note=null,updated_at=excluded.updated_at returning id into row_id;
    return jsonb_build_object('id',row_id,'status','published','productId',product_id);
  elsif action_value='reject' then
    if not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
    if char_length(note_value) not between 8 and 2000 then raise exception 'editorial_rejection_note_required' using errcode='22023'; end if;
    update private.product_editorial_drafts d set status='rejected',reviewed_by=caller_id,reviewed_at=timezone('utc',now()),review_note=note_value,updated_at=timezone('utc',now()) where d.product_id=product_id and d.locale='tr' and d.status='review' returning d.id into row_id;
    if row_id is null then raise exception 'editorial_review_not_found' using errcode='P0002'; end if;
    return jsonb_build_object('id',row_id,'status','rejected','productId',product_id);
  else
    current_status:=case when action_value='submit' then 'review' else 'draft' end;
    insert into private.product_editorial_drafts(product_id,producer_id,locale,payload,status,submitted_by,submitted_at,reviewed_by,reviewed_at,review_note,updated_at)
    values(product_id,product_row.producer_id,'tr',normalized,current_status,caller_id,case when action_value='submit' then timezone('utc',now()) else null end,null,null,null,timezone('utc',now()))
    on conflict(product_id,locale) do update set payload=excluded.payload,status=excluded.status,submitted_by=excluded.submitted_by,submitted_at=excluded.submitted_at,reviewed_by=null,reviewed_at=null,review_note=null,updated_at=excluded.updated_at returning id into row_id;
    return jsonb_build_object('id',row_id,'status',current_status,'productId',product_id);
  end if;
end;
$$;
revoke all on function private.save_product_editorial_v1(text,jsonb,text,text) from public;

create or replace function public.save_product_editorial_v1(p_reference text,p_payload jsonb,p_action text,p_note text default null)
returns jsonb language sql set search_path to '' as $$ select private.save_product_editorial_v1(p_reference,p_payload,p_action,p_note); $$;
grant execute on function public.save_product_editorial_v1(text,jsonb,text,text) to authenticated;

create or replace function private.admin_list_product_editorial_reviews_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare result jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'productId',p.id,'productName',p.name,'productSlug',p.slug,'producerId',pr.id,'producerName',pr.display_name,'payload',d.payload,'submittedAt',d.submitted_at,'updatedAt',d.updated_at) order by d.updated_at desc),'[]'::jsonb) into result
  from private.product_editorial_drafts d join public.products p on p.id=d.product_id join public.producers pr on pr.id=d.producer_id where d.status='review' and p.deleted_at is null and pr.deleted_at is null;
  return result;
end;
$$;
revoke all on function private.admin_list_product_editorial_reviews_v1() from public;
create or replace function public.admin_list_product_editorial_reviews_v1()
returns jsonb language sql stable set search_path to '' as $$ select private.admin_list_product_editorial_reviews_v1(); $$;
grant execute on function public.admin_list_product_editorial_reviews_v1() to authenticated;

create or replace function private.get_public_product_safety_v2(p_reference text,p_locale text default 'tr')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare base jsonb:=private.get_public_product_safety_v1(p_reference,p_locale); entry_id uuid; meta jsonb;
begin
  if base='{}'::jsonb then return base; end if;
  begin entry_id:=(base->>'contentId')::uuid; exception when others then return base; end;
  select ce.metadata into meta from public.content_entries ce where ce.id=entry_id and ce.status='published' and ce.deleted_at is null;
  return base||jsonb_build_object('productInfo',case when jsonb_typeof(meta->'productInfoV1')='object' then meta->'productInfoV1' else '{}'::jsonb end,'recipe',case when jsonb_typeof(meta->'recipeV1')='object' then meta->'recipeV1' else '{}'::jsonb end);
end;
$$;
revoke all on function private.get_public_product_safety_v2(text,text) from public;
create or replace function public.get_public_product_safety_v1(p_reference text,p_locale text default 'tr')
returns jsonb language sql stable set search_path to '' as $$ select private.get_public_product_safety_v2(p_reference,p_locale); $$;
create or replace function public.get_public_product_safety_v2(p_reference text,p_locale text default 'tr')
returns jsonb language sql stable set search_path to '' as $$ select private.get_public_product_safety_v2(p_reference,p_locale); $$;
grant execute on function public.get_public_product_safety_v1(text,text) to anon,authenticated;
grant execute on function public.get_public_product_safety_v2(text,text) to anon,authenticated;

create or replace function private.get_public_product_detail_v3(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare base jsonb:=private.get_public_product_detail_v2(p_reference); specs jsonb; video_path text;
begin
  specs:=coalesce(base->'specifications','{}'::jsonb);
  video_path:=private.verified_product_video_path_v1(specs->>'video');
  specs:=jsonb_set(specs,'{video}',coalesce(to_jsonb(video_path),'null'::jsonb),true);
  return jsonb_set(base,'{specifications}',specs,true);
end;
$$;
revoke all on function private.get_public_product_detail_v3(text) from public;
create or replace function public.get_public_product_detail_v1(p_reference text)
returns jsonb language sql stable set search_path to '' as $$ select private.get_public_product_detail_v3(p_reference); $$;
create or replace function public.get_public_product_detail_v2(p_reference text)
returns jsonb language sql stable set search_path to '' as $$ select private.get_public_product_detail_v3(p_reference); $$;
create or replace function public.get_public_product_detail_v3(p_reference text)
returns jsonb language sql stable set search_path to '' as $$ select private.get_public_product_detail_v3(p_reference); $$;
grant execute on function public.get_public_product_detail_v1(text) to anon,authenticated;
grant execute on function public.get_public_product_detail_v2(text) to anon,authenticated;
grant execute on function public.get_public_product_detail_v3(text) to anon,authenticated;

create or replace function public.management_upsert_product_v1(p_reference text,p_payload jsonb)
returns jsonb language plpgsql set search_path to '' as $$
declare weight_value numeric; video_value text;
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if p_payload ? 'weight' then
    if jsonb_typeof(p_payload->'weight')<>'number' then raise exception 'invalid_shipping_weight' using errcode='22023'; end if;
    weight_value:=(p_payload->>'weight')::numeric;
    if weight_value<=0 or weight_value>10000 then raise exception 'shipping_weight_out_of_range' using errcode='22023'; end if;
  end if;
  if p_payload ? 'video' and nullif(btrim(coalesce(p_payload->>'video','')),'') is not null then
    video_value:=private.verified_product_video_path_v1(p_payload->>'video');
    if video_value is null then raise exception 'stored_product_video_required' using errcode='55000'; end if;
  end if;
  return private.management_upsert_product_v2(p_reference,p_payload);
end;
$$;

create or replace function public.producer_upsert_product_v1(p_reference text,p_payload jsonb)
returns jsonb language plpgsql set search_path to '' as $$
declare weight_value numeric; video_value text;
begin
  if p_payload ? 'weight' then
    if jsonb_typeof(p_payload->'weight')<>'number' then raise exception 'invalid_shipping_weight' using errcode='22023'; end if;
    weight_value:=(p_payload->>'weight')::numeric;
    if weight_value<=0 or weight_value>10000 then raise exception 'shipping_weight_out_of_range' using errcode='22023'; end if;
  end if;
  if p_payload ? 'video' and nullif(btrim(coalesce(p_payload->>'video','')),'') is not null then
    video_value:=private.verified_product_video_path_v1(p_payload->>'video');
    if video_value is null then raise exception 'stored_product_video_required' using errcode='55000'; end if;
  end if;
  return private.producer_upsert_product_v1(p_reference,p_payload);
end;
$$;

create or replace function private.get_public_producer_profile_v5(p_reference text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare base jsonb:=private.get_public_producer_profile_v4(p_reference); badges jsonb;
begin
  if base->>'store_kind'='official' then
    select coalesce(jsonb_agg(case when item->>'key' in ('official_store','verified_origin') then jsonb_set(item,'{tone}',to_jsonb('ruby'::text),true) else item end order by ordinality),'[]'::jsonb) into badges from jsonb_array_elements(coalesce(base->'badges','[]'::jsonb)) with ordinality rows(item,ordinality);
    base:=jsonb_set(base,'{badges}',badges,true);
  end if;
  return base;
end;
$$;
revoke all on function private.get_public_producer_profile_v5(text) from public;
create or replace function public.get_public_producer_profile_v3(p_reference text)
returns jsonb language sql stable set search_path to '' as $$ select private.get_public_producer_profile_v5(p_reference); $$;

create or replace function private.get_public_producer_follow_metrics_v1(p_producer_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare caller_id uuid:=auth.uid(); requested_count integer:=coalesce(cardinality(p_producer_ids),0); ids uuid[]:=array[]::uuid[]; result jsonb;
begin
  if requested_count=0 then return '[]'::jsonb; end if;
  if requested_count>100 then raise exception 'too_many_producer_ids' using errcode='22023'; end if;
  select coalesce(array_agg(distinct value),array[]::uuid[]) into ids from unnest(p_producer_ids) value where value is not null;
  select coalesce(jsonb_agg(jsonb_build_object('producerId',p.id,'followerCount',coalesce(follow_stats.follower_count,0),'following',case when caller_id is null then false else exists(select 1 from private.producer_follows mine where mine.user_id=caller_id and mine.producer_id=p.id) end,'verified',case when p.store_kind='official' then true else private.is_producer_trust_badge_active_v1(p.id) end,'originVerified',p.origin_verified and (p.store_kind='official' or private.is_producer_trust_badge_active_v1(p.id)),'storeKind',p.store_kind,'badgeTone',case when p.store_kind='official' then 'ruby' else 'blue' end,'storefrontTier',p.storefront_tier) order by case when p.store_kind='official' then 0 else 1 end,p.display_name,p.id),'[]'::jsonb) into result
  from public.producers p left join lateral(select count(*)::bigint follower_count from private.producer_follows all_follows where all_follows.producer_id=p.id) follow_stats on true
  where p.id=any(ids) and p.status='active' and p.is_verified=true and p.deleted_at is null;
  return result;
end;
$$;
revoke all on function private.get_public_producer_follow_metrics_v1(uuid[]) from public;

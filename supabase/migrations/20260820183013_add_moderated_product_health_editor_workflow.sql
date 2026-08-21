create table if not exists private.product_health_change_requests(
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  locale text not null default 'tr' check(locale in('tr','en','de','fr','ku','ar')),
  proposed_by uuid not null references auth.users(id) on delete restrict,
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  status text not null default 'pending' check(status in('pending','approved','rejected','withdrawn')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  check(review_note is null or char_length(review_note)<=2000)
);
create unique index if not exists product_health_change_requests_open_proposer_uq on private.product_health_change_requests(product_id,locale,proposed_by) where status='pending';
create index if not exists product_health_change_requests_queue_idx on private.product_health_change_requests(status,created_at desc);
revoke all on private.product_health_change_requests from public,anon,authenticated;

create or replace function private.product_health_text_array_v1(p_value jsonb,p_label text,p_max_items integer,p_max_length integer)
returns jsonb
language plpgsql immutable
set search_path=''
as $$
declare item jsonb; value text; result jsonb:='[]'::jsonb; item_count integer:=0;
begin
 if p_value is null then return result; end if;
 if jsonb_typeof(p_value)<>'array' then raise exception 'invalid_product_health_array:%',p_label using errcode='22023'; end if;
 if jsonb_array_length(p_value)>p_max_items then raise exception 'product_health_array_too_large:%',p_label using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_value) loop
   if jsonb_typeof(item)<>'string' then raise exception 'invalid_product_health_array_item:%',p_label using errcode='22023'; end if;
   value:=btrim(item#>>'{}');
   if value='' or char_length(value)>p_max_length or value~'[\u0000-\u001F\u007F]' then raise exception 'invalid_product_health_array_item:%',p_label using errcode='22023'; end if;
   result:=result||jsonb_build_array(value); item_count:=item_count+1;
 end loop;
 return result;
end;$$;

create or replace function private.validate_product_health_payload_v1(p_payload jsonb)
returns jsonb
language plpgsql immutable
set search_path=''
as $$
declare
 info jsonb; safety jsonb; recipe jsonb; nutrition jsonb; warnings jsonb:='[]'::jsonb; warning jsonb; warning_text text; warning_severity text;
 result_info jsonb; result_safety jsonb; result_recipe jsonb; nutrition_out jsonb:='{}'::jsonb; key text; numeric_value numeric;
 summary_value text; allergen_note text; claim_policy text; recipe_title text; enabled boolean; integer_value integer; serving_size text;
begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_product_health_payload' using errcode='22023'; end if;
 if char_length(p_payload::text)>80000 then raise exception 'product_health_payload_too_large' using errcode='22023'; end if;
 if lower(p_payload::text) ~ '(tedavi eder|doğal antibiyotik|mucize|kanseri? (önler|iyileştirir)|kolesterolü düşürür|kan şekerini dengeler|hastalıklara karşı zırh|hastalığı önler|hastalığı iyileştirir)' then raise exception 'unsupported_product_health_claim' using errcode='23514'; end if;
 summary_value:=btrim(coalesce(p_payload->>'summary',''));
 if char_length(summary_value)>2000 or summary_value~'[\u0000-\u001F\u007F]' then raise exception 'invalid_product_health_summary' using errcode='22023'; end if;
 info:=coalesce(p_payload->'productInfo','{}'::jsonb); safety:=coalesce(p_payload->'safety','{}'::jsonb); recipe:=coalesce(p_payload->'recipe','{}'::jsonb);
 if jsonb_typeof(info)<>'object' or jsonb_typeof(safety)<>'object' or jsonb_typeof(recipe)<>'object' then raise exception 'invalid_product_health_sections' using errcode='22023'; end if;
 nutrition:=coalesce(info->'nutrition','{}'::jsonb); if jsonb_typeof(nutrition)<>'object' then raise exception 'invalid_product_nutrition' using errcode='22023'; end if;
 serving_size:=btrim(coalesce(nutrition->>'servingSize','')); if char_length(serving_size)>120 or serving_size~'[\u0000-\u001F\u007F]' then raise exception 'invalid_product_serving_size' using errcode='22023'; end if;
 if serving_size<>'' then nutrition_out:=nutrition_out||jsonb_build_object('servingSize',serving_size); end if;
 foreach key in array array['energyKcal','proteinG','carbohydrateG','sugarsG','fatG','saturatedFatG','fiberG','saltG'] loop
   if nutrition ? key then
     if jsonb_typeof(nutrition->key)<>'number' then raise exception 'invalid_product_nutrition_value:%',key using errcode='22023'; end if;
     numeric_value:=(nutrition->>key)::numeric; if numeric_value<0 or numeric_value>1000000 then raise exception 'invalid_product_nutrition_value:%',key using errcode='22023'; end if;
     nutrition_out:=nutrition_out||jsonb_build_object(key,numeric_value);
   end if;
 end loop;
 result_info:=jsonb_build_object(
   'ingredients',private.product_health_text_array_v1(info->'ingredients','ingredients',60,240),
   'usageNotes',private.product_health_text_array_v1(info->'usageNotes','usageNotes',30,500),
   'nutrition',nutrition_out
 );
 if safety ? 'warnings' then
   if jsonb_typeof(safety->'warnings')<>'array' or jsonb_array_length(safety->'warnings')>20 then raise exception 'invalid_product_health_warnings' using errcode='22023'; end if;
   for warning in select value from jsonb_array_elements(safety->'warnings') loop
     if jsonb_typeof(warning)<>'object' then raise exception 'invalid_product_health_warning' using errcode='22023'; end if;
     warning_text:=btrim(coalesce(warning->>'text','')); warning_severity:=lower(btrim(coalesce(warning->>'severity','info')));
     if warning_text='' or char_length(warning_text)>1000 or warning_text~'[\u0000-\u001F\u007F]' or warning_severity not in('info','low','medium','high') then raise exception 'invalid_product_health_warning' using errcode='22023'; end if;
     warnings:=warnings||jsonb_build_array(jsonb_build_object('severity',warning_severity,'text',warning_text));
   end loop;
 end if;
 allergen_note:=btrim(coalesce(safety->>'allergenNote','')); claim_policy:=btrim(coalesce(safety->>'claimPolicy',''));
 if char_length(allergen_note)>1000 or char_length(claim_policy)>1000 or allergen_note~'[\u0000-\u001F\u007F]' or claim_policy~'[\u0000-\u001F\u007F]' then raise exception 'invalid_product_health_text' using errcode='22023'; end if;
 result_safety:=jsonb_build_object(
   'schemaVersion',2,
   'storage',jsonb_build_object('title','Saklama','items',private.product_health_text_array_v1(safety->'storage','storage',30,500)),
   'preparation',jsonb_build_object('title','Hazırlama / kullanım','items',private.product_health_text_array_v1(safety->'preparation','preparation',30,500)),
   'warnings',warnings,
   'allergens',jsonb_build_object('known',private.product_health_text_array_v1(safety->'allergens','allergens',30,160),'verifyLabel',true,'text',nullif(allergen_note,'')),
   'verificationNeeded',private.product_health_text_array_v1(safety->'verificationNeeded','verificationNeeded',30,500),
   'claimPolicy',nullif(claim_policy,'')
 );
 enabled:=case when recipe ? 'enabled' then (recipe->>'enabled')::boolean else false end;
 recipe_title:=btrim(coalesce(recipe->>'title','')); if char_length(recipe_title)>240 or recipe_title~'[\u0000-\u001F\u007F]' then raise exception 'invalid_product_recipe_title' using errcode='22023'; end if;
 result_recipe:=jsonb_build_object('enabled',enabled,'title',recipe_title,
   'ingredients',private.product_health_text_array_v1(recipe->'ingredients','recipeIngredients',60,300),
   'steps',private.product_health_text_array_v1(recipe->'steps','recipeSteps',40,1000));
 foreach key in array array['servings','prepMinutes','cookMinutes'] loop
   if recipe ? key then
     if jsonb_typeof(recipe->key)<>'number' or (recipe->>key)!~'^\d+$' then raise exception 'invalid_product_recipe_number:%',key using errcode='22023'; end if;
     integer_value:=(recipe->>key)::integer;
     if integer_value<0 or integer_value>10000 or (key='servings' and integer_value>1000) then raise exception 'invalid_product_recipe_number:%',key using errcode='22023'; end if;
     result_recipe:=result_recipe||jsonb_build_object(key,integer_value);
   end if;
 end loop;
 return jsonb_build_object('summary',summary_value,'productInfo',result_info,'safety',result_safety,'recipe',result_recipe);
exception when invalid_text_representation then raise exception 'invalid_product_health_payload' using errcode='22023';
end;$$;

create or replace function private.get_my_product_health_editor_v1(p_product_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); product_row public.products%rowtype; producer_row public.producers%rowtype; entry public.content_entries%rowtype; pending private.product_health_change_requests%rowtype;
begin
 if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select * into product_row from public.products where id=p_product_id and deleted_at is null; if product_row.id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
 select * into producer_row from public.producers where id=product_row.producer_id and deleted_at is null; if producer_row.owner_user_id is distinct from uid then raise exception 'producer_product_owner_required' using errcode='42501'; end if;
 select * into entry from public.content_entries where related_product_id=p_product_id and content_type='product_health' and locale='tr' and status='published' and deleted_at is null order by updated_at desc limit 1;
 select * into pending from private.product_health_change_requests where product_id=p_product_id and locale='tr' and proposed_by=uid and status='pending' order by updated_at desc limit 1;
 return jsonb_build_object('productId',product_row.id,'productName',product_row.name,'productStatus',product_row.status,'canEdit',producer_row.status='active' and producer_row.is_verified,
   'published',case when entry.id is null then null else jsonb_build_object('contentId',entry.id,'summary',entry.summary,'productInfo',coalesce(entry.metadata->'productInfoV1','{}'::jsonb),'safety',coalesce(entry.metadata->'safetyV2','{}'::jsonb),'recipe',coalesce(entry.metadata->'recipeV1','{}'::jsonb),'updatedAt',entry.updated_at) end,
   'pending',case when pending.id is null then null else jsonb_build_object('requestId',pending.id,'payload',pending.payload,'status',pending.status,'updatedAt',pending.updated_at) end);
end;$$;
revoke all on function private.get_my_product_health_editor_v1(uuid) from public,anon; grant execute on function private.get_my_product_health_editor_v1(uuid) to authenticated;

create or replace function private.save_my_product_health_change_v1(p_product_id uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); product_row public.products%rowtype; producer_row public.producers%rowtype; clean jsonb; request_row private.product_health_change_requests%rowtype;
begin
 if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select * into product_row from public.products where id=p_product_id and deleted_at is null; if product_row.id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
 select * into producer_row from public.producers where id=product_row.producer_id and deleted_at is null; if producer_row.owner_user_id is distinct from uid then raise exception 'producer_product_owner_required' using errcode='42501'; end if;
 if producer_row.status<>'active' or not producer_row.is_verified then raise exception 'active_verified_producer_required' using errcode='42501'; end if;
 clean:=private.validate_product_health_payload_v1(p_payload);
 select * into request_row from private.product_health_change_requests where product_id=p_product_id and locale='tr' and proposed_by=uid and status='pending' for update;
 if request_row.id is null then insert into private.product_health_change_requests(product_id,locale,proposed_by,payload) values(p_product_id,'tr',uid,clean) returning * into request_row;
 else update private.product_health_change_requests set payload=clean,updated_at=timezone('utc',now()) where id=request_row.id returning * into request_row; end if;
 return jsonb_build_object('requestId',request_row.id,'productId',request_row.product_id,'status',request_row.status,'updatedAt',request_row.updated_at);
end;$$;
revoke all on function private.save_my_product_health_change_v1(uuid,jsonb) from public,anon; grant execute on function private.save_my_product_health_change_v1(uuid,jsonb) to authenticated;

create or replace function private.cancel_my_product_health_change_v1(p_request_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$declare uid uuid:=auth.uid(); changed integer; begin if uid is null then raise exception 'authentication_required' using errcode='42501'; end if; update private.product_health_change_requests set status='withdrawn',updated_at=timezone('utc',now()) where id=p_request_id and proposed_by=uid and status='pending'; get diagnostics changed=row_count; if changed=0 then raise exception 'product_health_request_not_found' using errcode='P0002'; end if; return true; end;$$;
revoke all on function private.cancel_my_product_health_change_v1(uuid) from public,anon; grant execute on function private.cancel_my_product_health_change_v1(uuid) to authenticated;

create or replace function private.super_admin_list_product_health_changes_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare uid uuid:=auth.uid(); result jsonb; begin if uid is null or not private.is_super_admin_user_v1(uid) then raise exception 'super_admin_required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('requestId',r.id,'productId',r.product_id,'productName',p.name,'productSlug',p.slug,'producerId',producer.id,'producerName',producer.display_name,'proposedBy',r.proposed_by,'payload',r.payload,'status',r.status,'createdAt',r.created_at,'updatedAt',r.updated_at) order by r.created_at),'[]'::jsonb) into result from private.product_health_change_requests r join public.products p on p.id=r.product_id join public.producers producer on producer.id=p.producer_id where r.status='pending'; return result; end;$$;
revoke all on function private.super_admin_list_product_health_changes_v1() from public,anon; grant execute on function private.super_admin_list_product_health_changes_v1() to authenticated;

create or replace function private.super_admin_get_product_health_editor_v1(p_product_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare uid uuid:=auth.uid(); p public.products%rowtype; producer public.producers%rowtype; entry public.content_entries%rowtype; requests jsonb; begin if uid is null or not private.is_super_admin_user_v1(uid) then raise exception 'super_admin_required' using errcode='42501'; end if;
 select * into p from public.products where id=p_product_id and deleted_at is null; if p.id is null then raise exception 'product_not_found' using errcode='P0002'; end if; select * into producer from public.producers where id=p.producer_id;
 select * into entry from public.content_entries where related_product_id=p_product_id and content_type='product_health' and locale='tr' and status='published' and deleted_at is null order by updated_at desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('requestId',r.id,'proposedBy',r.proposed_by,'payload',r.payload,'status',r.status,'createdAt',r.created_at,'updatedAt',r.updated_at) order by r.created_at),'[]'::jsonb) into requests from private.product_health_change_requests r where r.product_id=p_product_id and r.locale='tr' and r.status='pending';
 return jsonb_build_object('productId',p.id,'productName',p.name,'productStatus',p.status,'producerId',producer.id,'producerName',producer.display_name,'canPublish',true,'published',case when entry.id is null then null else jsonb_build_object('contentId',entry.id,'summary',entry.summary,'productInfo',coalesce(entry.metadata->'productInfoV1','{}'::jsonb),'safety',coalesce(entry.metadata->'safetyV2','{}'::jsonb),'recipe',coalesce(entry.metadata->'recipeV1','{}'::jsonb),'updatedAt',entry.updated_at) end,'requests',requests); end;$$;
revoke all on function private.super_admin_get_product_health_editor_v1(uuid) from public,anon; grant execute on function private.super_admin_get_product_health_editor_v1(uuid) to authenticated;

create or replace function private.super_admin_publish_product_health_v1(p_product_id uuid,p_payload jsonb,p_review_note text default null,p_request_id uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $$declare uid uuid:=auth.uid(); p public.products%rowtype; clean jsonb; entry public.content_entries%rowtype; old_meta jsonb:='{}'::jsonb; slug_value text; request_row private.product_health_change_requests%rowtype; begin
 if uid is null or not private.is_super_admin_user_v1(uid) then raise exception 'super_admin_required' using errcode='42501'; end if;
 if p_review_note is not null and char_length(btrim(p_review_note))>2000 then raise exception 'invalid_review_note' using errcode='22023'; end if;
 select * into p from public.products where id=p_product_id and deleted_at is null; if p.id is null then raise exception 'product_not_found' using errcode='P0002'; end if; clean:=private.validate_product_health_payload_v1(p_payload);
 if p_request_id is not null then select * into request_row from private.product_health_change_requests where id=p_request_id and product_id=p_product_id and status='pending' for update; if request_row.id is null then raise exception 'product_health_request_not_found' using errcode='P0002'; end if; end if;
 select * into entry from public.content_entries where related_product_id=p_product_id and content_type='product_health' and locale='tr' and deleted_at is null order by case when status='published' then 0 else 1 end,updated_at desc limit 1 for update;
 if entry.id is null then
   slug_value:='product-health-'||p.slug;
   if exists(select 1 from public.content_entries where content_type='product_health' and locale='tr' and slug=slug_value) then slug_value:=slug_value||'-'||substr(gen_random_uuid()::text,1,8); end if;
   insert into public.content_entries(content_type,slug,title,summary,body_markdown,body_html_sanitized,author_user_id,related_product_id,status,locale,metadata,published_at)
   values('product_health',slug_value,p.name||' - ürün bilgileri',clean->>'summary','','',uid,p.id,'published','tr',jsonb_build_object('safetyV2',clean->'safety','productInfoV1',clean->'productInfo','recipeV1',clean->'recipe'),timezone('utc',now())) returning * into entry;
 else
   old_meta:=coalesce(entry.metadata,'{}'::jsonb);
   update public.content_entries set title=p.name||' - ürün bilgileri',summary=clean->>'summary',metadata=(old_meta-'safetyV2'-'productInfoV1'-'recipeV1')||jsonb_build_object('safetyV2',(coalesce(old_meta->'safetyV2','{}'::jsonb)||clean->'safety'),'productInfoV1',clean->'productInfo','recipeV1',clean->'recipe'),status='published',published_at=timezone('utc',now()),author_user_id=uid,deleted_at=null where id=entry.id returning * into entry;
 end if;
 if request_row.id is not null then update private.product_health_change_requests set status='approved',reviewed_by=uid,reviewed_at=timezone('utc',now()),review_note=nullif(btrim(coalesce(p_review_note,'')),''),updated_at=timezone('utc',now()) where id=request_row.id; end if;
 return jsonb_build_object('productId',p.id,'contentId',entry.id,'status','published','requestId',request_row.id,'updatedAt',entry.updated_at);
end;$$;
revoke all on function private.super_admin_publish_product_health_v1(uuid,jsonb,text,uuid) from public,anon; grant execute on function private.super_admin_publish_product_health_v1(uuid,jsonb,text,uuid) to authenticated;

create or replace function private.super_admin_reject_product_health_change_v1(p_request_id uuid,p_review_note text)
returns boolean language plpgsql security definer set search_path=''
as $$declare uid uuid:=auth.uid(); changed integer; note text:=btrim(coalesce(p_review_note,'')); begin if uid is null or not private.is_super_admin_user_v1(uid) then raise exception 'super_admin_required' using errcode='42501'; end if; if char_length(note) not between 10 and 2000 then raise exception 'product_health_review_note_required' using errcode='22023'; end if; update private.product_health_change_requests set status='rejected',reviewed_by=uid,reviewed_at=timezone('utc',now()),review_note=note,updated_at=timezone('utc',now()) where id=p_request_id and status='pending'; get diagnostics changed=row_count; if changed=0 then raise exception 'product_health_request_not_found' using errcode='P0002'; end if; return true; end;$$;
revoke all on function private.super_admin_reject_product_health_change_v1(uuid,text) from public,anon; grant execute on function private.super_admin_reject_product_health_change_v1(uuid,text) to authenticated;

create or replace function public.get_my_product_health_editor_v1(p_product_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.get_my_product_health_editor_v1(p_product_id);$$;
create or replace function public.save_my_product_health_change_v1(p_product_id uuid,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.save_my_product_health_change_v1(p_product_id,p_payload);$$;
create or replace function public.cancel_my_product_health_change_v1(p_request_id uuid) returns boolean language sql security invoker set search_path='' as $$select private.cancel_my_product_health_change_v1(p_request_id);$$;
create or replace function public.super_admin_list_product_health_changes_v1() returns jsonb language sql stable security invoker set search_path='' as $$select private.super_admin_list_product_health_changes_v1();$$;
create or replace function public.super_admin_get_product_health_editor_v1(p_product_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.super_admin_get_product_health_editor_v1(p_product_id);$$;
create or replace function public.super_admin_publish_product_health_v1(p_product_id uuid,p_payload jsonb,p_review_note text default null,p_request_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.super_admin_publish_product_health_v1(p_product_id,p_payload,p_review_note,p_request_id);$$;
create or replace function public.super_admin_reject_product_health_change_v1(p_request_id uuid,p_review_note text) returns boolean language sql security invoker set search_path='' as $$select private.super_admin_reject_product_health_change_v1(p_request_id,p_review_note);$$;
revoke all on function public.get_my_product_health_editor_v1(uuid) from public,anon; grant execute on function public.get_my_product_health_editor_v1(uuid) to authenticated;
revoke all on function public.save_my_product_health_change_v1(uuid,jsonb) from public,anon; grant execute on function public.save_my_product_health_change_v1(uuid,jsonb) to authenticated;
revoke all on function public.cancel_my_product_health_change_v1(uuid) from public,anon; grant execute on function public.cancel_my_product_health_change_v1(uuid) to authenticated;
revoke all on function public.super_admin_list_product_health_changes_v1() from public,anon; grant execute on function public.super_admin_list_product_health_changes_v1() to authenticated;
revoke all on function public.super_admin_get_product_health_editor_v1(uuid) from public,anon; grant execute on function public.super_admin_get_product_health_editor_v1(uuid) to authenticated;
revoke all on function public.super_admin_publish_product_health_v1(uuid,jsonb,text,uuid) from public,anon; grant execute on function public.super_admin_publish_product_health_v1(uuid,jsonb,text,uuid) to authenticated;
revoke all on function public.super_admin_reject_product_health_change_v1(uuid,text) from public,anon; grant execute on function public.super_admin_reject_product_health_change_v1(uuid,text) to authenticated;

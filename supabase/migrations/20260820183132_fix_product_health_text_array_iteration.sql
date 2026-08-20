create or replace function private.product_health_text_array_v1(p_value jsonb,p_label text,p_max_items integer,p_max_length integer)
returns jsonb
language plpgsql immutable
set search_path=''
as $$
declare item jsonb; item_text text; result jsonb:='[]'::jsonb;
begin
 if p_value is null then return result; end if;
 if jsonb_typeof(p_value)<>'array' then raise exception 'invalid_product_health_array:%',p_label using errcode='22023'; end if;
 if jsonb_array_length(p_value)>p_max_items then raise exception 'product_health_array_too_large:%',p_label using errcode='22023'; end if;
 for item in select e from jsonb_array_elements(p_value) as t(e) loop
   if jsonb_typeof(item)<>'string' then raise exception 'invalid_product_health_array_item:%',p_label using errcode='22023'; end if;
   item_text:=btrim(item#>>'{}');
   if item_text='' or char_length(item_text)>p_max_length or item_text~'[\u0000-\u001F\u007F]' then raise exception 'invalid_product_health_array_item:%',p_label using errcode='22023'; end if;
   result:=result||jsonb_build_array(item_text);
 end loop;
 return result;
end;$$;

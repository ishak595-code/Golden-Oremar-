create or replace function private.editorial_text_array_v1(p_value jsonb,p_label text,p_max_items integer,p_max_len integer)
returns jsonb
language plpgsql
immutable
set search_path=''
as $$declare
  result jsonb:='[]'::jsonb;
  item jsonb;
  item_text text;
  count_items integer:=0;
begin
  if p_value is null then return result; end if;
  if jsonb_typeof(p_value)<>'array' or jsonb_array_length(p_value)>p_max_items then raise exception 'invalid_%',p_label using errcode='22023'; end if;
  for item in select elem from jsonb_array_elements(p_value) as elements(elem) loop
    if jsonb_typeof(item)<>'string' then raise exception 'invalid_%',p_label using errcode='22023'; end if;
    item_text:=btrim(trim(both '"' from item::text));
    if item_text<>'' then
      if char_length(item_text)>p_max_len or item_text~E'[\\u0000-\\u001F\\u007F]' then raise exception 'invalid_%',p_label using errcode='22023'; end if;
      count_items:=count_items+1;
      result:=result||to_jsonb(item_text);
    end if;
  end loop;
  if count_items>p_max_items then raise exception 'invalid_%',p_label using errcode='22023'; end if;
  return result;
end;$$;

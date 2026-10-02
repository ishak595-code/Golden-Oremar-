-- Golden Oremar: ürün hikâyesi (products.story) en fazla 1000 karakter.
-- Yönetici ve üretici ürün formlarındaki 1000 karakter sınırının veritabanı
-- karşılığıdır. Mevcut hikâyelerin tamamı 1000 karakterin altındadır
-- (20261003010000_product_story_content_v1).

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_story_length_check'
  ) then
    alter table public.products
      add constraint products_story_length_check
      check (story is null or char_length(story) <= 1000);
  end if;
end
$$;

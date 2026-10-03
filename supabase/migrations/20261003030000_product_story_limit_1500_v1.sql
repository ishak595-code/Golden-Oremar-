-- Golden Oremar: ürün hikâyesi (products.story) en fazla 1500 karakter.
-- Yönetici ve üretici ürün formlarındaki 1500 karakter sınırının veritabanı
-- karşılığıdır; 20261003011000_product_story_limit_1000_v1 kuralının yerini alır.

alter table public.products
  drop constraint if exists products_story_length_check;

alter table public.products
  add constraint products_story_length_check
  check (story is null or char_length(story) <= 1500);

insert into public.content_entries(
  content_type,slug,title,summary,body_markdown,body_html_sanitized,status,locale,tags,metadata,published_at,updated_at
) values
('faq','urunler-sertifikali-organik-mi','Tüm ürünler sertifikalı organik mi?','Organik sertifika ile doğal/köy ürünü ayrımı.','Hayır. Golden Oremar’da “sertifikalı organik” ifadesi yalnız geçerli sertifikası doğrulanmış ürünlerde gösterilir. Sertifikası olmayan bir ürün doğal, köy ürünü veya geleneksel üretim ürünü olarak sunulabilir; ancak sertifikalı organik olarak etiketlenmez. Ürün kartındaki ve detayındaki doğrulama rozetleri esas alınmalıdır.','', 'published','tr',array['güven','organik'],jsonb_build_object('category','Güven & Doğrulama','sortOrder',10),timezone('utc',now()),timezone('utc',now())),
('faq','uretici-nasil-dogrulaniyor','Üreticiler nasıl doğrulanıyor?','Üretici başvurusu ve doğrulama süreci.','Üretici hesabı kendi kendine doğrulanmış hale gelmez. Satıcı/üretici başvurusu; kimlik ve işletme bilgileri, üretim yeri, satılacak ürünler, kaynak modeli, üretim/uygunluk bilgileri ve gerekli belgelerle birlikte incelemeye alınır. Onaylanan üreticide doğrulama rozeti gösterilir. Kesin ev adresi, banka/KYC bilgileri ve özel belgeler müşteriye açılmaz.','', 'published','tr',array['güven','üretici'],jsonb_build_object('category','Güven & Doğrulama','sortOrder',20),timezone('utc',now()),timezone('utc',now())),
('faq','mense-dogrulamasi-ne-demek','Menşe doğrulaması ne anlama geliyor?','Menşe doğrulama rozetinin kapsamı.','Menşe doğrulaması, üreticinin veya ürünün kamuya açık köken bilgisinin Golden Oremar kayıtlarında doğrulanmış olduğunu gösterir. Bu rozet müşteriye üreticinin kesin ev adresini veya özel koordinatlarını açmaz. Yapılandırılmış köy/ilçe/il bilgisi veya admin tarafından doğrulanmış köken kaydı kullanılır.','', 'published','tr',array['güven','menşe'],jsonb_build_object('category','Güven & Doğrulama','sortOrder',30),timezone('utc',now()),timezone('utc',now())),
('faq','lot-qr-izlenebilirlik-nasil-calisir','Lot / QR izlenebilirlik nasıl çalışır?','Yayınlanmış lot ve takip kodu mantığı.','Bir ürün için müşteriye açılmış ve doğrulanmış lot varsa ürün detayında takip kodu, hasat/üretim/paketleme gibi yayınlanabilir bilgiler gösterilir. Henüz yayınlanmış lot yoksa uygulama QR veya lot bilgisi uydurmaz; açıkça “henüz müşteriye yayınlanmış lot bulunmuyor” bilgisini gösterir.','', 'published','tr',array['güven','izlenebilirlik'],jsonb_build_object('category','Güven & Doğrulama','sortOrder',40),timezone('utc',now()),timezone('utc',now())),
('faq','yorumlar-nasil-dogrulaniyor','Müşteri yorumları nasıl doğrulanıyor?','Doğrulanmış satın alma yorumları.','Yorum yapma hakkı teslim edilmiş veya tamamlanmış gerçek sipariş kalemine bağlıdır. Uygun sipariş kalemi için gönderilen yorum “doğrulanmış satın alma” bilgisiyle ilişkilendirilebilir. Yayınlanan değerlendirmeler ürün puanı ve yorum sayısına dahil edilir; ürünle ilgisi olmayan veya kurallara aykırı içerikler moderasyona tabi olabilir.','', 'published','tr',array['güven','yorum'],jsonb_build_object('category','Güven & Doğrulama','sortOrder',50),timezone('utc',now()),timezone('utc',now())),
('faq','magaza-takip-etme','Bir üreticiyi veya mağazayı nasıl takip ederim?','Takip ve takipçi sayısı.','Hesabınıza giriş yaptıktan sonra doğrulanmış üretici profilindeki “Takip et” düğmesini kullanabilirsiniz. Aynı düğmeyle takibi bırakabilirsiniz. Üretici profilindeki ve ürün kartlarındaki takipçi sayısı gerçek takip kayıtlarından hesaplanır; yapay veya sabit sayaç kullanılmaz.','', 'published','tr',array['üretici','takip'],jsonb_build_object('category','Hesap & Keşif','sortOrder',60),timezone('utc',now()),timezone('utc',now())),
('faq','hediye-siparisi-nasil-calisir','Hediye siparişi nasıl çalışır?','Hediye siparişi alıcı ve mesaj bilgileri.','Uygun bir ürünü hediye olarak sipariş ederken alıcı adı, telefon/e-posta bilgisi, hediye mesajı, gönderen adı ve fiyatı gizleme tercihi eklenebilir. Hediye bilgileri sipariş sahibine bağlı özel kayıtlarda tutulur. Siparişin ödeme durumu, normal siparişte olduğu gibi gerçek ödeme sağlayıcısının doğrulaması olmadan başarılı kabul edilmez.','', 'published','tr',array['sipariş','hediye'],jsonb_build_object('category','Sipariş & Teslimat','sortOrder',70),timezone('utc',now()),timezone('utc',now())),
('faq','uluslararasi-teslimat','Yurt dışına teslimat yapılabilir mi?','Uluslararası teslimat uygunluğu.','Golden Oremar uluslararası sipariş altyapısını destekler; ancak her ürün ve adres için otomatik kargo ücreti hazır olmayabilir. Ürünün ağırlığı, ihracat uygunluğu, soğuk zincir ihtiyacı ve kargo yapılandırması yeterli değilse uygulama otomatik ödeme/teslimat sözü vermez ve manuel teklif veya uygunluk kontrolü ister.','', 'published','tr',array['sipariş','uluslararası'],jsonb_build_object('category','Sipariş & Teslimat','sortOrder',80),timezone('utc',now()),timezone('utc',now())),
('faq','iade-talebi-nasil-yapilir','İade talebi nasıl yapılır?','Sipariş kalemi bazlı iade akışı.','İade işlemleri siparişin tamamından bağımsız olarak uygun sipariş kalemi üzerinden yürütülebilir. Uygunluk, durum ve gerekli kanıtlar iade akışında kontrol edilir. Güncel iade ve değişim koşulları için uygulamadaki yayınlanmış “İade ve Değişim Politikası” metni esas alınmalıdır.','', 'published','tr',array['sipariş','iade'],jsonb_build_object('category','Sipariş & Teslimat','sortOrder',90),timezone('utc',now()),timezone('utc',now())),
('faq','stok-ve-fiyat-ne-kadar-guncel','Stok ve fiyat bilgileri ne kadar güncel?','Fiyat ve stok server tarafında yönetilir.','Sepet ve sipariş oluşturulurken fiyat, varyant ve stok bilgisi sunucu tarafında yeniden doğrulanır. Uygulama ekranındaki eski bir değer tek başına sipariş otoritesi değildir. Stok kontrollü ürünlerde seçilebilecek miktar gerçek kullanılabilir stokla sınırlandırılır.','', 'published','tr',array['sipariş','stok','fiyat'],jsonb_build_object('category','Sipariş & Teslimat','sortOrder',100),timezone('utc',now()),timezone('utc',now())),
('faq','urun-guvenligi-saglik-bilgisi','Ürün güvenliği ve sağlık bilgileri tıbbi tavsiye mi?','Gıda güvenliği bilgisinin kapsamı.','Hayır. Uygulamadaki saklama, hazırlama, alerjen ve gıda güvenliği bilgileri genel güvenlik rehberidir; hastalık tanısı, tedavisi veya önlenmesi iddiası değildir. Yüksek riskli bilgiler mümkün olduğunda resmî gıda güvenliği kaynaklarına bağlanır. Ürüne özel etiket, lot, alerjen ve saklama bilgileri mevcutsa bunlar esas alınmalıdır.','', 'published','tr',array['güvenlik','sağlık'],jsonb_build_object('category','Ürün Güvenliği','sortOrder',110),timezone('utc',now()),timezone('utc',now())),
('faq','satici-basvurusu-nasil-yapilir','Satıcı / üretici başvurusu nasıl yapılır?','Satıcı başvurusu ve admin onayı.','Hesap bölümündeki satıcı başvuru akışından üretim yeri, köy, satılacak ürünler, tahmini miktarlar, kaynak/üretim modeli, sevkiyat ve gerekli belgeler girilir. Başvuru kaydedilebilir ve daha sonra devam edilebilir. Başvuru gönderildiğinde incelemeye alınır; admin onayı olmadan satıcı kendi kendine aktif olamaz.','', 'published','tr',array['satıcı','başvuru'],jsonb_build_object('category','Satıcı & Üretici','sortOrder',120),timezone('utc',now()),timezone('utc',now())),
('faq','hesabimi-kapatabilir-miyim','Hesabımı kapatabilir miyim?','Hesap kapatma talebi.','Ayarlar bölümünden hesap kapatma talebi oluşturabilir ve süreç tamamlanmadan önce uygun durumlarda talebi iptal edebilirsiniz. Hesap ve işlem kayıtlarının saklanması; güvenlik, muhasebe, sipariş/iade veya yasal yükümlülük gibi zorunlu durumlara tabi olabilir. Yayınlanmış gizlilik politikası ve uygulamadaki hesap kapatma akışı esas alınmalıdır.','', 'published','tr',array['hesap','gizlilik'],jsonb_build_object('category','Hesap & Gizlilik','sortOrder',130),timezone('utc',now()),timezone('utc',now()))
on conflict (content_type,slug,locale) do update
set title=excluded.title,
    summary=excluded.summary,
    body_markdown=excluded.body_markdown,
    body_html_sanitized=excluded.body_html_sanitized,
    status='published',
    tags=excluded.tags,
    metadata=excluded.metadata,
    published_at=coalesce(public.content_entries.published_at,excluded.published_at),
    deleted_at=null,
    updated_at=timezone('utc',now());

create or replace function private.list_public_faq_v1(p_locale text default 'tr')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  requested_locale text:=lower(btrim(coalesce(p_locale,'tr')));
  resolved_locale text;
  result jsonb;
begin
  if requested_locale not in ('tr','en','de','fr','ku','ar') then
    raise exception 'invalid_locale' using errcode='22023';
  end if;

  if exists(
    select 1 from public.content_entries ce
    where ce.content_type='faq' and ce.locale=requested_locale and ce.status='published' and ce.deleted_at is null
      and (ce.published_at is null or ce.published_at<=timezone('utc',now()))
  ) then
    resolved_locale:=requested_locale;
  else
    resolved_locale:='tr';
  end if;

  select jsonb_build_object(
    'locale',resolved_locale,
    'fallbackUsed',resolved_locale<>requested_locale,
    'total',count(*)::int,
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'id',ce.id,
      'slug',ce.slug,
      'question',ce.title,
      'answer',ce.body_markdown,
      'category',coalesce(nullif(ce.metadata->>'category',''),'Diğer'),
      'sortOrder',case when coalesce(ce.metadata->>'sortOrder','') ~ '^[0-9]+$' then (ce.metadata->>'sortOrder')::int else 999 end,
      'tags',ce.tags,
      'updatedAt',ce.updated_at
    ) order by case when coalesce(ce.metadata->>'sortOrder','') ~ '^[0-9]+$' then (ce.metadata->>'sortOrder')::int else 999 end,ce.title),'[]'::jsonb)
  ) into result
  from public.content_entries ce
  where ce.content_type='faq' and ce.locale=resolved_locale and ce.status='published' and ce.deleted_at is null
    and (ce.published_at is null or ce.published_at<=timezone('utc',now()));

  return coalesce(result,jsonb_build_object('locale',resolved_locale,'fallbackUsed',resolved_locale<>requested_locale,'total',0,'items','[]'::jsonb));
end;
$$;
revoke all on function private.list_public_faq_v1(text) from public;

create or replace function public.list_public_faq_v1(p_locale text default 'tr')
returns jsonb
language sql
stable
set search_path to ''
as $$ select private.list_public_faq_v1(p_locale); $$;
revoke all on function public.list_public_faq_v1(text) from public;
grant execute on function public.list_public_faq_v1(text) to anon,authenticated;

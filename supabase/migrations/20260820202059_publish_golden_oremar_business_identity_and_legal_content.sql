update public.brand_settings
set legal_name='Golden Oremar',
    support_email='goldenoremar@gmail.com',
    support_phone='0537 959 48 51',
    public_config=jsonb_set(
      jsonb_set(
        jsonb_set(coalesce(public_config,'{}'::jsonb),'{contactInfo,email}',to_jsonb('goldenoremar@gmail.com'::text),true),
        '{contactInfo,phone}',to_jsonb('0537 959 48 51'::text),true
      ),
      '{launchReadiness}',
      jsonb_build_object(
        'status','blocked_pending_registration_address_and_external_release_inputs',
        'reason','Marka adı ve destek iletişimi yapılandırıldı. Açık ticari/tebligat adresi ile varsa tüzel kişilik, vergi ve sicil kayıtları kesinleştiğinde yayın öncesi kimlik bilgilerine eklenmelidir.'
      ),
      true
    ),
    updated_at=timezone('utc',now())
where slug='golden-oremar';

insert into public.content_entries(content_type,slug,title,summary,body_markdown,body_html_sanitized,author_user_id,status,locale,published_at,metadata,deleted_at)
values
('legal','about','Golden Oremar Hakkında','Köy üreticisinin emeğini korumayı, doğrulanabilir ürün bilgisini görünür kılmayı ve alıcıyla üreticiyi güvenli bir pazaryerinde buluşturmayı amaçlayan Golden Oremar yaklaşımı.',
$about$
# Golden Oremar Hakkında

Golden Oremar, köyde ve yerel üretimde ortaya çıkan nitelikli ürünün değerini kaybetmeden doğru alıcıya ulaşmasını kolaylaştırmak için kurulmuş bir pazaryeri yaklaşımıdır.

Birçok küçük üretici iyi bir ürün yetiştirebilir, bal üretebilir, peynir yapabilir, hayvan yetiştirebilir, kurutmalık hazırlayabilir veya mevsimlik ürün toplayabilir. Buna karşılık ürününü nasıl tanıtacağını, dijital ortamda nasıl güven vereceğini, sipariş ve ödeme sürecini nasıl yöneteceğini ya da müşteriye nasıl ulaşacağını her zaman bilmeyebilir. Sonuçta kaliteli ürün değerinin altında satılabilir, zamanında alıcıya ulaşamayabilir veya tamamen ziyan olabilir.

Golden Oremar bu soruna iki tarafı birlikte koruyan bir sistemle yaklaşır. Üretici için amaç yalnız satış kanalı açmak değildir. Ürünün kaynağını, üreticisini, menşe bilgisini, stok durumunu, gerekiyorsa lot ve tarih bilgisini, saklama koşullarını ve doğrulanabilen belge/iddiaları düzenli biçimde sunmak; alıcı için ise ne satın aldığını daha iyi anlayabildiği, sorularını üreticiye iletebildiği ve sipariş sürecini takip edebildiği güvenilir bir ortam oluşturmaktır.

## Köyden gelen ürüne değer katmak

Golden Oremar'ın temel yaklaşımı, üreticinin emeğini görünür kılarken müşteriye karşı şeffaf kalmaktır. Ürün kartlarında ve ürün detaylarında mevcut olan bilgi backend verisinden gelir. Ürün görseli, stok, fiyat, menşe, kargo ağırlığı, soğuk zincir gereksinimi, besin/içerik bilgisi, alerjen, sertifika veya organik iddia gibi alanlar doğrulanmadan varmış gibi gösterilmez.

Balık, kırmızı et, kanatlı, yumurta ve diğer bozulabilir ürünler tek tip ürün kartı gibi ele alınmaz. Uygun olduğunda soğuk zincir, bozulabilir ürün ve raf ömrü gibi lojistik özellikler ayrıca gösterilir. Böylece ürünün niteliği ile satış deneyimi arasında gerçek bir bağ kurulur.

## Organik ve doğal ürün iddiaları

Golden Oremar'da bütün ürünler otomatik olarak "organik" kabul edilmez. Organik, sertifikalı, coğrafi işaretli veya benzeri özel nitelik iddiaları ancak bunları destekleyen bilgi ve doğrulama bulunduğunda yayınlanmalıdır. Amacımız güçlü pazarlama cümleleri kurmak değil, güveni gerçek bilgiyle büyütmektir.

## Üretici ve alıcı aynı sistemde korunur

Üretici kendi ürününü, stok ve operasyon sürecini yönetebilir; müşteri ürünü inceleyebilir, satın alabilir, soru sorabilir, sipariş ve iade sürecini takip edebilir. Platform üzerinde bağımsız üreticiler bulunabildiği gibi Golden Oremar'ın resmi mağazası da bulunabilir. Bir siparişte satıcının kim olduğu, ürün ve sipariş bağlamında açık biçimde gösterilmelidir.

Ödeme ve satıcıya aktarım süreçleri kayıt altına alınır. Marketplace ödeme sağlayıcısı üzerinden korunan bakiyenin serbest bırakılması ile manuel banka transferi aynı hak ediş için iki kez ödeme yaratmayacak şekilde ayrılır. Finans kayıtlarının amacı tarafların hakkını koruyan izlenebilir bir süreç sağlamaktır.

## Güvenin ölçüsü gerçek veridir

Golden Oremar sahte takipçi, sahte değerlendirme, sahte stok, sahte sertifika veya gerçekte bulunmayan ürün görseli üretmez. Kullanıcıya gösterilen sosyal kanıtın gerçek takipçi sayısı ile tanıtım amaçlı topluluk sayısı birbirinden ayrılır. Yayına hazır olmayan veri hazırmış gibi gösterilmez.

## İletişim

Marka: Golden Oremar  
E-posta: goldenoremar@gmail.com  
Telefon: 0537 959 48 51  
Faaliyet bölgesi bilgisi: Hakkari, Türkiye

Açık ticari/tebligat adresi ile tüzel kişilik, vergi ve sicil bilgileri kesinleştiğinde yasal kimlik alanlarına ayrıca işlenecektir. Bu bilgiler kesinleşmeden gerçeğe aykırı bir şirket kaydı yayınlanmaz.
$about$,'',null,'published','tr',timezone('utc',now()),jsonb_build_object('managedBy','release_hardening_20260820','legalBasis',jsonb_build_array('6502','6563','6698')),null),

('legal','returns','İade, Cayma ve Sorunlu Ürün Politikası','Mesafeli satışlarda cayma hakkı, bozulabilir ürün istisnaları ve ayıplı/yanlış/hasarlı ürün süreçlerinin Golden Oremar üzerindeki uygulanma esasları.',
$returns$
# İade, Cayma ve Sorunlu Ürün Politikası

Bu politika Golden Oremar üzerinden kurulan mesafeli satışlarda tüketici haklarının nasıl işletildiğini açıklar. Siparişte satıcı Golden Oremar resmi mağazası veya bağımsız bir üretici olabilir. İlgili sipariş için satıcı bilgisi ve ürün niteliği esas alınır.

## 1. Genel cayma hakkı

Kanuni istisnalardan biri uygulanmıyorsa tüketici, mesafeli satışlarda malın tesliminden itibaren 14 gün içinde cayma hakkını kullanabilir. Cayma bildiriminin uygulama içi talep, e-posta veya mevzuata uygun başka bir kalıcı veri saklayıcısı üzerinden yapılması önerilir.

Cayma hakkının usulüne uygun kullanıldığı durumlarda iade ve geri ödeme süreci sipariş kaydı üzerinden izlenir. Geri ödeme, mümkün olduğu ölçüde satın almada kullanılan ödeme aracına uygun şekilde gerçekleştirilir.

## 2. Çabuk bozulabilen ve son kullanma tarihi geçebilecek ürünler

Balık, taze et, bazı süt ürünleri, taze meyve/sebze ve benzeri çabuk bozulabilen veya son kullanma tarihi kısa olan mallarda mevzuattaki cayma hakkı istisnası uygulanabilir. Bu ürünlerde sırf fikir değişikliği nedeniyle standart cayma hakkı doğmayabilir.

Bir ürünün bozulabilir veya soğuk zincir gerektiren ürün olarak sınıflandırılması ürün verisinden gelir. Golden Oremar bu sınıflandırmayı ürün adına bakarak sonradan uydurmaz.

## 3. Hijyen ve koruyucu ambalaj

Teslimden sonra koruyucu ambalajı, bandı, mührü veya paketi açılmış ve iadesi sağlık/hijyen açısından uygun olmayan ürünlerde mevzuattaki istisnalar uygulanabilir.

## 4. Ayıplı, yanlış, eksik veya hasarlı ürünler

Cayma hakkı istisnası, ayıplı mal nedeniyle sahip olunan yasal hakları ortadan kaldırmaz. Ürün yanlış geldiyse, siparişe göre eksikse, taşıma sırasında hasar gördüyse, bozuk geldiyse veya vaat edilen temel niteliği taşımıyorsa müşteri uygulama içinden destek/iade kaydı açabilir.

Mümkün olduğunda teslimat ambalajı ve ürünün durumunu gösteren fotoğraf veya diğer kanıtlar sürecin daha hızlı değerlendirilmesine yardımcı olur. Kanıt istenmesi tüketicinin kanuni hakkını ortadan kaldırmak için kullanılmaz.

## 5. Soğuk zincir ürünleri

Soğuk zincir gerektiren ürünlerde teslimat süresi, ürün sıcaklığına ilişkin gözlem, ambalaj bütünlüğü ve teslim anındaki durum özellikle önemlidir. Güvenli olmadığı düşünülen gıda tüketilmemeli ve destek kaydı mümkün olan en kısa sürede açılmalıdır.

## 6. İade kargosu

Cayma hakkının uygulanabildiği siparişlerde iade taşıyıcısı ve iade masrafı, sipariş öncesi bilgilendirmede ve yürürlükteki mevzuata göre belirlenir. Ayıplı mal nedeniyle yapılan iadelerde tüketiciye mevzuata aykırı iade masrafı yüklenmez.

## 7. İletişim

E-posta: goldenoremar@gmail.com  
Telefon: 0537 959 48 51

Siparişle ilgili başvurularda sipariş numarasının belirtilmesi incelemeyi hızlandırır.
$returns$,'',null,'published','tr',timezone('utc',now()),jsonb_build_object('managedBy','release_hardening_20260820','legalBasis',jsonb_build_array('6502','Mesafeli Sözleşmeler Yönetmeliği')),null),

('legal','privacy','KVKK Aydınlatma ve Gizlilik Metni','Golden Oremar kullanıcı, müşteri ve üretici verilerinin hangi amaçlarla işlendiğini, kimlerle paylaşılabileceğini ve KVKK kapsamındaki hakları açıklar.',
$privacy$
# KVKK Aydınlatma ve Gizlilik Metni

Bu metin, Golden Oremar uygulaması ve ilişkili hizmetlerde işlenen kişisel verilere ilişkin genel aydınlatma ve gizlilik çerçevesini açıklar.

Veri sorumlusu kimliği için kullanılan marka adı Golden Oremar'dır. Tüzel kişilik ve ticari sicil bilgileri kesinleştiğinde bu bölüm ilgili kayıtlarla güncellenecektir.

İletişim:  
E-posta: goldenoremar@gmail.com  
Telefon: 0537 959 48 51

## 1. İşlenebilecek veri kategorileri

Hizmetin kullanımına göre ad-soyad veya görünen ad, e-posta, telefon, hesap ve oturum bilgileri, teslimat/fatura adresleri, sipariş ve iade kayıtları, ödeme işlem metadatası, destek ve mesajlaşma kayıtları, favori/takip tercihleri, bildirim cihaz bilgileri ve güvenlik kayıtları işlenebilir.

Üretici başvurularında ayrıca kimlik ve iletişim bilgileri, üretim yeri, vergi/ticari kayıt bilgileri, banka/IBAN bilgileri ve üretici tarafından sağlanan belge/sertifika bilgileri işlenebilir. Hassas üretici KYC bilgileri genel kullanıcılara açılmaz; yalnız yetkili rol ve işlem amacıyla erişilebilir ve erişim kayıt altına alınır.

Golden Oremar kart numarasını kendi veritabanında açık biçimde saklamayı hedeflemez. Ödeme işlemleri yetkili ödeme sağlayıcısının güvenli altyapısına yönlendirilebilir; uygulama yalnız gerekli ve izin verilen ödeme metadatasını saklar.

## 2. İşleme amaçları

Veriler; üyelik ve kimlik doğrulama, siparişin kurulması ve ifası, teslimat, ödeme ve iade süreçleri, müşteri desteği, üretici doğrulaması, ürün ve menşe doğrulama, dolandırıcılık ve güvenlik önleme, yasal yükümlülüklerin yerine getirilmesi, finansal kayıt ve mutabakat, bildirim tercihleri ve hizmetin teknik olarak işletilmesi amaçlarıyla işlenebilir.

Pazarlama veya ticari elektronik ileti gibi ayrıca onay gerektiren faaliyetler, ilgili onay mekanizmasına bağlı yürütülür.

## 3. Hukuki sebepler

İşleme faaliyetine göre KVKK ve ilgili mevzuatta öngörülen; kanunda açıkça öngörülme, sözleşmenin kurulması veya ifası için gerekli olma, hukuki yükümlülüğün yerine getirilmesi, bir hakkın tesisi/kullanılması/korunması, veri sorumlusunun meşru menfaati ve gerektiğinde açık rıza hukuki sebeplerinden uygun olanı kullanılır.

## 4. Veri aktarımı

Veriler yalnız hizmet için gerekli olduğu ölçüde ödeme kuruluşu, kargo/lojistik sağlayıcısı, barındırma ve veritabanı altyapısı, e-posta/push bildirim sağlayıcısı, teknik hizmet sağlayıcıları, bağımsız satıcı/üretici ve kanunen yetkili kamu kurumlarıyla paylaşılabilir.

Yurt dışına kişisel veri aktarımının söz konusu olduğu bir altyapı veya hizmet kullanıldığında KVKK'nın yürürlükteki yurt dışına aktarım hükümleri ve gerekli güvenceler uygulanır.

## 5. Saklama ve güvenlik

Veriler işleme amacı ve ilgili yasal saklama yükümlülüğü devam ettiği sürece tutulur. Süre sona erdiğinde ilgili kayıt silinir, yok edilir veya mevzuata uygun şekilde anonim hale getirilir. Finansal ve hukuki kayıtların saklama süresi sıradan profil verilerinden farklı olabilir.

Yetki kontrolü, rol tabanlı erişim, sunucu tarafı doğrulama, hassas erişim logları ve özel veri alanlarının sınırlanması gibi teknik/idari kontroller uygulanır.

## 6. KVKK kapsamındaki haklar

İlgili kişiler, KVKK kapsamındaki şartlar çerçevesinde kişisel verilerinin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işleme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme, aktarılan üçüncü kişileri bilme, eksik/yanlış verinin düzeltilmesini isteme, şartları varsa silme/yok etme talebinde bulunma, otomatik analiz nedeniyle aleyhe sonuç çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle zarar oluşması halinde giderim talep etme haklarına sahiptir.

Başvurular goldenoremar@gmail.com üzerinden iletilebilir. Kimlik doğrulama, başvurunun güvenli biçimde sonuçlandırılması için gerekli ölçüde istenebilir.
$privacy$,'',null,'published','tr',timezone('utc',now()),jsonb_build_object('managedBy','release_hardening_20260820','legalBasis',jsonb_build_array('6698','KVKK Aydınlatma Tebliği')),null),

('legal','terms','Golden Oremar Kullanım ve Mesafeli Satış Esasları','Golden Oremar pazaryerinin kullanım, satıcı rolü, sipariş, ödeme, ürün doğruluğu, teslimat ve sorumluluk esasları.',
$terms$
# Golden Oremar Kullanım ve Mesafeli Satış Esasları

Bu metin Golden Oremar uygulamasının genel kullanım ve pazaryeri esaslarını açıklar. Siparişe özel ön bilgilendirme ve mesafeli satış bilgileri, ürün ve satıcıya göre ödeme öncesinde ayrıca sunulmalıdır.

Marka: Golden Oremar  
E-posta: goldenoremar@gmail.com  
Telefon: 0537 959 48 51  
Faaliyet bölgesi bilgisi: Hakkari, Türkiye

Açık ticari/tebligat adresi ile kesin tüzel kişilik, vergi ve sicil bilgileri kuruluş/tescil süreci tamamlandığında yasal kimlik alanlarına eklenecektir. Gerçekte mevcut olmayan kayıt bilgileri yayınlanmaz.

## 1. Platform modeli

Golden Oremar, yerel/köy üreticileri ile müşterileri bir araya getiren bir elektronik ticaret pazaryeri olarak çalışabilir. Bazı ürünler bağımsız üreticiler tarafından, bazı ürünler ise Golden Oremar resmi mağazası tarafından satışa sunulabilir. Sipariş bakımından satıcı, ilgili ürün ve ödeme öncesi bilgilendirmede belirtilen taraftır.

Platform, satıcıların ürün, stok, menşe, belge, sipariş ve müşteri iletişimi süreçlerini yönetmesi için araçlar sağlar. Bu durum bağımsız satıcının kendi ürününe ilişkin yasal sorumluluklarını ortadan kaldırmaz.

## 2. Ürün bilgisi ve doğruluk

Fiyat, para birimi, stok, varyant, ürün görseli, menşe, üretici, kargo ağırlığı, soğuk zincir gereksinimi, içerik, alerjen, sağlık/gıda güvenliği bilgisi, sertifika ve benzeri alanlar mevcut backend kayıtlarına göre gösterilir. Doğrulanamayan veri varmış gibi yayınlanmamalıdır.

"Organik", "sertifikalı" veya benzeri özel nitelik iddiaları, bunları destekleyen doğrulanabilir kayıt bulunmadıkça kullanılmaz.

## 3. Sipariş ve stok

Müşteri sepete eklediği varyant ve miktarı ödeme aşamasında tekrar doğrular. Stok, fiyat ve teslimat uygunluğu sipariş kurulurken sunucu tarafından yeniden kontrol edilebilir. Teknik hata veya stok uyuşmazlığı nedeniyle sipariş tamamlanamıyorsa kullanıcıya başarısızlık durumu açıkça gösterilir; sistem hayali stok veya fiyat üretmez.

## 4. Ödeme

Kartlı ödemeler etkin olduğunda Golden Oremar'ın yapılandırdığı yetkili ödeme sağlayıcısı üzerinden yürütülür. Marketplace satışlarında satıcı payı ve platform payı ödeme altyapısındaki işlem kayıtlarıyla izlenebilir. Sağlayıcı üzerinden aynı satıcı hak edişi serbest bırakılmışsa aynı hak ediş için ikinci manuel ödeme oluşturulmamalıdır.

Uygulama içindeki "ödendi" veya "transfer edildi" gibi muhasebe statüleri, gerçek banka/ödeme sağlayıcısı hareketinin doğrulanmasıyla kullanılmalıdır.

## 5. Teslimat

Teslimat koşulları ürünün niteliğine, satıcıya, hedef adrese ve kargo/soğuk zincir gereksinimine göre değişebilir. Çabuk bozulan ürünlerde teslimat uygunluğu ve soğuk zincir özellikle önemlidir. Gönderim kısıtlamaları ve kabul edilen ödeme yöntemleri siparişten önce kullanıcıya açık biçimde gösterilmelidir.

## 6. Cayma, iade ve ayıplı mal

Genel cayma hakkı ve istisnalar için "İade, Cayma ve Sorunlu Ürün Politikası" uygulanır. Çabuk bozulabilen, kısa son kullanma tarihli veya mevzuatta ayrıca istisna tutulan ürünlerde standart cayma hakkı uygulanmayabilir. Bununla birlikte yanlış, eksik, hasarlı veya ayıplı ürün nedeniyle doğan tüketici hakları saklıdır.

## 7. Kullanıcı ve satıcı yükümlülükleri

Kullanıcılar hesap, ödeme, adres ve iletişim alanlarında doğru bilgi vermelidir. Satıcılar kendi ürünlerine ilişkin yanıltıcı açıklama, sahte sertifika, sahte menşe, sahte stok veya yanıltıcı sağlık/organik iddiası giremez.

Kötüye kullanım, dolandırıcılık, yetkisiz erişim, başka kişilerin kişisel verisini hukuka aykırı paylaşma veya platform güvenliğini bozma girişimleri hesap kısıtlamasına ve gerekli durumlarda yasal işleme konu olabilir.

## 8. Değişiklikler

Mevzuat, ödeme/lojistik altyapısı veya platform fonksiyonları değiştikçe bu metin güncellenebilir. Kullanıcı haklarını esaslı biçimde etkileyen değişiklikler uygun yöntemle duyurulur.
$terms$,'',null,'published','tr',timezone('utc',now()),jsonb_build_object('managedBy','release_hardening_20260820','legalBasis',jsonb_build_array('6502','6563','6698','Mesafeli Sözleşmeler Yönetmeliği')),null)
on conflict(content_type,slug,locale) do update
set title=excluded.title,
    summary=excluded.summary,
    body_markdown=excluded.body_markdown,
    body_html_sanitized='',
    status='published',
    published_at=coalesce(public.content_entries.published_at,timezone('utc',now())),
    metadata=coalesce(public.content_entries.metadata,'{}'::jsonb)||excluded.metadata,
    updated_at=timezone('utc',now()),
    deleted_at=null;

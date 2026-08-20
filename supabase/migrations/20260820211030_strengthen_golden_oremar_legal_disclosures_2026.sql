update public.content_entries
set title='İade, Cayma ve Sorunlu Ürün Politikası',
    summary='Mesafeli satışlarda 14 günlük cayma hakkı, bozulabilir ürün istisnaları, iade taşıma kuralları ve ayıplı/yanlış/hasarlı ürün süreçleri.',
    body_markdown=$returns$
# İade, Cayma ve Sorunlu Ürün Politikası

Bu politika Golden Oremar üzerinden kurulan mesafeli satışlarda cayma, iade ve sorunlu ürün süreçlerinin temel esaslarını açıklar. Siparişte satıcı Golden Oremar resmi mağazası veya bağımsız bir üretici olabilir. Siparişe özel satıcı bilgileri ve ürün niteliği ödeme öncesinde ayrıca gösterilmelidir.

## 1. Genel cayma hakkı

Kanuni istisnalardan biri uygulanmıyorsa tüketici, mal satışında teslim tarihinden itibaren 14 gün içinde herhangi bir gerekçe göstermeden ve cezai şart üstlenmeden cayma hakkını kullanabilir. Cayma hakkı, mal teslim edilmeden önce de kullanılabilir.

Cayma bildirimi uygulama içindeki cayma/iade sistemi, e-posta veya mevzuata uygun başka bir kalıcı veri saklayıcısı üzerinden yapılabilir. Telefon görüşmesi tek başına cayma bildirimi yöntemi olarak kabul edilmez.

Platform üzerinden kurulan mesafeli sözleşmelerde Golden Oremar, tüketicinin cayma bildirimini iletebilmesine ve takip edebilmesine elverişli sistemi erişilebilir tutmayı; sistem üzerinden gelen bildirimi ilgili satıcıya aktarmayı ve kullanıcıya kayıt/teyit bilgisini göstermeyi hedefler.

## 2. Cayma sonrası geri ödeme ve ürünün geri gönderilmesi

Cayma hakkının usulüne uygun kullanıldığı ve bir istisnanın bulunmadığı durumda satıcı, cayma bildiriminin kendisine ulaştığı tarihten itibaren mevzuatta öngörülen süre içinde, kural olarak 14 gün içinde tahsil edilen bedelleri iade eder. Geri ödeme, tüketicinin satın alırken kullandığı ödeme aracına uygun biçimde ve tüketiciye ek masraf yüklenmeden yapılmalıdır.

Tüketici, cayma bildirimini yönelttiği tarihten itibaren mevzuatta öngörülen süre içinde, kural olarak 10 gün içinde ürünü geri gönderir. Sipariş öncesi bilgilendirmede iade için belirlenen taşıyıcı kullanıldığında tüketici iade masrafından sorumlu tutulmaz. İade taşıyıcısı hiç belirtilmemişse tüketiciden iade masrafı talep edilmez. Belirlenen taşıyıcının tüketicinin bulunduğu yerde şubesi yoksa satıcı, tüketiciye ilave masraf yüklemeden ürünün alınmasını sağlamalıdır.

## 3. Çabuk bozulabilen ve son kullanma tarihi kısa ürünler

Balık, taze et, bazı süt ürünleri, taze meyve/sebze, yaş pasta ve benzeri çabuk bozulabilen veya son kullanma tarihi çabuk geçebilecek mallarda mevzuattaki cayma hakkı istisnası uygulanabilir. Bu ürünlerde yalnız fikir değişikliği nedeniyle standart cayma hakkı doğmayabilir.

Bir ürünün bozulabilir veya soğuk zincir gerektiren ürün olarak sınıflandırılması ürünün doğrulanmış backend verisinden gelir. Ürün adına bakılarak sonradan uydurulmaz.

## 4. Hijyen ve koruyucu ambalaj

Teslimden sonra ambalaj, bant, mühür veya paket gibi koruyucu unsurları açılmış ve iadesi sağlık/hijyen açısından uygun olmayan ürünlerde mevzuattaki cayma hakkı istisnası uygulanabilir.

## 5. Ayıplı, yanlış, eksik veya hasarlı ürünler

Cayma hakkı istisnası, ayıplı mal nedeniyle sahip olunan kanuni hakları ortadan kaldırmaz. Ürün yanlış geldiyse, siparişe göre eksikse, taşıma sırasında hasar gördüyse, bozuk geldiyse veya vaat edilen temel niteliği taşımıyorsa müşteri uygulama içinden destek/iade kaydı açabilir.

Mümkün olduğunda teslimat ambalajı ve ürünün durumunu gösteren fotoğraf veya diğer kanıtlar sürecin daha hızlı değerlendirilmesine yardımcı olur. Kanıt istenmesi tüketicinin kanuni hakkını ortadan kaldırmak amacıyla kullanılamaz.

## 6. Soğuk zincir ürünleri

Soğuk zincir gerektiren ürünlerde teslimat süresi, ambalaj bütünlüğü ve teslim anındaki durum özellikle önemlidir. Güvenli olmadığı düşünülen gıda tüketilmemeli ve destek kaydı mümkün olan en kısa sürede açılmalıdır.

## 7. Sipariş öncesi bilgilendirme

Sipariş tamamlanmadan önce satıcının ticari kimliği, açık adresi ve iletişim bilgileri; ürünün temel nitelikleri; vergiler dahil toplam fiyat; varsa teslimat ve diğer masraflar; ödeme ve teslim koşulları; cayma hakkının bulunup bulunmadığı ve iade taşıyıcısı gibi mevzuatın zorunlu tuttuğu bilgiler kullanıcıya açık biçimde sunulmalıdır.

Golden Oremar'ın kesin tüzel kişilik/ticari unvanı ve açık ticari/tebligat adresi tescil edilmeden production mesafeli satış açılışı tamamlanmış kabul edilmez.

## 8. İletişim

E-posta: goldenoremar@gmail.com  
Telefon: 0537 959 48 51

Siparişle ilgili başvurularda sipariş numarasının belirtilmesi incelemeyi hızlandırır.
$returns$,
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'managedBy','release_hardening_20260820',
      'legalBasis',jsonb_build_array('6502','Mesafeli Sözleşmeler Yönetmeliği'),
      'reviewedAt','2026-08-20',
      'legalStatus','prelaunch_pending_registered_business_identity',
      'reviewedAgainst','Ticaret Bakanlığı Mesafeli Sözleşmeler bilgilendirmesi'
    ),
    updated_at=timezone('utc',now())
where content_type='legal' and slug='returns' and locale='tr' and deleted_at is null;

update public.content_entries
set title='KVKK Aydınlatma ve Gizlilik Çerçevesi',
    summary='Golden Oremar teknik veri akışlarının amaç, hukuki sebep, alıcı grubu, toplama yöntemi ve ilgili kişi hakları bakımından açıklanması; kesin veri sorumlusu ticari kimliği tescil aşamasında tamamlanacaktır.',
    body_markdown=$privacy$
# KVKK Aydınlatma ve Gizlilik Çerçevesi

Bu metin Golden Oremar uygulamasındaki mevcut kişisel veri akışlarını açıklar. 6698 sayılı Kişisel Verilerin Korunması Kanununun 10 uncu maddesi uyarınca aydınlatmada veri sorumlusunun kimliği açıkça belirtilmelidir. Golden Oremar'ın kesin tüzel kişilik/ticari unvanı ve açık ticari/tebligat adresi henüz tescil bilgileriyle kesinleştirilmediği için production kullanıcı edinimi ve ticari açılış, bu kimlik bilgileri tamamlanmadan hukuki uyum bakımından hazır kabul edilmez.

Mevcut marka ve destek iletişimi:  
Marka: Golden Oremar  
E-posta: goldenoremar@gmail.com  
Telefon: 0537 959 48 51

Kesin veri sorumlusu ticari kimliği, ticaret/vergi kayıtları ve açık adres tescil edildiğinde bu bölüm yayından önce güncellenecektir. Gerçekte mevcut olmayan şirket, vergi veya sicil bilgisi yazılmaz.

## 1. Toplanan veri kategorileri ve toplama yöntemleri

Golden Oremar'da veriler; uygulamadaki üyelik, profil, adres, sipariş, iade, mesaj, destek, bildirim ve üretici başvuru formlarının kullanıcı tarafından doldurulması; kimlik doğrulama ve oturum işlemleri; sipariş/ödeme/teslimat olaylarının sistem tarafından kaydedilmesi; güvenlik ve hata kayıtlarının oluşturulması; native cihaz bildirim kaydının yapılması ve kullanıcının yüklediği belgeler aracılığıyla elektronik ve kısmen otomatik yöntemlerle elde edilebilir. Destek süreçlerinde kullanıcı tarafından iletilen kayıtlar ayrıca yetkili personel tarafından incelenebilir.

İşlenen veri kategorileri kullanılan özelliğe göre şunlardır:
- Kimlik ve hesap: görünen ad/ad-soyad, kullanıcı kimliği, hesap rolü ve hesap durumu.
- İletişim: e-posta ve telefon.
- Teslimat/fatura: alıcı adı, ülke, il, ilçe, açık adres, posta kodu ve teslimat notu.
- İşlem: sepet, sipariş, sipariş kalemleri, iade, refund ve teslimat kayıtları.
- Ödeme: ödeme sağlayıcısı işlem kimlikleri ve gerekli ödeme metadatası. Kart numarasının açık hali Golden Oremar veritabanında saklanmak üzere tasarlanmamıştır; kayıtlı kart görünümünde yalnız izin verilen maskeli bilgiler tutulur.
- İletişim/destek: kullanıcı-satıcı mesajları, destek başvuruları ve varsa kullanıcının gönderdiği ekler.
- Tercih/etkileşim: favoriler, takip edilen üreticiler, bildirim ve tema tercihleri.
- Cihaz/güvenlik: push cihaz kaydı, oturum ve güvenlik olayları, kötüye kullanım ve hata kayıtları.
- Üretici başvurusu/KYC: başvuru sahibinin kimlik ve iletişim bilgileri, üretim yeri, vergi/ticari kayıtlar, başvuruda gerekli banka/IBAN bilgileri ve kullanıcı tarafından sağlanan belge/sertifika kayıtları.

## 2. İşleme amaçları ve hukuki sebepler

Üyelik, oturum, profil, adres, sepet, sipariş, teslimat, müşteri-satıcı mesajlaşması ve sözleşmeye bağlı destek kayıtları; üyelik/satış sözleşmesinin kurulması veya ifası için gerekli olduğu ölçüde işlenir.

Ödeme, muhasebe, fatura/işlem kayıtları, yasal saklama ve yetkili kurum talepleri; ilgili mevzuatta öngörülen hukuki yükümlülüklerin yerine getirilmesi amacıyla işlenir.

İade, uyuşmazlık, sahtecilik incelemesi, chargeback/refund kayıtları ve denetim izleri; bir hakkın tesisi, kullanılması veya korunması ile hukuki yükümlülüklerin yerine getirilmesi amacıyla işlenir.

Oturum güvenliği, yetkisiz erişimin önlenmesi, teknik hata kayıtları ve dolandırıcılık önleme kontrolleri; kullanıcı hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun güvenli hizmet sunmaya ilişkin meşru menfaati ve gerektiğinde hukuki yükümlülük kapsamında işlenir.

Üretici başvurusu, satıcı doğrulaması, ödeme hesabı/IBAN eşleştirmesi ve ticari belge kontrolleri; üretici sözleşmesinin kurulması/ifası, hukuki yükümlülükler ve bir hakkın tesisi/kullanılması/korunması amaçlarıyla, işlem bazında uygun KVKK işleme şartına dayanılarak yürütülür.

Pazarlama, ticari elektronik ileti veya zorunlu hizmetin ifası için gerekli olmayan opsiyonel veri işlemleri, ilgili faaliyetin ayrıca onay gerektirdiği durumda bu onay alınmadan etkinleştirilmez. Aydınlatma ile açık rıza aynı işlem değildir ve birbirinin yerine kullanılmaz.

## 3. Verilerin aktarılabileceği alıcı grupları ve amaçları

Sipariş ve teslimat için gerekli müşteri/teslimat verileri ilgili satıcı/üretici ve kargo/lojistik sağlayıcısıyla yalnız siparişin ifası için paylaşılabilir.

Ödeme işlemi için gerekli veriler yetkili ödeme hizmeti sağlayıcısına ödeme, iade ve mutabakat amacıyla aktarılabilir.

Barındırma, veritabanı, e-posta, push ve teknik altyapı hizmeti sağlayıcıları yalnız ilgili teknik hizmetin sunulması için gerekli verilere sözleşme ve erişim kontrolleri kapsamında erişebilir.

Kanunen yetkili kamu kurumları veya yargı mercileriyle veri paylaşımı yalnız hukuki yükümlülük veya usulüne uygun resmi talep bulunduğunda yapılır.

Üreticiye ait hassas KYC/banka alanları genel müşterilere veya sıradan personele açılmaz. Uygulama sahibi Super Admin'in meşru operasyon, doğrulama, finans ve uyum görevi kapsamında ihtiyaç duyduğu erişim sunucu tarafında rol doğrulaması ve erişim kaydıyla sınırlandırılır.

## 4. Yurt dışına veri aktarımı

Kullanılan barındırma, bildirim, e-posta veya başka teknik hizmetin kişisel verileri Türkiye dışına aktarması halinde, aktarım yalnız 6698 sayılı Kanunun yürürlükteki yurt dışına aktarım hükümlerine ve gerekli hukuki güvencelere uygun mekanizma sağlandığında etkinleştirilmelidir. Production altyapı sağlayıcılarının veri yerleşimi ve aktarım mekanizmaları yayın öncesi ayrıca doğrulanmalıdır.

## 5. Saklama ve güvenlik

Kişisel veriler ilgili işleme amacı devam ettiği ve uygulanabilir mevzuattaki saklama yükümlülüğü bulunduğu süre boyunca tutulur. İşleme amacı ve saklama zorunluluğu sona erdiğinde ilgili kayıt mevzuata uygun biçimde silinir, yok edilir veya anonim hale getirilir. Finansal, uyuşmazlık ve yasal kayıtların saklama süresi sıradan profil tercihlerinden farklı olabilir.

Rol tabanlı erişim, server-side yetki doğrulaması, RLS/özel şema ayrımı, hassas erişim logları, ödeme verisinin sınırlandırılması ve üretici KYC alanlarının yetkili rollerle sınırlandırılması teknik/idari güvenlik önlemlerinin parçasıdır.

## 6. İlgili kişinin KVKK kapsamındaki hakları

İlgili kişiler Kanunun 11 inci maddesindeki şartlar çerçevesinde kişisel verilerinin işlenip işlenmediğini öğrenme; işlenmişse bilgi talep etme; işleme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme; yurt içinde veya yurt dışında aktarılan üçüncü kişileri bilme; eksik/yanlış işlenen verinin düzeltilmesini isteme; şartları varsa silme veya yok edilmesini isteme; düzeltme/silme işlemlerinin verinin aktarıldığı üçüncü kişilere bildirilmesini isteme; münhasıran otomatik sistemlerle analiz sonucu aleyhe bir sonucun ortaya çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme haklarına sahiptir.

Başvuru kanallarının kesin veri sorumlusu ticari kimliği ve mevzuata uygun başvuru adresi tescille birlikte tamamlanması gerekir. Mevcut destek e-postası: goldenoremar@gmail.com.

## 7. Production açılış koşulu

Bu çerçeve, veri akışlarının teknik gerçekliğini açıklamak için yayınlanmıştır. Kesin veri sorumlusu ticari unvanı, açık adresi, gerekli sicil/vergi bilgileri ve varsa VERBİS/başvuru kanalı yükümlülükleri değerlendirilmeden production ticari açılış hukuken tamamlanmış sayılmaz.
$privacy$,
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'managedBy','release_hardening_20260820',
      'legalBasis',jsonb_build_array('6698','KVKK Aydınlatma Tebliği'),
      'reviewedAt','2026-08-20',
      'legalStatus','prelaunch_pending_registered_data_controller_identity',
      'reviewedAgainst','KVKK Kanun m.10 ve Aydınlatma Tebliği'
    ),
    updated_at=timezone('utc',now())
where content_type='legal' and slug='privacy' and locale='tr' and deleted_at is null;

update public.content_entries
set title='Golden Oremar Kullanım ve Mesafeli Satış Esasları',
    summary='Golden Oremar pazaryerinin kullanım, satıcı rolü, sipariş, ödeme, ürün doğruluğu, teslimat ve sorumluluk esasları.',
    body_markdown=$terms$
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

## 9. Production mesafeli satış açılış kapısı

Mesafeli satış production ortamında açılmadan önce sipariş onayından hemen önce ilgili sipariş için satıcının kesin ticari unvanı, açık adresi ve iletişim bilgileri; malın temel nitelikleri; vergiler dahil toplam bedel; ek masraflar; ödeme ve teslim koşulları; şikayet/başvuru yöntemi; cayma hakkı ve varsa istisnası; iade taşıyıcısı ve mevzuatın gerektirdiği diğer ön bilgiler kullanıcıya gösterilmeli ve kullanıcının bu ön bilgileri edindiği kayıt altına alınmalıdır.

Golden Oremar'ın kesin tüzel kişilik/ticari unvanı ve açık ticari/tebligat adresi tescil edilmeden bu kapı tamamlanmış sayılmaz.
$terms$,
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'managedBy','release_hardening_20260820',
      'legalBasis',jsonb_build_array('6502','6563','6698','Mesafeli Sözleşmeler Yönetmeliği'),
      'reviewedAt','2026-08-20',
      'legalStatus','prelaunch_pending_registered_business_identity',
      'reviewedAgainst','Ticaret Bakanlığı Mesafeli Sözleşmeler bilgilendirmesi'
    ),
    updated_at=timezone('utc',now())
where content_type='legal' and slug='terms' and locale='tr' and deleted_at is null;

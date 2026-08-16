import { 
  Sun, Droplet, Leaf, Gem, Flame, 
  ShieldCheck, Zap, Heart, Star, 
  Award, CheckCircle, Truck, Users,
  Fish, Egg, Wheat, Cherry, Mountain,
  Utensils, Box, Snowflake, Coffee
} from 'lucide-react';

export const CATEGORIES = [
  { 
    id: 'et-balik',
    name: 'Et, Balık & Yumurta', 
    description: 'Doğal ortamda yetişen kırmızı et, köy tavuğu ve dağ alabalığı.',
    icon: 'Fish',
    image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5e?auto=format&fit=crop&q=80&w=800'
  },
  { 
    id: 'sut-sarkuteri',
    name: 'Süt & Şarküteri', 
    description: 'Golden Oremar\'da otlayan hayvanlardan elde edilen peynir, tereyağı ve yoğurtlar.',
    icon: 'Droplet',
    image: 'https://images.unsplash.com/photo-1486297672625-f5dc1bfe7c04?auto=format&fit=crop&q=80&w=800'
  },
  { 
    id: 'meyve-sebze',
    name: 'Taze Meyve & Sebze', 
    description: 'İlaçsız tarımla yetişen taze sebzeler ve dalından meyveler.',
    icon: 'Cherry',
    image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&q=80&w=800'
  },
  { 
    id: 'kiler',
    name: 'Kurutulmuş Gıda & Kiler', 
    description: 'Güneşte kurutulmuş meyveler, sebzeler ve tarhana.',
    icon: 'Box',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800'
  },
  { 
    id: 'dag-mahsulleri',
    name: 'Dağ Mahsulleri', 
    description: 'Işkın, dağ mantarları ve yabani otlar.',
    icon: 'Mountain',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800'
  },
  { 
    id: 'dogal-tas-enerji',
    name: 'Doğal Taşlar & Enerji', 
    description: 'Köyden çıkan şifalı taşlar, el işi objeler ve yakacak odun.',
    icon: 'Gem',
    image: 'https://images.unsplash.com/photo-1520114878144-6123742a170b?auto=format&fit=crop&q=80&w=800'
  },
  { 
    id: 'bal-sifa',
    name: 'Bal & Şifalı Bitkiler', 
    description: 'Karakovan balı, polen ve şifalı bitki çayları.',
    icon: 'Sun',
    image: 'https://images.unsplash.com/photo-1587049352847-4d43ac7b98d3?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'yoresel-icecekler',
    name: 'Yöresel İçecekler',
    description: 'Köy yapımı doğal meyve suları, şalgam ve organik kefir.',
    icon: 'Coffee',
    image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&q=80&w=800'
  }
];

export const HERO_CATEGORIES = [
  {
    id: 'altin-lezzetler',
    title: 'Altın Lezzetler',
    subtitle: 'Bal ve Şifalı Bitkiler',
    image: 'https://images.unsplash.com/photo-1587049352847-4d43ac7b98d3?auto=format&fit=crop&q=80&w=800',
    icon: 'Sun',
    targetCategory: 'bal-sifa'
  },
  {
    id: 'ciftlikten-taze',
    title: 'Çiftlikten Taze',
    subtitle: 'Süt, Et ve Yumurta',
    image: 'https://images.unsplash.com/photo-1486297672625-f5dc1bfe7c04?auto=format&fit=crop&q=80&w=800',
    icon: 'Droplet',
    targetCategory: 'sut-sarkuteri' // Primary mapping, can filter further
  },
  {
    id: 'dagin-hazinesi',
    title: 'Dağın Hazinesi',
    subtitle: 'Işkın, Mantar ve Otlar',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800',
    icon: 'Mountain',
    targetCategory: 'dag-mahsulleri'
  },
  {
    id: 'kiler-enerji',
    title: 'Kiler & Enerji',
    subtitle: 'Kuru Gıda ve Odun',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800',
    icon: 'Box',
    targetCategory: 'kiler'
  }
];

export const PRODUCTS = [

  {
    id: 801,
    homeSection: 'new_arrivals',
    name: 'Hakkari Dağ Elması (İlaçsız)',
    description: 'Yüksek rakımda, gece ve gündüz sıcaklık farkının verdiği aromayla olgunlaşan, sert ve sulu dağ elması.',
    price: 150,
    pricePrefix: 'Kg',
    category: 'Taze Meyve & Sebze',
    tags: ['İlaçsız Tarım', 'Yerel Cins'],
    reviews: 14,
    rating: 4.9,
    stock: 50,
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6fac6?auto=format&fit=crop&q=80&w=1200',
    story: 'Bu elmalar standart bahçe ürünü değildir; dağ yamaçlarında rüzgar yiyerek büyür. İçine hapsolduğu yoğun şeker ve asidite, her ısırıkta kulaklarınızı çınlatacak bir gevreklik sunar. Doğal koruma mumuna sahiptir.',
    features: ['Tamamen İlaçsız', 'Rakım: 2000m+', 'Yüksek Aroma'],
    producer: 'Yeşiltaş Köyü Çiftçileri',
    origin: 'Dağlıca Meraları',
    unit: '1 kg File',
    weight: 1000
  },
  {
    id: 802,
    homeSection: 'regular',
    name: 'Yüksekova Yayla Domatesi',
    description: 'Aromasını güneşin ve yayla rüzgarının keskinliğinden alan, asiditesi yüksek, pembe kabuklu yerli domates.',
    price: 90,
    pricePrefix: 'Kg',
    category: 'Taze Meyve & Sebze',
    tags: ['Günlük Hasat', 'Ata Tohumu'],
    reviews: 42,
    rating: 4.8,
    stock: 80,
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=1200',
    story: 'Pazardaki su deposu domatesleri unutun. Ata tohumundan üretilen, içi etli ve çekirdekleri canlı olan bu domates, sadece bir miktar tuzla bile sofranın baş köşesine geçebilecek kadar lezzetlidir.',
    features: ['Toprakta Doğal Yetişim', 'Suni Gübresiz', 'Gerçek Domates Kokusu'],
    producer: 'Hakkari Organik Tarım Koperatifi',
    origin: 'Yüksekova',
    unit: '1 kg Seçme',
    weight: 1000
  },

  // --- BAL ÇEŞİTLERİ (Kişiselleştirilmiş İsimler ve Dağlıca Vurgusu) ---
  {
    id: 101,
    homeSection: 'best_sellers',
    name: 'Sınır Ötesi 3000 Rakım Karakovan Balı',
    description: 'Sadece sarp kayalıklarda, arıların kendi ördüğü peteklerle sıfır müdahale ile üretilen efsanevi kaya balı.',
    price: 3200,
    pricePrefix: 'Emeğin Değeri',
    category: 'Bal & Şifalı Bitkiler',
    tags: ['Nadir Hasat', 'Kara Kovan'],
    reviews: 140,
    rating: 5.0,
    stock: 5,
    image: 'https://images.unsplash.com/photo-1587049352847-4d43ac7b98d3?auto=format&fit=crop&q=80&w=1200',
    story: 'Süleyman Usta, her sonbahar hayatını tehlikeye atarak Dağlıca\'nın en sarp kayalıklarına tırmanır. Bu kovanlara asla şurup veya endüstriyel balmumu girmez. Arılar kendi özleriyle örer, kendi dilleriyle doldurur. Boğazınızı nazikçe yakan, altın renkli bu şifa deposu, doğanın kilitli sandığından sizin için çıkarılıyor.',
    features: ['Süleyman Usta\'nın Riskli Kaya Hasadı', 'Tamamen Doğal Kendi Yapımı Balmumu', 'Sınırlı Üretim (Yılda Sadece 35 Kilo)', 'Dağlıca Zirveleri Endemik Otu Aroması'],
    producer: 'Arıcı Süleyman Usta',
    unit: '1 kg Ahşap Kutu',
    origin: 'Dağlıca Zirveleri',
    preOrder: false,
    weightOptions: [
      { label: '500 gr (Nadir Tadım)', price: 1800 },
      { label: '1 kg (Tam Kutu)', price: 3200 }
    ]
  },
  {
    id: 102,
    homeSection: 'seasonal',
    name: 'Berçelan Yaylası Bahar Çiçek Balı',
    description: 'Baharın ilk aylarında uyanan doğanın tüm nektarını barındıran, Fatma Ana\'nın dualarla sağdığı berrak çiçek süzmesi.',
    price: 1100,
    pricePrefix: 'Doğrudan Üreticiden',
    category: 'Bal & Şifalı Bitkiler',
    tags: ['İlkbahar Hasadı', 'Çiçek Özü'],
    reviews: 320,
    rating: 4.8,
    stock: 25,
    image: 'https://images.unsplash.com/photo-1620063223011-85b46e30bba9?auto=format&fit=crop&q=80&w=1200',
    story: 'Kışın ardından Berçelan yaylasına vuran ilk güneşle uyanan kovanlar, Fatma Ana\'nın gözetiminde ilkbaharın en körpe çiçeklerinden öz toplar. Bu bal asla ısıtılmaz, tamamen soğuk sıkım merkezkaçla alınır. Kokladığınızda Berçelan\'ın o serin, çiçeksi havasını içinize çekersiniz.',
    features: ['Fatma Ana\'nın Geleneksel Soğuk Sağımı', 'Isıl İşlem Görmemiş Canlı Enzimler', 'Kristalize Olabilen Canlı Yapı', 'Bahar Neşesi Veren Hafif Aroma'],
    producer: 'Fatma Ana',
    unit: '1 kg Cam Kavanoz',
    origin: 'Berçelan Yaylası',
    weightOptions: [
      { label: '500 gr', price: 650 },
      { label: '1 kg', price: 1100 }
    ]
  },
  {
    id: 103,
    homeSection: 'offers',
    name: 'Avaşin Meşe Balı',
    description: 'Avaşin vadisinin ulu meşelerinden süzülen, antioksidan değeri en yüksek olan koyu renkli şifa balı.',
    price: 1450,
    pricePrefix: 'Özel Hasat',
    category: 'Bal & Şifalı Bitkiler',
    tags: ['Koyu Renk', 'Antioksidan'],
    reviews: 85,
    rating: 4.9,
    stock: 12,
    image: 'https://images.unsplash.com/photo-1558231221-50bc969796ff?auto=format&fit=crop&q=80&w=1200',
    story: 'Meşe balı çiçekten değil, ulu meşe ağaçlarının gövdelerindeki özel şıralardan elde edilir. Ormanın derinliklerinden gelen bu esmer tenli, yoğun ve genzi titreten mucize, kronik hastalıklarla savaşta köylülerin en büyük sırrıdır.',
    features: ['Çiçek Değil Ağaç Reçinesi Mucizesi', 'Normal Baldan 4 Kat Fazla Antioksidan', 'Astım ve Bronşit Üzerinde Rahatlatıcı Etki', 'Şeker Hastalarına Uyumlu Düşük Glisemik Yapı'],
    producer: 'Hüseyin Dayı',
    unit: '1 kg Cam Kavanoz',
    origin: 'Avaşin Vadisi'
  },

  // --- SÜT VE SÜT ÜRÜNLERİ (Kişisel Meralar) ---
  {
    id: 803,
    homeSection: 'natural',
    name: 'Dağ Çileği (Yabani)',
    description: 'Amanos ve Toros dağlarının yüksek yamaçlarında kendiliğinden yetişen, mis kokulu, minik ve çok lezzetli yabani dağ çileği.',
    price: 350,
    pricePrefix: 'Toplama Hazinesi',
    category: 'Taze Meyve & Sebze',
    tags: ['Yabani Hasat', 'Mevsimlik'],
    reviews: 65,
    rating: 4.8,
    stock: 20,
    image: 'https://images.unsplash.com/photo-1543158181-e6f9f6712055?auto=format&fit=crop&q=80&w=1200',
    story: 'Yıllarca bu minik kırmızı mücevherleri aramak için yamaçlara tırmanan köylü kadınlarının el emeği.',
    features: ['Tamamen Yabani', 'C Vitamini Kaynağı', 'Nadir Bulunur'],
    producer: 'Yerel Toplayıcılar',
    origin: 'Toros Dağları',
    unit: '1 kg Kutu',
    originalPrice: 400
  },
  {
    id: 804,
    homeSection: 'natural',
    name: 'Ekşi Karadut Suyu (Şekersiz)',
    description: 'Ağaç dalından silkelenen ekşi karadutların odun ateşinde kaynatılarak elde edilen, yoğun kıvamlı ve mayhoş suyu.',
    price: 180,
    pricePrefix: 'Şifa İksiri',
    category: 'Yöresel İçecekler',
    tags: ['Katkısız', 'Bağışıklık'],
    reviews: 42,
    rating: 4.9,
    stock: 50,
    image: 'https://images.unsplash.com/photo-1614214227848-ee0ca9de9297?auto=format&fit=crop&q=80&w=1200',
    story: 'Karadut suyu eski çağlardan beri boğaz yaralarına ve aftlara karşı köylerimizde bir şifa kaynağı olarak bilinir.',
    features: ['Şeker İlavesiz', 'Yoğun Kıvam', 'Ateşte Kaynatılmış'],
    producer: 'Dağ Köy Atölyesi',
    origin: 'Ege Köyleri',
    unit: '1 Litre Cam Şişe',
    originalPrice: 200
  },
  {
    id: 805,
    homeSection: 'best_sellers',
    name: 'Hardaliye (Geleneksel)',
    description: 'Üzüm şırasının hardal tohumu ve çeşitli baharatlarla fermantasyona uğratılmasıyla elde edilen alkolsüz, şifalı bir kış içeceği.',
    price: 250,
    pricePrefix: 'Ev Yapımı',
    category: 'Yöresel İçecekler',
    tags: ['Fermante', 'Sindirim Dostu'],
    reviews: 80,
    rating: 4.8,
    stock: 45,
    image: 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?auto=format&fit=crop&q=80&w=1200',
    story: 'Trakya ve civar köylerde kış aylarının vazgeçilmezi olan bu probiyotik içecek, sindirimi rahatlatır ve vücudu sıcak tutar.',
    features: ['Alkolsüz Fermantasyon', 'Hardal Tohumlu', 'Bağışıklık Destekleyici'],
    producer: 'Kırklareli Üretim Kooperatifi',
    origin: 'Trakya',
    unit: '1 Litre Cam Şişe',
    originalPrice: 280
  },
  {
    id: 806,
    homeSection: 'seasonal',
    name: 'Kıtır Taze Çağla (Badem)',
    description: 'Henüz çekirdeği oluşmamış, ekşiliği ve kütür kütür dokusuyla baharın müjdecisi olan taze badem çağlası.',
    price: 180,
    pricePrefix: 'Bahar Müjdesi',
    category: 'Taze Meyve & Sebze',
    tags: ['Mevsimlik', 'Günlük Hasat'],
    reviews: 35,
    rating: 4.6,
    stock: 30,
    image: 'https://images.unsplash.com/photo-1616422285623-14c1cd815e98?auto=format&fit=crop&q=80&w=1200',
    story: 'Badem ağaçlarının çiçek döküp meyveye durduğu ilk haftalarda toplanan bu lezzet, üzerine biraz tuz serpilerek tüketilmeyi bekliyor.',
    features: ['Çekirdeksiz Dönem', 'Tam Çıtır', 'Ekşi ve Ferahlatıcı'],
    producer: 'Bademli Köyü Çiftçiliği',
    origin: 'Ege & Akdeniz',
    unit: '1 kg Sepet',
    originalPrice: 220
  },
  {
    id: 807,
    homeSection: 'seasonal',
    name: 'Ata Tohumu Dağ Kekiği Suyu (Distile)',
    description: 'Yüksek rakımlı dağlardan toplanan kekiklerin buhar distilasyonu ile elde edilen konsantre aromatik uçucu yağı alınmamış saf kekik suyu.',
    price: 140,
    pricePrefix: 'Sindirim İksiri',
    category: 'Yöresel İçecekler',
    tags: ['Saf Distilasyon', 'Antiseptik'],
    reviews: 88,
    rating: 4.9,
    stock: 40,
    image: 'https://images.unsplash.com/photo-1596541571217-14234054fa25?auto=format&fit=crop&q=80&w=1200',
    story: 'Köyde sabahları aç karnına bir kahve fincanı içilerek bağışıklığı zırh gibi sağlamlaştıran çok eski bir Yörük adeti.',
    features: ['Aroma Terapötik', 'Steril Cam', 'İçilebilir Saf Form'],
    producer: 'Toros Yörük Kadınları',
    origin: 'Toros Dağları',
    unit: '500 ml Cam Şişe',
    originalPrice: 180
  },
  {
    id: 808,
    homeSection: 'seasonal',
    name: 'Kışlık Kurutulmuş Cennet Hurması',
    description: 'Sonbaharın son güneşleriyle çatı aralarında pamuk ipliğinde kurutulan, içi bal gibi yumuşacık kalan muazzam tatlılıkta bütün cennet hurması.',
    price: 380,
    pricePrefix: 'Atıştırmalık Şifa',
    category: 'Taze Meyve & Sebze',
    tags: ['İplikte Kurutma', 'Şekersiz'],
    reviews: 55,
    rating: 4.9,
    stock: 25,
    image: 'https://images.unsplash.com/photo-1596719586178-00d86a6058e5?auto=format&fit=crop&q=80&w=1200',
    story: 'Köyde her evin balkonunu süsleyen bu turuncu boncuklar, kış akşamlarının en masum ve lezzetli misafiridir.',
    features: ['Geleneksel Askı Yöntemi', 'Kahve Yanı', 'Yoğun Besleyici'],
    producer: 'Zehra Teyze',
    origin: 'Artvin, Türkiye',
    unit: '500 gr Kutu',
    originalPrice: 420
  },
  {
    id: 809,
    homeSection: 'best_sellers',
    name: 'Kekik Aromalı Vişne Kompostosu',
    description: 'Yazdan toplanıp odun ateşinde az şeker ve bir dal kuru kekikle kaynatılan, hem ferahlatan hem sindirimi düzenleyen köy usulü komposto.',
    price: 130,
    pricePrefix: 'Ferahlatıcı',
    category: 'Yöresel İçecekler',
    tags: ['Yaz Sıcağına', 'Ev Yapımı'],
    reviews: 70,
    rating: 4.8,
    stock: 60,
    image: 'https://images.unsplash.com/photo-1614214227848-ee0ca9de9297?auto=format&fit=crop&q=80&w=1200',
    story: 'Eskiden misafire ilk sunulan ikram olan buz gibi komposto geleneği, az tatlandırmayla yeniden canlanıyor.',
    features: ['Saf Meyve Suyu', 'Odun Ateşi Kıvamı', 'Koruyucusuz'],
    producer: 'Yerel Ev Hanımları',
    origin: 'Anadolu',
    unit: '1 Litre Cam Şişe',
    originalPrice: 160
  },
  {
    id: 201,
    homeSection: 'new_arrivals',
    name: 'Merez Hatun\'un Mağara Tulum Peyniri',
    description: 'Gün yüzü görmeden doğal kaya mağaralarında 8 ay uyutulan, kekik ve şirden mayasıyla lüksleşmiş şaheser.',
    price: 850,
    pricePrefix: 'Emeğin Değeri',
    category: 'Süt & Şarküteri',
    tags: ['8 Ay Mağara', 'Gurme'],
    reviews: 210,
    rating: 5.0,
    stock: 10,
    image: 'https://images.unsplash.com/photo-1486297672625-f5dc1bfe7c04?auto=format&fit=crop&q=80&w=1200',
    story: 'Merez Hatun, koyunlarının sütünü her sabah gün ağarmadan sağar. İçine attığı gizli dağ kekiği ve kendi elleriyle hazırladığı şirden mayasıyla yoğurur. Bu peynir taze yenmez; Yüksekova\'nın serin mağaralarına götürülür, deri tulumlarda tam 8 ay karanlıkta olgunlaşır. Kestiğinizde burnunuza vuran o keskin toprak ve süt kokusu sizi başka diyarlara götürür.',
    features: ['Merez Hatun\'un Gizli Reçetesi', 'Öz Hakiki Şirden Mayası', '8 Ay Karanlık Mağara Uyutması', 'Milyarlarca Aktif Doğal Probiyotik'],
    producer: 'Merez Hatun',
    unit: '1 kg Kese',
    origin: 'Yüksekova Mağaraları'
  },
  {
    id: 202,
    homeSection: 'best_sellers',
    name: 'Naciye\'nin Saf Yayık Tereyağı',
    description: 'Sabahın ilk serinliğinde Naciye Teyze\'nin kocaman ahşap yayıklarda döverek çıkarttığı bembeyaz köy yağı.',
    price: 650,
    pricePrefix: 'Doğrudan Üreticiden',
    category: 'Süt & Şarküteri',
    tags: ['Ahşap Yayık', 'Taze'],
    reviews: 180,
    rating: 4.8,
    stock: 30,
    image: 'https://images.unsplash.com/photo-1588195538320-067d0bc11314?auto=format&fit=crop&q=80&w=1200',
    story: '"Makine yağı bozar oğul" der Naciye Teyze. Tahta yayığın o tok sesiyle birleşen soğuk dağ suları, taze sütün kaymağını ayrıştırır ve bu muhteşem sarımtırak beyazlıkta tereyağını oluşturur. Tavanıza attığınızda erirken çıkardığı o mis gibi süt kokusu, yapay kahvaltılarınızı bir şölene dönüştürecektir.',
    features: ['Naciye Teyze\'nin Birebir Kol Gücü', 'Su Çekilmeden Sadece Süt Tuzu İle Korunmuş', 'Tavada Asla Yanıp Kararmaz', 'Halis İnek Sütü Kaymağı'],
    producer: 'Naciye Teyze',
    unit: '1 kg Rulo',
    origin: 'Dağlıca Ovası',
    weightOptions: [
      { label: '500 gr', price: 350 },
      { label: '1 kg', price: 650 },
      { label: '2 kg (Bereket Paketi)', price: 1200 }
    ]
  },
  {
    id: 203,
    name: 'Havahan\'ın Otlu Dağ Peyniri',
    description: 'Avaşin meralarından toplanan sirmo, heliz ve mendo otlarıyla yoğrulmuş, salamurada dinlenmiş gerçek Hakkari klasiği.',
    price: 550,
    pricePrefix: 'Geleneksel Lezzet',
    category: 'Süt & Şarküteri',
    tags: ['Yöresel', 'Bol Otlu'],
    reviews: 410,
    rating: 4.9,
    stock: 25,
    image: 'https://images.unsplash.com/photo-1559561853-08451507cbe7?auto=format&fit=crop&q=80&w=1200',
    story: 'Havahan, baharın ilk haftalarında kızlarıyla birlikte dağlara çıkar. Zirveyi kucaklayan o mucizevi sirmo (yabani sarımsak) otunu toplar. Günlerce salamura suyunda terbiye edilen peynir, bu otların aromasıyla bütünleştiğinde ağızda muhteşem, sert ama ufalanan bir doku bırakır. Kahvaltının şahı, tandır ekmeğinin en iyi dostudur.',
    features: ['Havahan ve Dağ Otları Toplayıcıları', 'Zengin Sirmo, Mendo ve Heliz Otu İhtivası', 'Kaya Tuzu Salamurası Sayesinde Uzun Ömürlü', 'Mükemmel Çiğneme Formu ve Sert Doku'],
    producer: 'Havahan Abla',
    unit: '1 kg Kalıp',
    origin: 'Avaşin Etekleri',
    weightOptions: [
      { label: '1 kg Kalıp', price: 550 },
      { label: '3 kg Bidon', price: 1500 }
    ]
  },
  {
    id: 204,
    homeSection: 'natural',
    name: 'Günlük Taze Cıvık Süt (Sağımdan Kapıya)',
    description: 'Amine Ana\'nın merada serbest gezen ineklerinden şafak vakti sağılan, kaynatılmadan taptaze ulaştırılan canlı köy sütü.',
    price: 180,
    pricePrefix: 'Abonelik Fırsatı',
    category: 'Süt & Şarküteri',
    tags: ['Günlük Sevkiyat', 'Çiğ Süt'],
    reviews: 80,
    rating: 5.0,
    stock: 10,
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&q=80&w=1200',
    story: 'Karton kutulara girmemiş, pastörizasyon makinelerinde ölü sıvıya dönüştürülmemiş gerçek süt... Amine Ana sabah yıldızı gökteyken sağar, biz aynı sabah cam şişelerle kapınıza getiririz. Kaynattığınızda parmak kalınlığında kaymağı bardağın üstünü kapatır, eski bayramların kahvaltılarındaki o zenginliği geri getirir.',
    features: ['Amine Ana\'nın Üşütmeden Şafak Sağımı', 'Isıl İşlem Görmemiş, Kaynatılmamış Çiğ Süt', 'Cam Şişeyle Özel Araç Taşıması', 'İki Parmak Kalınlığında Doğal Kaymak Garantisi'],
    producer: 'Amine Ana',
    unit: '3 Litre (Cam Şişe)',
    origin: 'Hakkari Özgür Meraları',
    preOrder: true,
    preOrderTime: 'Siparişinizin verildiği gece vakti özel olarak sağılır ve sabahın ilk ışıklarında canlılığını kaybetmeden size teslim edilir.'
  },
  {
    id: 205,
    name: 'Taze Yayık Ayranı (Canlı Kültür)',
    description: 'Gerçek köy yoğurdundan yayıklanarak çekilmiş, yüzeyi kaymaklı, gazlı asiditeyle ferahlığın zirvesi.',
    price: 120,
    pricePrefix: 'Ev Yapımı',
    category: 'Yöresel İçecekler',
    tags: ['Soğuk Zincir', 'Yoğun Kaymak'],
    reviews: 55,
    rating: 4.8,
    stock: 20,
    image: 'https://images.unsplash.com/photo-1570757235282-eeb29587c672?auto=format&fit=crop&q=80&w=1200',
    story: 'Misafir geldiğinde köylerimizin en prestijli ikramıdır o hafif ekşimiş, bol köpüklü, üzerinde tereyağı zerreleri yüzen ayran. Endüstriyel homojenize ayranları unutun. Her yudumda boğazınızdan inen doğal laktik asit silsilesi, yorgunluğunuzu bıçak gibi kesip atacak.',
    features: ['Hakiki Köy Yoğurdundan Dövüldü', 'Üzerinde Yüzen Doğal Tereyağı Zerreleri', 'Yapay Asitlendirme Değil, Doğal Ekşime', 'Muhteşem Susuzluk Giderici'],
    producer: 'Naciye Teyze',
    unit: '2 Litre (Cam Sişe)',
    origin: 'Dağlıca'
  },

  // --- ET, BALIK VE PROTEİN (Ön Sipariş & Concierge) ---
  {
    id: 301,
    homeSection: 'concierge',
    name: 'Avaşin Deresi Canlı Alabalığı (Özel Hasat)',
    description: "Yapay havuzların durgun sularını hiç tanımamış, Avaşin Deresi'nin buz gibi ve hırçın akıntılarında kaslanarak büyümüş kırmızı benekli vahşi alabalık. Sadece size özel bir randevu ile usta balıkçılarımız tarafından derede avlanır.",
    price: 1800,
    pricePrefix: 'Exclusive Concierge',
    category: 'Et, Balık & Yumurta',
    tags: ['VIP Ön Sipariş', 'Doğa Hasadı'],
    reviews: 12,
    rating: 5.0,
    stock: 3,
    image: 'https://images.unsplash.com/photo-1580476262798-b768a41bf823?auto=format&fit=crop&q=80&w=1200',
    story: 'Bizde balığa sipariş geldiğinde ağlar veya olta sandıktan çıkar. Siparişinizi oluşturursunuz, köyün balıkçıları Avaşin Deresi\'nin tehlikeli akıntılarında uzun bir gece geçirir. Dereden çıkar çıkmaz şoklanarak buz içi kasalarda doğrudan adresinize yönlendirilir. Yem ile değil, derenin kendi döngüsüyle büyümüş bu somon renkli kırmızı yaban balığının lezzetini kelimeler tarif edemez.',
    features: ['Sadece Sipariş Üzerine Dereden Avlanma', 'Havuzlarda Hareketsiz Büyütülmemiştir (Sıkı Kas Yapısı)', 'Pembe İçi ve Derin Vadi Suyu Temizliği', 'Teslimata Özel Buzlu Concierge Çantasıyla Ulaşım'],
    producer: 'Avaşin Vadisi Balıkçıları',
    unit: 'Min. 1.5 - 2 kg Taze Bütün',
    origin: 'Avaşin Deresi Suları',
    preOrder: true,
    preOrderTime: 'Siparişinizi 2 gün önceden oluşturun. Onayınızla usta ekiplerimiz Avaşin Deresi\'ne iner; 2 veya 3 gün içerisinde yakalanan bu eşsiz kırmızı balık, sağlıkla kapınıza ulaştırılır.',
    cutOptions: [
      { label: 'Bütün Olarak Gönder', price: 1800 },
      { label: 'Fleto Çıkarılmış (Kılçıksız)', price: 1950 },
      { label: 'Temizlenmiş - Porsiyonluk', price: 1900 }
    ]
  },
  {
    id: 302,
    homeSection: 'concierge',
    name: 'Abidin\'in Yayla Kuzusu (VIP Bütün/Parçalı)',
    description: 'Sıfır küspe, %100 kekik ve kuzu kulağı meralarında gezen ince elyaflı, paha biçilmez Dağlıca kuzu eti.',
    price: 12500,
    pricePrefix: 'Tam Hayvan Rezerve',
    category: 'Et, Balık & Yumurta',
    tags: ['Concierge Service', 'Helal Kesim'],
    reviews: 24,
    rating: 5.0,
    stock: 5,
    image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5e?auto=format&fit=crop&q=80&w=1200',
    story: 'Abidin Dayı çadırını Dağlıca sırtlarına kurduğunda sürüsü özgürlüğe adım atar. Günde 15 kilometre tırmanan, buz gibi rüzgarlarda gelişen bu hayvanlar asla kapalı besi görmemiştir. Siparişiniz oluşturulduğunda, uzman kasaplarımız eşliğinde adınıza İslami usullere uygun kesimi yapılır, istediğiniz formatta mühürlenip, dry-age standartlarında dinlendirilerek size tahsis edilir.',
    features: ['Abidin Dayı\'nın %100 Gezen Yayla Kuzusu', 'Adınıza Özel Kesim (Helal ve Şeffaf)', 'Asla Enjekte Hormon veya Suni Yem Yoktur', 'Profesyonel Kasaplarımız Tarafından İstenen Dizayna Getirilir'],
    producer: 'Çoban Abidin',
    unit: '1 Bütün Kuzu (Ort. 16-20 kg)',
    origin: 'Dağlıca Meraları',
    preOrder: true,
    preOrderTime: 'Adınıza özel seçim ve kesim işlemlerinin ardından, kusursuz dinlendirme süreciyle 7 gün içerisinde size özel teslimatı sağlanır.',
    cutOptions: [
      { label: 'Bütün Gövde (Soğuk Transfer)', price: 12500 },
      { label: 'Kemikli Parçalama (Kuşbaşı, Pirzola Ayıklanmış)', price: 13300 },
      { label: 'Özel Mühürlü VIP Paket (Difriz Düzeni)', price: 13700 }
    ]
  },
  {
    id: 303,
    homeSection: 'concierge',
    name: 'Fahrettin\'in Sütten Kesilmiş Oğlağı',
    description: 'Keçi etinin en tatlı, en lokum hali. Henüz doğanın o taze otları harici hiçbir şey tüketmemiş oğlak eti ziyafeti.',
    price: 10500,
    pricePrefix: 'Özel Tahsis',
    category: 'Et, Balık & Yumurta',
    tags: ['Gurme Seçim', 'Sıfır Yağ Oranı'],
    reviews: 8,
    rating: 4.9,
    stock: 2,
    image: 'https://images.unsplash.com/photo-1623855244183-52fd8d3ce7f7?auto=format&fit=crop&q=80&w=1200',
    story: 'Keçi etinin lezzetini bilenler, oğlak için aylarca beklerler. Fahrettin Usta\'nın sarp kayalıklarda atlaya zıplaya büyüyen yetkin oğlakları, dünya üzerindeki en az kolesterole sahip, damakta zeytinyağı zarafetiyle eriyen efsanevi bir kırmızı ettir. Şeflerin lüks restoranlarında fırın tepsilerinde sunduğu şölen artık kendi sofranızda.',
    features: ['Fahrettin\'in Ustaca Keçi Güdümünden Süzme Cins', 'Minimum Kolekstrol, Yüksek Amino-Asit Dizilimi', 'Ağırlık Yapmayan, Kokusuz Temiz Keçi Doğallığı', 'Concierge VIP Teslimat'],
    producer: 'Fahrettin Usta',
    unit: '1 Adet Bütün Oğlak (10-14 kg)',
    origin: 'Hakkari Zirveleri',
    preOrder: true,
    preOrderTime: 'Üst düzey gurme deneyimi için adınıza tahsis edilir; özel serbest peşrev sonrası 10 gün içerisinde VIP ekibimizle adresinize ulaştırılır.',
    cutOptions: [
      { label: 'Fırınlık Bütün', price: 10500 },
      { label: 'Parçalı Servis', price: 11100 }
    ]
  },
  {
    id: 304,
    homeSection: 'natural',
    name: 'Salih\'in Meralık Özgür Horozu',
    description: 'Et suyuna şifa arayan asırlık reçetelerin baş aktörü. 6-8 ay doğada börtü böcekle güçlenmiş hakiki pehlivan köy horozu.',
    price: 650,
    pricePrefix: 'Şifa Odaklı',
    category: 'Et, Balık & Yumurta',
    tags: ['Suyuna Şorba', 'Gerçek Doku'],
    reviews: 45,
    rating: 4.8,
    stock: 12,
    image: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&q=80&w=1200',
    story: 'Markette gördükleriniz 40 günde şişirilen piliçlerdir. Salih Dayı\'nın bahçesindeki horozlar, en az 6 ay boyunca toprak eşeler, kurtçuk arar, koşarak kas yaparlar. Tencereye girdiğinde eti asla hamur gibi dağılmaz, lezzetli kırmızı kemik iliği suyun içine nüfuz eder. Gerçek hasta çorbaları ancak Salih Dayı\'nın horozlarıyla yapılır.',
    features: ['Salih Dayı Gözetiminde Doğal Avcı Horoz', 'Tansiyon Dengeleyen Doğal Tuzlu Suyuluk Et', 'Koyu Renkli, Sıkı Elastik Lif Yapısı', 'Helal Temiz Kesim'],
    producer: 'Kümenci Salih Dayı',
    unit: '1 Adet (2.5 - 3 kg)',
    origin: 'Köy İçi Meralar'
  },
  {
    id: 305,
    homeSection: 'best_sellers',
    name: 'Amine\'nin Çifte Sarı Köy Yumurtası',
    description: 'Büyük ve yaşlı tavukların hasır folluklara bıraktığı, kırmakla dağılmayan sapsarı çifte sarılı yumurtalar.',
    price: 320,
    pricePrefix: 'Sabah Neşesi',
    category: 'Et, Balık & Yumurta',
    tags: ['Mega Boy', 'Çifte Sarı'],
    reviews: 200,
    rating: 5.0,
    stock: 40,
    image: 'https://images.unsplash.com/photo-1587486913049-53fc88f28453?auto=format&fit=crop&q=80&w=1200',
    story: 'Amine Yenge sabah kümese girdiğinde büyüklüğüyle "beni al" diyen yumurtaları bilir. İçini açtığınızda gülen iki göz gibi sarıları sizi karşılar. Çocukların en sevdiği, puf gibi kabarık keklerin baş kahramanıdır. Asla fabrika yemi görmemiş, buğday kırmasıyla demlenmiştir.',
    features: ['Amine Yenge\'nin İki Sarı Seçkisi', 'Zengin Protein ve Yoğun D Vitamini', 'Büyük Boyutuyla Ekstra Besleyicilik', 'Doğal Sarı Güneş Rengi'],
    producer: 'Amine Yenge Kümesi',
    unit: '30 Adet (Özel Viop Koli)',
    origin: 'Köy İçi Folllukları'
  },

  // --- DOĞAL MİRAS SEÇKİSİ ---
  {
    id: 401,
    homeSection: 'new_arrivals',
    name: 'Avaşin Orijinal Kaynak Suyu (Cam Damacana)',
    description: 'Dünyanın en düşük iletkenlik oranlarından birine sahip, dağın kalbinden camla mühürlenen içimlik kristal.',
    price: 250,
    pricePrefix: 'Arınma Anı',
    category: 'İçecekler & Su',
    tags: ['19L Cam', 'Alkali pH 8.4'],
    reviews: 65,
    rating: 4.9,
    stock: 100,
    image: 'https://images.unsplash.com/photo-1558227092-26284f1a0e74?auto=format&fit=crop&q=80&w=1200',
    story: 'Plastik borularda değil, Avaşin\'in beyaz kireç taşlarının arasından süzülerek binlerce yılda oluşan bir saflık... Musluk suları ve markalı sanayi suları bedeni yorarken, Avaşin\'in bu pH 8.4 alkali gücü hücrelerinizi ilk günden itibaren yıkar, parlatır. Dağ suyunu evinize kalın cam damacanalar içinde ilk bozan biz olmuyoruz, onu koruyoruz.',
    features: ['Dağın Kalbinden Borusuz Doğrudan Dolum', 'Gıdaya Uygun Ağır Cam Damacanada Muhafaza', 'Doğal Magnezyum ve Kalsiyum Çözeltisi', 'Beden Asiditesini Nötrleyen Ağırbaşlı Alkali Yapı'],
    producer: 'Avaşin Kaynak İşletmesi',
    unit: '19 Litre Cam',
    origin: 'Avaşin Zirvesi',
    preOrder: true,
    preOrderTime: 'Siparişinize istinaden özel cam damacanalara doğanın özünden doldurulur; abonelik sistemi ekseninde prestijle adresinize sunulur.'
  },
  {
    id: 402,
    homeSection: 'offers',
    name: 'Köyün Efsanevi Beyaz Isıtma/Pres Taşı',
    description: 'Tandır altlarında yemeği sıcak tutmak veya şifa için bele-sırta koymak amacıyla kullanılan özel ısı emici kalsit minerali.',
    price: 180,
    pricePrefix: 'Kültürel Miras',
    category: 'Doğal Taşlar & Enerji',
    tags: ['Tıbbi Gelenek', 'Evladiyelik'],
    reviews: 32,
    rating: 4.7,
    stock: 50,
    image: 'https://images.unsplash.com/photo-1549488344-c7ef7850ee8c?auto=format&fit=crop&q=80&w=1200',
    story: 'Köy evlerimizin demirbaşıdır beyaz taş. Soba yanarken üstüne bırakılır. Gece soba söndüğünde bu taş, sabaha kadar odaya ve bedene ılıcık bir ısı yayar. Kışın yatağın baş ucuna konur, bebeklerin beşik direğine sarılır. Hem muhteşem pürüzsüz dokusuyla dekoratiftir, hem de bin yıllık bir ev kaloriferidir.',
    features: ['Hakkari Beyaz Kalsit Madeninden Kopan Orijinal Parçalar', 'Ateşte Isıtıldığında 4-6 Saat Doğal Isı Yayar', 'Tandır Altı Ekmeği Sıcak Tutmak İçin Evladiyelik Kullanım', 'Soğuk Çeken Eklemlere Doğal Komprese Uygun'],
    producer: 'Köy Taş Ustaları',
    unit: '1 Adet Oval Tıraşlı Taş (2-4 kg)',
    origin: 'Köy Çatlakları'
  },
  {
    id: 403,
    name: 'Sobalık Çıtırtılı Saf Meşe Yarığı',
    description: 'Sıfır is çıkararak evinizi fırına çeviren, köye inen uzman oduncuların dağdaki kuru ağaçlardan seçtiği şömine ruhu.',
    price: 450,
    pricePrefix: 'Kışlık Hazırlık',
    category: 'Doğal Taşlar & Enerji',
    tags: ['Kuru Uzun Yanar', 'Şömine Tipi'],
    reviews: 55,
    rating: 4.9,
    stock: 200,
    image: 'https://images.unsplash.com/photo-1520114878144-6123742a170b?auto=format&fit=crop&q=80&w=1200',
    story: 'Kutsal meşe ağaçlarına balta vurulmaz, sadece rüzgarda düşen, doğanın bize bıraktığı asırlık gövdeler toplanır. Şöminede yanarken duyacağınız o asil çıtırtı, is yapmayan saf kor ve inanılmaz ısı yayan bu odun parçaları, evinizin şıklığını tamamlayan mükemmel kış arkadaşlarıdır.',
    features: ['Maksimum Isı, Minimum Kül (Şık Şömine Ruhu)', 'Mükemmel Fırınlanmış, Tam Kuru, Böceksiz', 'Oduncuların Standart Bölümlemesiyle Mükemmel Tasarım', 'Kuzine Sobalar İçin İdeal Pişirim Ateşi'],
    producer: 'Köy Ormancıları',
    unit: '30 kg Tel Kafes Bağlamı',
    origin: 'Hakkari Meşelikleri'
  },

  // --- KİLER VE KURU GIDA ---
  {
    id: 501,
    homeSection: 'new_arrivals',
    name: 'Hatun Ana\'nın Ekşi Maya Güneşi (Tarhana)',
    description: 'Haftalarca çömleklerde dağ kekiğiyle yoğrulup mayalanan, taşların üzerinde kızaran yoğun probiyotik şorba.',
    price: 350,
    pricePrefix: 'Ev Yapımı Efsane',
    category: 'Kurutulmuş Gıda & Kiler',
    tags: ['Ateş Kesici', 'Ekşi Otlu'],
    reviews: 80,
    rating: 4.8,
    stock: 45,
    image: 'https://images.unsplash.com/photo-1548943487-a2e4f43b4852?auto=format&fit=crop&q=80&w=1200',
    story: 'Kış yaklaştığında Hatun Ana kazanların altını yakar. Süzme yoğurt, dağlardan gelen kurutulmuş sebzeler ve eski buğdaylar birleşip ekşimek için günleri bekler. Sonbahar güneşinde bembeyaz çarşaflara dökülen bu kırmızı altın tozu, nezle olan çocuğun alnına konan soğuk bez kadar devadır.',
    features: ['Hatun Ana\'nın Orijinal Bakır Çömlek Fermantasyonu', 'Tam Bağırsak Dostu Zengin Floralı Katıksız Yoğurt', 'Soğuk Algınlığı Savaşçısı (Çift Baharat)', 'Hazır Çorba Fabrikasyonuna Baş Kaldırı'],
    producer: 'Hatun Ana',
    unit: '1 kg Keten Torba',
    origin: 'Köy Meydanı'
  },
  {
    id: 502,
    homeSection: 'offers',
    name: 'Sami Usta\'nın Kurutulmuş Dağ Dutları',
    description: 'İrice, lekesiz beyaz dutların gölgede değil güneşte kıtırlaşarak karamele döndüğü sabah kahvaltısı kürü.',
    price: 400,
    pricePrefix: 'Enerji Tılsımı',
    category: 'Kurutulmuş Gıda & Kiler',
    tags: ['Kansızlık Kür', 'Pekmez Tılsımı'],
    reviews: 110,
    rating: 5.0,
    stock: 60,
    image: 'https://images.unsplash.com/photo-1603569283896-1934988f04fd?auto=format&fit=crop&q=80&w=1200',
    story: 'Sami Usta, dut ağaçlarının ne zaman silkeleneceğini rüyasında gördüğünü söyler. Pazarlarda kükürtle sarartılan sırım gibi dutlara benzemez; güneşte balı dışarı taşıp esmerleşir ve bir lokmada dişinize yapışan muazzam, hafif çıtır bir doğal pekmeze dönüşür.',
    features: ['Sami Usta\'nın Titiz Sırık Hasadı', 'Ceviz Ağacı Çarşaflarında Rüzgar Kurutması', 'Fabrika Beyazlatıcısı Asla Kullanılmamıştır', 'Her Sabah Düzenli Tüketimde Demir Zırhı'],
    producer: 'Sami Usta',
    unit: '1 kg Hava Almaz Paket',
    origin: 'Aşağı Bahçeler'
  },
  {
    id: 503,
    homeSection: 'natural',
    name: 'Kadın İmecesi Odun Ateşi Pekmezi',
    description: 'Devrilme bakır kazanlarda üzüm sularının hiç şeker atılmadan 18 saat boyunca koyultulduğu kara elmas.',
    price: 550,
    pricePrefix: 'Şifa Damlası',
    category: 'Kurutulmuş Gıda & Kiler',
    tags: ['Asırlık Reçete', 'Demir Şurubu'],
    reviews: 130,
    rating: 4.9,
    stock: 40,
    image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&q=80&w=1200',
    story: 'Üzüm bağı bozumları bir köy kutlamasıdır. Kadınlar şarkılarla beyaz toprak serptiği şıraları sabaha kadar çevirerek ateşle savaşır. Köy evinin soba tütüşü bu pekmezin rayihasında gizlidir. Kahvaltıda üzerine döktüğünüzde tereyağıyla vals yapar, vücut ısısını saniyeler içinde zıplatır.',
    features: ['Bakır Kazanda Saatlerce Süren Kıvam Alma Süreci', 'Koruma ve Stabilizasyon İçin Sadece Aktif Beyaz Dağ Toprağı', 'Soğuk Kış Sabahlarında Sıfır Şekerli Doğal Antifriz', 'Damar Temizleyici ve Akciğer Ferahlatıcı'],
    producer: 'Dağlıca Kadın Kolektifi',
    unit: '1 kg Cam Kavanoz',
    origin: 'Üzüm Bağları'
  },
  {
    id: 504,
    name: 'Hüsnü Dayı\'nın Kağıt Kabuklu Cevizi',
    description: 'Büyütmek için değil asırlık ağaçların zirvesinden rüzgarla dökülen, içindeki yağı taptaze hissiyatlı iri cins.',
    price: 450,
    pricePrefix: 'Lezzet Sırrı',
    category: 'Kurutulmuş Gıda & Kiler',
    tags: ['Zihin Gücü', 'Omega Zırhı'],
    reviews: 95,
    rating: 4.8,
    stock: 55,
    image: 'https://images.unsplash.com/photo-1599598425947-33002620ebb6?auto=format&fit=crop&q=80&w=1200',
    story: 'Hüsnü Dayı\'nın ektiği fidanlar artık torunlarının torunlarını gölgesinde serinletiyor. Toprakta kalan zengin mineraller, cevizin içine beyne uzanan kıvrımlarla işler. Kimyasala banılmadığı için kabuğunu kolayca parmağınızla kırarsınız ve o dolgun acılaşmamış iç yağ damarlarınızı şifalandırmak için sofranıza düşer.',
    features: ['Hüsnü Dayı\'nın Geleneksel Kurutma Süreci', 'Lekesiz ve Küflenmeyen İri Beyaz İç Yapısı', 'Parmak Gücüyle Ayrılan Kağıt Kalınlığında Kabuk', 'Kalp Damar Sağlığını Destekleyen Konsantre Omega-3'],
    producer: 'Hüsnü Dayı',
    unit: '1 kg File',
    origin: 'Yüksek Zirve Ağaçları'
  },
  {
    id: 505,
    homeSection: 'offers',
    name: 'El İşçiliği Meşe Palamudu Ekmeği',
    description: 'Taş değirmenlerde üğütülen ata tohumlarıyla, fırınlanmış palamut tozunun mayalanarak oluşturduğu asırlık esmer somun.',
    price: 250,
    pricePrefix: 'Ata Yadigarı',
    category: 'Kurutulmuş Gıda & Kiler',
    tags: ['Lif Bombası', 'Özel Sipariş'],
    reviews: 42,
    rating: 5.0,
    stock: 15,
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=1200',
    story: 'Savaş yıllarından kalma, bedeni ayakta tutan unutulmuş bir efsanedir Palamut unlu ekmek. Ayşe Teyze bu sırrı anneannesinden öğrendi. Mayası üç günde tutar, tandırda ağır kömürde pişer. İçi dolu doludur, sünger gibi sönmez. Sadece bir dilimi, modern buğdayların iki ekmeğine bedel tokluk ve enerji sağlar.',
    features: ['Ayşe Teyze\'nın Sabır Reçetesi (5 Günlük Yapım)', 'Meşe Palamudu ve Mısır Ununun Şifa Dengesi', 'Modern Glütene Meydan Okuyan Organik Sıkılık', 'Derin Dondurucuda 6 Ay Dayanıklı Taş Gibi Gövde'],
    producer: 'Ayşe Teyze',
    unit: '1 Adet Dev Somun (1.5 kg)',
    origin: 'Köy Tandırları',
    preOrder: true,
    preOrderTime: 'Haftada bir yakılan geleneksel köy tandırında adınıza tahsis edilmiş hamuruyla ağır ağır pişerek kapınıza uzanır.'
  },
  {
    id: 506,
    homeSection: 'new_arrivals',
    name: 'İsli Kaya Üzümleri (Tane Kuru)',
    description: 'Sıcak tandır taşlarının üzerine serilerek hafif is alan, iri çekirdekli antioksidan kütüphanesi.',
    price: 320,
    pricePrefix: 'Özel Zevk',
    category: 'Kurutulmuş Gıda & Kiler',
    tags: ['Gevrek Gevrek', 'Odun İsli'],
    reviews: 60,
    rating: 4.7,
    stock: 35,
    image: 'https://images.unsplash.com/photo-1596719586178-00d86a6058e5?auto=format&fit=crop&q=80&w=1200',
    story: 'Pekmez yapımından arta kalan o en diri, o en şişkin üzümler seçilir. Tandırın odunsu siyah isinde sıcak taşların üzerinde kavrularak kurur. Piyasada göremeyeceğiniz, damağa geldiğinde hafif bir meşe odunu isi ve sonrasında üzümün vahşi şekeri patlar. Gece atıştırmalıklarınızın vazgeçilmez asilzadsi.',
    features: ['Benzersiz Tandır ve Odun İsinde Kurutma', 'Potasyum Zirvesi ve Sindirim Dostu İri Çekirdek', 'Kalitesiz Parlatıcı Sulu Banyodan Uzak (Mat Görünüm)', 'Rafine Şeker İsteğini Bıçak Gibi Kesen Tokluk'],
    producer: 'Harun Emmi',
    unit: '1 kg Özel Bez Kese',
    origin: 'Köy Çatıları'
  },
  {
    id: 507,
    name: 'Zahter Harmanı Dağ Kekiği',
    description: 'Zirvelerin sert rüzgarlarında minicik ama zehir gibi keskin kokulu açan yaban kekiklerinin ustalıkla toplanmış harmanı.',
    price: 220,
    pricePrefix: 'Esans Şöleni',
    category: 'Kurutulmuş Gıda & Kiler',
    tags: ['Antiseptik', 'Marinasyon'],
    reviews: 154,
    rating: 4.9,
    stock: 70,
    image: 'https://images.unsplash.com/photo-1596541571217-14234054fa25?auto=format&fit=crop&q=80&w=1200',
    story: 'Zahteri bulmak zordur. Kartalların uçtuğu rakımlarda kök salar. Güneş vurmadan, çiçeğini dökmeden toplanır ve karanlık, serin odalarda ahengini kaybetmeden kurutulur. Zeytinyağına bir tutam eklendiğinde kahvaltıyı kralların sofrasına çevirir. Kış çaylarında astıma karşı en soylu silahtır.',
    features: ['Erişilmez Yüksekliklerden Kaya Ocağı Hasadı', 'Mide Ve Bağırsak İltihaplarına Karşı %100 Yaban Savunması', 'Açık Yeşil Rengini Koruyan Serin Oda Kurutması', 'Kuzu Ve Et Pişirimlerinde Etki Arttırıcı Özel Konsantrasyon'],
    producer: 'Genç Kartallar Ekibi',
    unit: '250 gr (Büyük Boy Kutu)',
    origin: 'Aşılmaz Kayalıklar'
  },
  
  // --- ÖZEL ORMAN MAHSULLERİ ---
  {
    id: 601,
    homeSection: 'seasonal',
    name: 'Sessiz Orman Kuzu Göbeği Mantarı',
    description: 'Yağmur sonrası ustaların ağaç diplerinden iğneyle kuyu kazar gibi çıkardığı taze orman altını.',
    price: 2500,
    pricePrefix: 'Gurme Concierge',
    category: 'Dağ Mahsulleri',
    tags: ['Nadir Bulunuş', 'İksir'],
    reviews: 18,
    rating: 5.0,
    stock: 2,
    image: 'https://images.unsplash.com/photo-1604543519967-17296041acce?auto=format&fit=crop&q=80&w=1200',
    story: 'Kuzu göbeğinin yetiştiği yeri babadan oğula fısıldarlar. Ormanın bu büzüşük, altınsünger mantarı doğanın topraktan fışkıran etidir. Fransız şeflerin menüsünde kral tacı giyer. Fabrika kültürü yapılamaz, insan zekasına boyun eğmez; sadece doğa lütfederse tavanızda asilce kendi yağıyla dans eder.',
    features: ['Usta Avcılar Tarafından Tane Tane İşaretlenip Bulunur', 'Kas İltihabını Temizleyen Nadir Bitkisel Yapı', 'Kültürü ve Tohumu Yapılamayan Benzersiz Vegan Et', 'Sıcak Tereyağında Ceviz, Toprak ve Odun Alt Notaları'],
    producer: 'Orman Sakallıları',
    unit: '500g Vakum Servis',
    origin: 'Kör Orman Derinlikleri',
    preOrder: true,
    preOrderTime: 'Doğanın mucizevi anında keşfedildiği o taze sabah, eşsiz rayihasını kaybetmeksizin eksi dereceli VIP şoklama ile size uğurlanır.'
  },
  {
    id: 602,
    name: 'Kan Kırmızı Yabani Kızılcık Şurubu Seti',
    description: 'Ağaçların çalı kısımlarından iğnelere dayanıp toplanan, sadece şekersiz ve kaynatılarak yapılmış tazeleyici bir ruh halesi.',
    price: 450,
    pricePrefix: 'Can Şenliği',
    category: 'Yöresel İçecekler',
    tags: ['Tazeletici', 'C Vitamini'],
    reviews: 77,
    rating: 4.8,
    stock: 25,
    image: 'https://images.unsplash.com/photo-1596485800037-338b1d9bf5c1?auto=format&fit=crop&q=80&w=1200',
    story: 'Kızılcıklar kızardığında dağların süsü olur. Bu şurup sulandırılmamıştır. Meyvesi saatlerce taş havanlarda dövülerek özünü dışarı salar. Kavurucu bir yaz gününde, içine birkaç kırık buz attığınızda damağa bir uyarıcı iğne gibi saplanan o harika mayhoşluk, sizi diriltir ve yorgunluğunuzu yıkar geçer.',
    features: ['C Vitamini Yönünden Portakalı Üçe Katlayan Vahşi Asidite', 'Böbrek Taşına ve Kumuna Karşı Eski Dönem Savaşçısı', 'Koruyucu İçermeyen %100 Soğuk Pres Mantığı', 'İnce Çizgili Cam Şişede Hediyelik Form'],
    producer: 'Hasat Kadınları',
    unit: '1 Litre Konsantre (İskenderun Şişe)',
    origin: 'Yüksek Dağ Çalılıkları'
  },
  {
    id: 603,
    homeSection: 'seasonal',
    name: 'Kırık Taş Kaya Tuzu Bloğu (Kristal)',
    description: 'Okyanusların henüz yeryüzüne çıkmadığı çağlardan kalan kaya altı pembe/beyaz damarlı kırık tuz bilyeleri.',
    price: 300,
    pricePrefix: 'Tertemiz Maden',
    category: 'Doğal Taşlar & Enerji',
    tags: ['İyot Sırrı', 'Bakteri Kesici'],
    reviews: 140,
    rating: 4.9,
    stock: 80,
    image: 'https://images.unsplash.com/photo-1621683935213-90d1f7c22eac?auto=format&fit=crop&q=80&w=1200',
    story: 'Bu tuz, markette satılan rafine edilen sahte bembeyaz tuza benzemez. Traktör ve dinamo girmemiş madenlerden dedelerimizin kazmayla çıkardığı canlı bir kristaldir. Radyasyon bilmeyen, mikro plastik taşımayan, 84 ayrı minerale sahip beden orkestrasının en saf şefidir.',
    features: ['%100 Kaya İçi Ham ve Yıkanmamış Kesim', 'Vücut Elektrolit Dengesini İhya Eden Tam Mineral Dizi', 'Dileyene Tuz Lambası Dileyene Değirmenlik Boyut', 'Sıvı Drenajıyla Ödem Atımını Hızlandıran Alkali Katı'],
    producer: 'Maden Emekçileri',
    unit: 'Büyük Parçalar (5 kg Çuval)',
    origin: 'Bölge Kaya Altları',
    cutOptions: [
      { label: 'Bütük Blok Olarak (Değirmene)', price: 300 },
      { label: 'Kıbrıs Türü (Ezilmiş Tane)', price: 350 }
    ]
  },
  
  // --- ZİRVE 30. ÜRÜNE KADAR EKLEMELER ---
  {
    id: 701,
    name: 'Güneş Sırrı Guzu Yağı (İç Yağ)',
    description: 'Zar zor bulabileceğiniz, geleneksel kebapların ve kavurmaların ruhu, kuzunun altın kalbinden süzülmüş doğal donyağı.',
    price: 500,
    pricePrefix: 'Şeflerin Sırrı',
    category: 'Et, Balık & Yumurta',
    tags: ['Aroma Çarpanı', 'Saf Don'],
    reviews: 60,
    rating: 4.7,
    stock: 15,
    image: 'https://images.unsplash.com/photo-1615486511484-95e0c6aeb8c3?auto=format&fit=crop&q=80&w=1200',
    story: 'Etin lezzetini sırrı budur. Yemeklerinize bir kaşık bıraktığınızda o kömür ızgarası ferahlığını, kırsalın bütün tatlarını yemeğin etrafına zırh gibi saray. Kötü kolestrol değil, aksine geleneksel damarlarımızın alışkın olduğu asil yapıdır.',
    features: ['Abidin\'in Yayla Kuzularından Ayıklanan Kış Yağı', 'Erimiş Odun Ateşinde Tortusuz Dinlendirme Safiyeti', 'Kavurma, Köfte Ve Bakır Tava Yemeklerine İmza Ruh', 'Oda Sıcaklığında Kaya Gibi Duran Gerçek Organik Yağ'],
    producer: 'Kasap Mahmut',
    unit: '1 kg Bez Kavanoz',
    origin: 'Kasap Meydanı'
  },
  {
    id: 702,
    name: 'Sabır Kurutması Çiçek Bamyası',
    description: 'İğne oyası gibi sabah güneşi vurmadan toplanıp tülbent ipliklerine dizilen yeşil mücevherler.',
    price: 750,
    pricePrefix: 'El Emeği',
    category: 'Kurutulmuş Gıda & Kiler',
    tags: ['Zahmetli', 'Dört Mevsim'],
    reviews: 120,
    rating: 4.9,
    stock: 25,
    image: 'https://images.unsplash.com/photo-1559404281-546ec03b14d2?auto=format&fit=crop&q=80&w=1200',
    story: 'Köy kadınlarının parmakları delinerek, göz nuru dökerek hazırladığı bu bamya "yazık olmasın diye değil", "kıymetli olsun diye" kurutulur. Haşlandığında bir yaz bamyasından daha diridir. Kuzunun eşsiz suyunda demlenirken, o iplere dizilmiş bütün sevgi yemeğe akar.',
    features: ['Şafak Vakti Çiçeği Kapanmadan Tek Tek Ayırma Zanaatı', 'En İnce Yorgan İğneleriyle Tane Delmeden Dizilim', 'Güneş Görmeyen Havalı Çardak Kurutmasıyla Kararmayan Yeşil', 'Demir Ve Sindirim Lifi Patlaması'],
    producer: 'Nene Hatun İmecesi',
    unit: '1 Dizin (50 - 60 cm Parça)',
    origin: 'Yukarı Obalar'
  },
  {
    id: 703,
    name: 'Kekik Aromalı Kesik Yoğurt (Kurud)',
    description: 'Dağ yörüklerinin heybelerinde aylarca bozulmayan, yoğurdun dev kazanlarda çöktürülüp sıkılmış peynirsi mermeri.',
    price: 450,
    pricePrefix: 'Gezginin Gıdası',
    category: 'Süt & Şarküteri',
    tags: ['Küflenmez', 'Toka Tokluk'],
    reviews: 92,
    rating: 4.8,
    stock: 40,
    image: 'https://images.unsplash.com/photo-1559561853-08451507cbe7?auto=format&fit=crop&q=80&w=1200',
    story: 'Uzun kervan yollarının asil kumanyasıdır Keş (Kurud). Hatun Teyze köyün artan bütün ayranlarını kazanlarda saatlerce tıkırdatır, tuzlar ve bez torbaların üstünde ağır taşların altına basar. Daha sonra güneşte küçük peynir kuleleri gibi tıkır tıkır kurutulur. Kırıp suda erittiğinizde ayran, makarnaya rendelediğinizde devasa bir tuzlu peynir patlaması yapar.',
    features: ['Eksiği Tamamlayan Doğal Yörük Konservesi Süt', 'Protein Oranı Etle Yarışan Kuru Sıkım Kalıcılığı', 'Tuz Ve Güneş İle Çelikleşip 2 Yıl Bozulmayan Efsane', 'Anadolu Makarna ve Keşkek Şölenlerinin Sır Rendelemesi'],
    producer: 'Hatun Teyze',
    unit: '1 kg Bez Çuval (Parça Peynir)',
    origin: 'Kervan Çadırları'
  },
  {
    id: 704,
    name: 'El İşlemesi Tahta Kaşık ve Yayık Tokmağı',
    description: 'Selim Ustanın ardıç ve şimşir ağaçlarından yedi günde oyarak çıkardığı, yemeklere ağaç tadı geçirmeyen usta işi eşya.',
    price: 650,
    pricePrefix: 'Özel Zanaat',
    category: 'Doğal Taşlar & Enerji',
    tags: ['Sağlıklı Ahşap', 'Yadigar'],
    reviews: 40,
    rating: 5.0,
    stock: 12,
    image: 'https://images.unsplash.com/photo-1628102379761-12502787e974?auto=format&fit=crop&q=80&w=1200',
    story: 'Metalin sütün ve yemeğin kimyasını bozduğu bir asırda, şimşir ağacı mutfağın asilzadsi kalır. Selim Usta ince çakısıyla yedi gün yorulur, ateşte yağlayıp parlatır. Kuşaktan kuşağa mutfakta gezen bu kaşık, plastiklerden ve metalin ağır metal tehdidinden ruhunuzu ve şifanızı koruyacak kalkanınızdır.',
    features: ['Sertleştirilmiş Aşınmaz Ve Çürümez Şimşir Ağacı Gövdesi', 'Ototik Usta Kesimi. Vernik Veya Sanayi Boyası Sürülmemiştir', 'Doğal Zeytinyağı Banyosu İle Emdirilmiş Antibakteriyel Su İtici Doku', 'Çorbanın Aşınmaz Gecesine Yoldaş'],
    producer: 'Selim Usta',
    unit: '1 Adet Kaşık + Tokmak Seti',
    origin: 'Usta Tezgahı'
  },
  {
    id: 705,
    homeSection: 'best_sellers',
    name: 'Büyük İskender Çörek Otu Tohumu (Organik)',
    description: 'Hastalıkların fısıldadığı korkuyu yırtıp atan, taş değirmende ezildiğinde odaları simsiyah esansa boyayan kutsal tohum.',
    price: 250,
    pricePrefix: 'Ölüm Hariç Her Şeye',
    category: 'Bal & Şifalı Bitkiler',
    tags: ['Kutsal Şifa', 'Preslenmemiş'],
    reviews: 310,
    rating: 5.0,
    stock: 80,
    image: 'https://images.unsplash.com/photo-1611074092550-93bcbc07ddf9?auto=format&fit=crop&q=80&w=1200',
    story: 'Piyasadaki gibi makine yağından artan kuru saplar değildir. Bu toprakların sert tabanından güneşe boy vermiş ihtişamlı yağ dolu, şişkin siyah çekirdeklerdir. Havanda kendiniz ezdiğiniz o ilk saniyede burnunuza vuran baharat harmanı, vücudunuzdaki her tıkalı damarı açmaya hazır bir şifadır.',
    features: ['Tohum İçi Öz Yağı %100 Kuruyan Kırık Toprak Hasadı', 'B-Kompleksi, Demir, Selenyum Bağışıklık Tankı', 'Soğuk İklim Güneşiyle Birlikte Maksimize Timokinon (Kanser Savaşçısı)', 'Asla Fabrikasyona Boyun Eğmemiş Bütün Hali'],
    producer: 'Kozmik Tarlalar',
    unit: '500 gr Kese',
    origin: 'Kör Tarla Dağ Ağızları'
  },
  {
    id: 706,
    name: 'Köylü İşi Organik Acı Kırmızı Biber (Pul/İsot)',
    description: 'Yürekleri ferahlatan, metabolizmayı şaha kaldıran iri dövülmüş nar gibi parıldayan güneşte kavrulmuş efsanevi acı.',
    price: 320,
    pricePrefix: 'Kızıl Mühür',
    category: 'Kurutulmuş Gıda & Kiler',
    tags: ['Toksin Atıcı', 'Tereyağ Kankası'],
    reviews: 190,
    rating: 4.8,
    stock: 55,
    image: 'https://images.unsplash.com/photo-1596645396956-628a8d11d9cd?auto=format&fit=crop&q=80&w=1200',
    story: 'Zeliş Abla\"nın evinin duvarları ağustosta kırmızıya boyanır. Dizilen biberler haftalarca kuruduktan sonra zeytinyağı ile dövülmeye başlar. Boya katan gıda tüccarlarına inat, kucağı yakmadan tatlı tatlı ağzı dolduran, sadece doğal terleterek vücudu temizleyen bir şifa harikası ortaya çıkar.',
    features: ['Zeliş Abla\"nın %100 Zeytinyağı ile Gece Tokmaklama Seansı', 'Kalpte Tıkanan Yağları Fırçalayan Tabii Beta Karoten Kırbacı', 'Kurutulurken Gevşeyen Siyah İç Nemli Yapı (Asla Kuru Çöp Değil)', 'Rengini Yabani Etinden Alan Otofaji Uzmanı Mide Dostu Acı'],
    producer: 'Zeliş Abla',
    unit: '500 gr Cam Sişe',
    origin: 'Güneş Gören Dam Altları'
  },
  {
    id: 707,
    homeSection: 'natural',
    name: 'Hakiki Kuşburnu Marmelatı',
    description: 'Sonbaharda dağlardan toplanan kırmızının en asil tonu. Gece yarılarına kadar süzgeçlerden ezilerek çıkarılan saf C vitamini küpü.',
    price: 450,
    pricePrefix: 'Antioksidan Devri',
    category: 'Kurutulmuş Gıda & Kiler',
    tags: ['Ateş Söndürücü', 'Şekersiz Kıvam'],
    reviews: 88,
    rating: 5.0,
    stock: 35,
    image: 'https://images.unsplash.com/photo-1600878142713-333e3edc6b24?auto=format&fit=crop&q=80&w=1200',
    story: 'Kuşburnunu elekten geçirmek sabrın en çetin sınavıdır. Dağ dikeniyle dolu dallardan tek tek koparılır. Kazanlarda haşlandıktan sonra kadınların kıpkırmızı olmuş ellerinden eleklerden süzülüp güneşe koyulaşmaya yatar. Hastalık sezonu geldiğinde bir tatlı kaşığı kuşburnu marmelatı yutan çocuk, yazı bekleyen bir aslan kadar sağlığına hızlı kavuşur.',
    features: ['Emektar Parmakların Dikenlerle Dansıyla Gelen Saflık', 'Endüstriyel Nişasta ve Katılaştırıcı Silikonlar Barındırmaz', 'İliklerinizde Kanı Arındıran Konsantre Böbrek Koruyucusu', 'Doğal Meyve Jölesi Esnekliği, Kıpkırmızı Kan Yapıcı Enerji'],
    producer: 'Oremar Şifa Kadınları',
    unit: '1 kg Büyük Cam',
    origin: 'Orman Sınırı Dikenlikleri'
  }
];

export const REVIEWS = [
  { id: 1, productId: 101, user: 'Ahmet K.', verified: true, rating: 5, date: '2 gün önce', text: 'Balın kokusu kapağı açar açmaz odayı sardı. Yıllardır aradığım o saf, katkısız yayla balı lezzetini nihayet buldum. Paketleme son derece özenliydi, teşekkürler Golden Oremar.' },
  { id: 2, productId: 201, user: 'Ayşe M.', verified: true, rating: 5, date: '1 hafta önce', text: 'Tulum peyniri tam istediğim gibi, hafif acımsı ve yağlı. Kahvaltılarımızın vazgeçilmezi oldu. Geleneksel yöntemlerle üretildiği her halinden belli.' },
  { id: 3, productId: 301, user: 'Mehmet Y.', verified: true, rating: 4, date: '3 gün önce', text: 'Köy tavuğu lezzetini özleyenler için birebir. Pişmesi biraz zaman alıyor ama ortaya çıkan lezzet kesinlikle beklemeye değer. Doğal beslendiği etinin dokusundan anlaşılıyor.' },
  { id: 4, productId: 102, user: 'Selin B.', verified: true, rating: 5, date: 'Dün', text: 'Karakovan balı tek kelimeyle muazzam. Peteklerin doğallığı ve balın aroması üst düzeyde. Hem kendimiz tüketiyoruz hem de sevdiklerimize hediye olarak sipariş veriyoruz.' },
  { id: 5, productId: 101, user: 'Caner T.', verified: true, rating: 5, date: '2 hafta önce', text: 'Şifa niyetine aldığımız bir ürün. Sabahları aç karnına tüketiyoruz, enerjimizde gözle görülür bir artış oldu. Kesinlikle tavsiye ederim.' },
  { id: 6, productId: 201, user: 'Zeynep A.', verified: true, rating: 5, date: '1 ay önce', text: 'Peynirin aroması çok zengin. Misafirlerime ikram ettiğimde herkes nereden aldığımı sordu. Kalitenizi bozmadığınız için teşekkürler.' },
  { id: 7, productId: 103, user: 'Burak S.', verified: true, rating: 5, date: '5 gün önce', text: 'Cevizli sucuklar harika. İçindeki cevizler taptaze ve pekmezi tam kıvamında. Çocuklar için sağlıklı bir atıştırmalık arayanlara duyurulur.' },
  { id: 8, productId: 101, user: 'Elif N.', verified: false, rating: 4, date: '3 hafta önce', text: 'Ürün çok güzel fakat kargo süreci biraz daha hızlı olabilirdi. Yine de lezzeti için beklemeye değer.' }
];

export const EVENTS = [
  { 
    id: 1, 
    title: 'Bal Hasadı Şenliği', 
    date: '15 Eylül 2024', 
    location: 'Golden Oremar Yaylası, Yüksekova',
    description: 'Geleneksel bal hasadımızı şenlik havasında kutluyoruz. Arıcılarımızla tanışın, taze balın tadına bakın ve yayla havasının keyfini çıkarın.',
    image: 'https://images.unsplash.com/photo-1587049352847-4d43ac7b98d3?auto=format&fit=crop&q=80&w=800'
  },
  { 
    id: 2, 
    title: 'Kuzu Kırkımı ve Golden Oremar Göçü', 
    date: '10 Haziran 2024', 
    location: 'Köy Meydanı',
    description: 'Yüzyıllardır süren geleneği yaşatıyoruz. Koyunların kırkılması ve yaylaya göç hazırlıklarına tanıklık edin. Yöresel yemek ikramlarımız olacaktır.',
    image: 'https://images.unsplash.com/photo-1484704324500-528d0ae4dc7d?auto=format&fit=crop&q=80&w=800'
  },
  { 
    id: 3, 
    title: 'Doğal Yaşam Atölyesi', 
    date: '20 Temmuz 2024', 
    location: 'Golden Oremar Kültür Evi',
    description: 'Kendi yoğurdunu mayalamayı, sirke kurmayı ve doğal reçel yapmayı öğrenmek isteyenler için uygulamalı atölye çalışması.',
    image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=800'
  },
  { 
    id: 4, 
    title: 'Golden Oremar Peyniri Yapım Atölyesi', 
    date: '15 Ağustos 2024', 
    location: 'Golden Oremar Yaylası',
    description: 'Geleneksel yöntemlerle tulum peyniri yapımını öğrenin. Sütün mayalanmasından olgunlaşma sürecine kadar tüm aşamaları ustalarından dinleyin.',
    image: 'https://images.unsplash.com/photo-1486297672625-f5dc1bfe7c04?auto=format&fit=crop&q=80&w=800'
  },
  { 
    id: 5, 
    title: 'Sonbahar Hasadı ve Kış Hazırlığı', 
    date: '25 Eylül 2024', 
    location: 'Köy Meydanı',
    description: 'Kışlık hazırlıkların yapıldığı, imece usulü bir gün. Tarhana kurutma, pekmez kaynatma ve kışlık sebzelerin hazırlanmasına katılın.',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800'
  }
];

export const RECIPES = [
  {
    id: 1,
    title: 'Karakovan Ballı, Kuru İncirli Enerji Topları',
    summary: 'Golden Oremar Karakovan Balı ve kuru incirleriyle hazırlayabileceğiniz şekersiz, doğal atıştırmalık.',
    content: 'Malzemeler:\n- 1 su bardağı Golden Oremar Kurutulmuş Dağ İnciri\n- Yarım su bardağı ceviz veya fındık içi\n- 2 yemek kaşığı Golden Oremar Süzme Çiçek Balı\n- 1 tatlı kaşığı tarçın\n- Bulamak için Hindistan cevizi\n\nHazırlanışı:\n1. İncirleri 10 dakika sıcak suda bekletip yumuşatın. Suyunu iyice süzün.\n2. Cevizleri mutfak robotunda iri parçalar halinde çekin.\n3. Yumuşayan incirleri, balı ve tarçını robota ekleyip macun kıvamına gelene kadar çekin.\n4. Karışımı buzdolabında 15 dakika dinlendirin.\n5. Elinizi hafifçe ıslatarak karışımdan ceviz büyüklüğünde parçalar koparıp yuvarlayın.\n6. Hindistan cevizine bulayıp servis yapın. Afiyet olsun!',
    image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&q=80&w=1200&h=800',
    date: '15 Nisan 2024',
    category: 'Şekersiz Atıştırmalık'
  },
  {
    id: 2,
    title: 'Dağ Kekikli Fırın Somon',
    summary: 'Golden Oremar Dağ Kekiği ile aromalandırılmış, sağlıklı fırın somon tarifi.',
    content: 'Malzemeler:\n- 2 dilim somon fileto\n- 1 tatlı kaşığı Golden Oremar Dağ Kekiği\n- 3 yemek kaşığı zeytinyağı\n- Yarım limonun suyu\n- Tuz ve taze çekilmiş karabiber\n\nHazırlanışı:\n1. Zeytinyağı, limon suyu, dağ kekiği, tuz ve karabiberi küçük bir kasede karıştırın.\n2. Somon filetoları bu sosla harmanlayıp 20 dakika buzdolabında marine edin.\n3. Yağlı kağıt serili fırın tepsisine somonları yerleştirin.\n4. Önceden ısıtılmış 200 derece fırında yaklaşık 15-20 dakika (somonun kalınlığına göre) pişirin.\n5. Taze salata veya buharda pişmiş sebzelerle sıcak servis yapın.',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&q=80&w=1200&h=800',
    date: '10 Nisan 2024',
    category: 'Ana Yemek'
  },
  {
    id: 3,
    title: 'Köy Peynirli ve Cevizli Ev Yapımı Pide',
    summary: 'Klasik peynirli pideye Golden Oremar Göçer Peyniri ve ceviz ile farklı bir dokunuş.',
    content: 'Malzemeler:\n- Hamur için: 3 su bardağı un, 1 tatlı kaşığı maya, tuz, su.\n- İç harcı için: 250g Golden Oremar Göçer Peyniri (rendelenmiş), 1 su bardağı kırık ceviz, 1 yumurta.\n\nHazırlanışı:\n1. Hamur malzemelerini karıştırıp yumuşak bir hamur yoğurun. 45 dk mayalandırın.\n2. Peynir, ceviz ve yumurtayı karıştırın.\n3. Hamurdan bezeler alıp uzunlamasına açın ve iç harcı ortasına yayın.\n4. Kenarlarını kıvırıp 200 derece fırında kızarana kadar pişirin.',
    image: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&q=80&w=1200&h=800',
    date: '5 Nisan 2024',
    category: 'Hamur İşi'
  }
];

export const PRODUCT_HEALTH_INFO = [
  {
    productId: '101',
    title: 'Sınır Ötesi 3000 Rakım Karakovan Balı - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '102',
    title: 'Berçelan Yaylası Bahar Çiçek Balı - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '103',
    title: 'Avaşin Meşe Balı - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '201',
    title: 'Merez Hatun\ - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '202',
    title: 'Naciye\ - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '203',
    title: 'Havahan\ - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '204',
    title: 'Günlük Taze Cıvık Süt (Sağımdan Kapıya) - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '205',
    title: 'Taze Yayık Ayranı (Canlı Kültür) - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '301',
    title: 'Avaşin Deresi Canlı Alabalığı (Özel Hasat) - Sağlığa Faydaları',
    content: 'Bu eşsiz kırmızı benekli alabalık, doğal dağ sularının tüm minerallerini bünyesinde barındırır. Serbest ve vahşi ortamda yetiğştiği için etindeki Omega-3 ve saf protein oranı, endüstriyel balıklara kıyasla dört kat daha yüksektir. Düzenli tüketildiğinde kalp damar sağlığını zirveye taşır, sinir sistemini yapılandırır ve ruhsal zindelik sağlar. Bu şifa kaynağının damağınızda bırakacağı hafif ve temiz tat, tamamen doğanın bir armağanıdır.'
  },
  {
    productId: '302',
    title: 'Abidin\ - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '303',
    title: 'Fahrettin\ - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '304',
    title: 'Salih\ - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '305',
    title: 'Amine\ - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '401',
    title: 'Avaşin Orijinal Kaynak Suyu (Cam Damacana) - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '402',
    title: 'Köyün Efsanevi Beyaz Isıtma/Pres Taşı - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '403',
    title: 'Sobalık Çıtırtılı Saf Meşe Yarığı - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '501',
    title: 'Hatun Ana\ - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '502',
    title: 'Sami Usta\ - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '503',
    title: 'Kadın İmecesi Odun Ateşi Pekmezi - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '504',
    title: 'Hüsnü Dayı\ - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '505',
    title: 'El İşçiliği Meşe Palamudu Ekmeği - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '506',
    title: 'İsli Kaya Üzümleri (Tane Kuru) - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '507',
    title: 'Zahter Harmanı Dağ Kekiği - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '601',
    title: 'Sessiz Orman Kuzu Göbeği Mantarı - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '602',
    title: 'Kan Kırmızı Yabani Kızılcık Şurubu Seti - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '603',
    title: 'Kırık Taş Kaya Tuzu Bloğu (Kristal) - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '701',
    title: 'Güneş Sırrı Guzu Yağı (İç Yağ) - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '702',
    title: 'Sabır Kurutması Çiçek Bamyası - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '703',
    title: 'Kekik Aromalı Kesik Yoğurt (Kurud) - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '704',
    title: 'El İşlemesi Tahta Kaşık ve Yayık Tokmağı - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '705',
    title: 'Büyük İskender Çörek Otu Tohumu (Organik) - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '706',
    title: 'Köylü İşi Organik Acı Kırmızı Biber (Pul/İsot) - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
  {
    productId: '707',
    title: 'Hakiki Kuşburnu Marmelatı - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },
];

export const HEALTH_GUIDES = [
  { 
    id: 1, 
    title: 'Karakovan Balının Bilinmeyen 5 Faydası', 
    summary: 'Bağışıklığı güçlendirmekten cilt sağlığına kadar karakovan balının mucizeleri.',
    content: 'Karakovan balı, insan eli değmeden üretilen en saf bal türüdür. 1. Bağışıklık sistemini çelik gibi yapar. 2. Doğal bir antibiyotiktir, boğaz enfeksiyonlarına iyi gelir. 3. Mide rahatsızlıklarını hafifletir. 4. Enerji verir, yorgunluğu alır. 5. Cilt yaralarının iyileşmesini hızlandırır. Karakovan balı, yüksek prolin değeri ile diğer ballardan ayrılır. Düzenli tüketimi, vücudun direncini artırır ve hastalıklara karşı kalkan oluşturur. Özellikle kış aylarında sabahları bir kaşık tüketilmesi önerilir.',
    image: 'https://images.unsplash.com/photo-1587049352847-4d43ac7b98d3?auto=format&fit=crop&q=80&w=800',
    date: '12 Mart 2024'
  },
  { 
    id: 2, 
    title: 'Dağ Kekiği Nasıl Kullanılır?', 
    summary: 'Yemeklerden çaylara, dağ kekiğinin kullanım alanları ve şifalı etkileri.',
    content: 'Dağ kekiği (Zahter), sadece bir baharat değil, aynı zamanda güçlü bir antiseptiktir. Et yemeklerinde marinasyon için harikadır. Çay olarak demlendiğinde öksürüğü keser ve hazmı kolaylaştırır. Zeytinyağı ile karıştırılıp kahvaltıda tüketilebilir. Ayrıca, dağ kekiği yağı, ciltteki sivilce ve yaralar için doğal bir tedavi edici olarak da kullanılabilir. Keskin kokusu, zihni açar ve odaklanmayı artırır.',
    image: 'https://images.unsplash.com/photo-1596541571217-14234054fa25?auto=format&fit=crop&q=80&w=800',
    date: '05 Nisan 2024'
  },
  { 
    id: 3, 
    title: 'Neden Mevsiminde Beslenmeliyiz?', 
    summary: 'Doğanın döngüsüne uyum sağlamanın bedenimiz üzerindeki etkileri.',
    content: 'Mevsiminde yenen sebze ve meyveler, o mevsimin getirdiği hastalıklara karşı vücudumuzu korur. Kışın C vitamini deposu turunçgiller, yazın su ihtiyacımızı karşılayan karpuz ve domates... Doğanın bize sunduğu bu dengeyi korumak, sağlıklı bir yaşamın temelidir. Mevsim dışı ürünler, genellikle seralarda ve kimyasal gübrelerle yetiştirildiği için besin değerleri düşüktür. Doğal döngüye uymak, hem sağlığımızı korur hem de çevreyi destekler.',
    image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&q=80&w=800',
    date: '20 Mayıs 2024'
  },
  { 
    id: 4, 
    title: 'Cevizin Beyin Sağlığına Etkileri', 
    summary: 'Ceviz tüketimi hafızayı güçlendirir mi?',
    content: 'Ceviz, omega-3 yağ asitleri bakımından zengindir. Düzenli tüketimi beyin fonksiyonlarını destekler, odaklanmayı artırır ve hafızayı güçlendirir. Günde 2-3 tam ceviz tüketmek, kalp ve beyin sağlığı için mükemmel bir yatırımdır. Ceviz, aynı zamanda antioksidanlar açısından da zengindir ve hücrelerin yaşlanmasını geciktirir. Özellikle sınav dönemlerinde veya yoğun çalışma temposunda ceviz tüketimi, zihinsel performansı artırır.',
    image: 'https://images.unsplash.com/photo-1599598425947-33002620ebb6?auto=format&fit=crop&q=80&w=800',
    date: '10 Haziran 2024'
  },
  { 
    id: 5, 
    title: 'Doğal Probiyotik Kaynağı: Tarhana', 
    summary: 'Tarhana çorbası neden bu kadar faydalı?',
    content: 'Tarhana, fermente bir gıda olduğu için doğal bir probiyotik kaynağıdır. Bağırsak florasını düzenler, sindirimi kolaylaştırır ve bağışıklık sistemini destekler. İçeriğindeki sebzelerle zenginleşen tarhana, kış aylarının vazgeçilmezidir. Probiyotikler, bağırsak sağlığı için kritik öneme sahiptir ve tarhana, bu probiyotikleri doğal yollarla almamızı sağlar. Düzenli tarhana tüketimi, sindirim sistemi şikayetlerini azaltır ve vücudun genel direncini artırır.',
    image: 'https://images.unsplash.com/photo-1548943487-a2e4f43b4852?auto=format&fit=crop&q=80&w=800',
    date: '05 Temmuz 2024'
  }
];

export const CONTACT_INFO = {
  address: 'Hakkari Yüksekova Dağlıca Yeşiltaş köyü',
  phone: '+90 555 123 4567',
  whatsapp: '+90 555 123 4567',
  email: 'goldenoremar@gmail.com',
  mapUrl: 'https://maps.google.com/?q=Hakkari+Yüksekova+Dağlıca+Yeşiltaş+köyü',
  social: {
    instagram: 'https://instagram.com/goldenoremar',
    facebook: 'https://facebook.com/goldenoremar',
    twitter: 'https://twitter.com/goldenoremar',
    tiktok: 'https://tiktok.com/@goldenoremar',
    youtube: 'https://youtube.com/@goldenoremar',
    linkedin: 'https://linkedin.com/company/goldenoremar'
  }
};

export const STATIC_CONTENT = {
  about: {
    title: "Hakkımızda",
    content: `
      <h3 class="text-2xl font-bold mb-4 text-brand-green">Biz Sadece Üretici Değiliz, Bir Mirasın Bekçileriyiz</h3>
      <p class="mb-6 leading-relaxed">Golden Oremar; kalabalık şehirlerin gürültüsünden, betonların soğukluğundan ve fabrikasyon gıdaların sıradanlığından çok uzakta, Hakkari Yüksekova Dağlıca Yeşiltaş köyünün el değmemiş zirvelerinde doğmuş bir yaşam projesidir. İnsan doğasına dönmek, atalarımızın yüzlerce yıl önce o asil sofralara koyduğu o efsanevi saf tada ulaşmak artık bir lüks değil; bizim için sarsılmaz bir söz, bir yemin.</p>
      
      <h3 class="text-xl font-bold mb-3 text-brand-green">Zamanın Durduğu Coğrafyada Şifa Hasadı</h3>
      <p class="mb-6 leading-relaxed">Zehirli kimyasalların, endüstriyel hilelerin uğramadığı bu topraklarda arılarımız en nadide ve tıbbi endemik çiçeklerin özünü toplar; keçi ve koyunlarımız dağların tertemiz havasında yetişen binbir otla beslenir. Biz ürünlerimizi fabrikalarda bant üzerinde üretmeyiz; doğanın kendi mucizevi ritmine saygı göstererek, sabırla bekler ve en doğru zamanda, tıpkı atalarımızdan öğrendiğimiz o saf, değiştirilmemiş geleneksel yollarla hasat ederiz.</p>
      
      <h3 class="text-xl font-bold mb-3 text-brand-green">Gözünüz Garkada Kalmasın!</h3>
      <p class="mb-6 leading-relaxed">Artık sofranıza koyduğunuz yiyeceğin ne kadar "gerçek" olduğunu sorgulamaktan yorulmadınız mı? Çocuğunuza, ailenize güvenle yedirebileceğiniz bir lokma şifa bulmak ne kadar zorlaştı, farkındayız. Bu yüzden Golden Oremar var. Biz, kapınızdan içeri giren her kavanozun, her paketin içinde sadece gıda değil; bozulmamış bir sağlık, tereddütsüz bir güven ve sarsılmaz bir kalite güvencesi sunuyoruz.</p>

      <h3 class="text-xl font-bold mb-3 text-brand-green">Gerçek Doğanın 3 Temel Yasası</h3>
      <ul class="list-disc pl-5 mb-4 space-y-2 border-l-4 border-brand-gold bg-brand-gold/5 p-4 rounded-xl">
        <li><strong>Sıfır Taviz (%100 Saflık):</strong> Ne toprak, ne arı, ne de bitki; üretimimizin hiçbir aşaması koruyucu, katkı veya GDO'lu madde görmez. Doğa onu nasıl verdiyse, o halde.</li>
        <li><strong>Ahlaklı ve Yerel Üretim:</strong> Biz köylümüzün, yöre insanın eliyle yükseliriz. Gerçek emeğe hakkını sonuna kadar veririz. Dağın asil üreticisi her zaman kazanır.</li>
        <li><strong>Mutlak Güven Şeffaflığı:</strong> Elinize aldığınız ürünün hangi yayladan, hangi köylünün elinden, hangi şartlarda size ulaştığını bilmek sizin en büyük hakkınızdır. Her adımımız açıktır.</li>
      </ul>
      <p class="mt-8 font-bold italic text-brand-green text-lg text-center">"Kendimize yedirmediğimiz, çocuklarımızın boğazından geçmesine izin vermediğimiz hiçbir ürünü, sizin sofranızı asla göndermeyiz."</p>
    `
  },
  returns: {
    title: "İade ve İptal Politikası",
    content: `
      <h3 class="text-xl font-bold mb-2">İade Koşulları</h3>
      <p class="mb-4">Müşteri memnuniyeti bizim için esastır. Satın aldığınız ürünlerden memnun kalmamanız durumunda, aşağıdaki koşullar çerçevesinde iade talep edebilirsiniz:</p>
      
      <ul class="list-disc pl-5 mb-4 space-y-2">
        <li><strong>Hasarlı Ürün:</strong> Kargo sırasında hasar görmüş ürünler için, kargo tutanağı ile birlikte anında iade veya değişim yapılır.</li>
        <li><strong>Ayıplı Mal:</strong> Üründe bozulma, küflenme vb. üretim kaynaklı bir sorun varsa, koşulsuz iade alınır.</li>
        <li><strong>Cayma Hakkı:</strong> Gıda ürünlerinde hijyen kuralları gereği, ambalajı açılmış ürünlerin keyfi iadesi kabul edilmemektedir. Ancak ambalajı açılmamış kuru gıda ve dayanıklı ürünleri 14 gün içinde iade edebilirsiniz.</li>
      </ul>

      <h3 class="text-xl font-bold mb-2">İade Süreci</h3>
      <p>İade talebinizi "Siparişlerim" sayfasından veya 0850 123 45 67 numaralı müşteri hizmetlerimizden oluşturabilirsiniz. İade kargo ücreti tarafımıza aittir.</p>
    `
  },
  privacy: {
    title: "Gizlilik ve Güvenlik",
    content: `
      <h3 class="text-xl font-bold mb-2">Veri Güvenliği</h3>
      <p class="mb-4">Golden Oremar olarak kişisel verilerinizin güvenliğine büyük önem veriyoruz. Kredi kartı bilgileriniz 256-bit SSL sertifikası ile korunmakta olup, sistemlerimizde kesinlikle saklanmamaktadır.</p>

      <h3 class="text-xl font-bold mb-2">Kişisel Verilerin Kullanımı</h3>
      <p class="mb-4">Ad, soyad, adres ve iletişim bilgileriniz sadece siparişinizin teslimatı ve faturalandırma işlemleri için kullanılır. Üçüncü şahıslarla pazarlama amacıyla paylaşılmaz.</p>
      
      <h3 class="text-xl font-bold mb-2">Çerez Politikası</h3>
      <p>Size daha iyi bir alışveriş deneyimi sunmak için çerezler (cookies) kullanıyoruz. Tarayıcı ayarlarınızdan çerez tercihlerinizi değiştirebilirsiniz.</p>
    `
  },
  faq: [
    {
      q: "Balınızın hakiki olduğunu nasıl anlayabilirim?",
      a: "Tüm ballarımız, hiçbir katkı maddesi veya şeker şurubu içermez. Doğrudan Dağlıca Yeşiltaş köyünün 3000 rakımlı yaylalarındaki endemik çiçeklerden, arıların kendi ürettiği hakiki balmumuyla hasat edilir. Her hasatımız için akredite laboratuvar analizlerimiz mevcuttur ve %100 saf olduğu belgelenmiştir. Güvenle tüketmeniz için her adım şeffaftır."
    },
    {
      q: "Ürünleriniz nerede üretiliyor?",
      a: "Ürünlerimizin tamamı, şehrin kirli havasından ve sanayisinden yüzlerce kilometre uzakta; Hakkari Yüksekova Dağlıca Yeşiltaş köyü ve çevre yaylalarında üretilmektedir. Üretim sürecinde fabrikasyon yöntemler asla kullanılmaz."
    },
    {
      q: "Kargom ne zaman ulaşır ve yolda bozulur mu?",
      a: "Siparişleriniz en geç 24 saat içerisinde özel ısı yalıtımlı ve darbe emici ambalajlarımızla hazırlanarak kargoya teslim edilir. Ürünleriniz, size ulaştığında sanki dağdan yeni hasat edilmiş gibi taze kalacak şekilde özel güvenlik bariyerleriyle paketlenir."
    },
    {
      q: "İade politikanız nasıldır?",
      a: "Söylediğimiz gibi; yiyemeyeceğimiz hiçbir ürünü size sunmayız. Eğer ürünümüzden memnun kalmazsanız, paket açılmış veya açılmamış fark etmeksizin koşulsuz iade alıyor ve ücretinizi kesintisiz iade ediyoruz. Ürünlerimize ve sağlığınıza olan inancımız tamdır."
    },
    {
      q: "Toptan alım veya bayilik veriyor musunuz?",
      a: "Önceliğimiz seri ve endüstriyel üretim değil; kalite ve sınırlı hasattır. Dolayısıyla şu aşamada toplu bayilik vermiyoruz ancak kurumsal işbirlikleri ve özel talepleriniz için WhatsApp Müşteri Hatlarımızdan 7/24 bizlere ulaşabilirsiniz."
    }
  ],
  interface: {
    heroTitle: "Sağlığa Açılan",
    heroSubtitle: "Sınırlı sayıda üretilen, Yüksekova'nın el değmemiş yaylalarından süzülen %100 doğal ve ayrıcalıklı lezzetleri hemen keşfedin.",
    heroButtonText: "Şimdi Keşfet",
    featuredTitle: "En Çok Tercih Edilenler",
    seasonalTitle: "Mevsime Özel Sınırlı Hasat",
    categoriesTitle: "Şifa Kaynaklarımız",
    footerText: "© 2026 Golden Oremar. Doğanın Kalbi, Sağlığınızın Güvencesi."
  }
};

import type{HomePresentationSource}from'../customer-experience/customerCopy';

const SIGNALS:Record<HomePresentationSource,readonly string[]>={
 featured:['İmza seçim','Sofrada fark','Seçkin tercih','Özenle seçildi'],
 preorder:['Ön siparişe özel','Ustasından hazırlanır','Beklemeye değer','Aceleye gelmez'],
 seasonal:['Mevsimin hasadı','Tam zamanı','Sezonun tazesi','Doğanın takvimi'],
 newest:['Yeni keşif','Vitrine yeni','İlk keşif','Yeni favori adayı'],
 offers:['Fiyat avantajı','Seçili teklif','Değerli seçim','Karşılaştırmaya değer'],
 curated:['Golden Oremar seçimi','Sofrada imza','Seçkin tercih','Özenle seçildi'],
 category:['Öne çıkan','Kategori seçimi','İyi eşleşme','Sofraya yakışır'],
};

export function homeMerchandisingSignal(source:HomePresentationSource,index:number){
 const signals=SIGNALS[source];
 return signals[index%signals.length]||null;
}

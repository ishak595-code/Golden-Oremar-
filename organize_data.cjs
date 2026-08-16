const fs = require('fs');

let content = fs.readFileSync('src/data.ts', 'utf8');

// I want to add `homeSection: '...'` based on some logic.
// Logic:
// 'Sessiz Orman Kuzu Göbeği Mantarı' -> seasonal
// 'Işkın (Yayla Muzu)' -> seasonal 
// 'Berçelan Yaylası Bahar Çiçek Balı' -> seasonal
// 'Günlük Taze Cıvık Süt' -> natural (Doğal Seçimler)
// 'Hakiki Kuşburnu Marmelatı' -> natural
// 'Naciye\'nin Saf Yayık Tereyağı' -> best_sellers (Çok Satanlar)
// 'Sınır Ötesi 3000 Rakım Karakovan Balı' -> best_sellers
// 'Merez Hatun\'un Mağara Tulum Peyniri' -> new_arrivals (Yeni Gelenler)
// 'Avaşin Orijinal Kaynak Suyu' -> new_arrivals
// 'Hatun Ana\'nın Ekşi Maya Güneşi' -> new_arrivals
// 'Abidin\'in Yayla Kuzusu' -> concierge (Kişiye Özel)
// 'Avaşin Deresi Canlı Alabalığı' -> concierge
// 'Fahrettin\'in Sütten Kesilmiş Oğlağı' -> concierge

const assignments = {
  seasonal: ['Sessiz Orman Kuzu Göbeği Mantarı', 'Berçelan Yaylası Bahar Çiçek Balı', 'Kırık Taş Kaya Tuzu Bloğu (Kristal)'],
  natural: ['Günlük Taze Cıvık Süt (Sağımdan Kapıya)', 'Hakiki Kuşburnu Marmelatı', 'Salih\'in Meralık Özgür Horozu', 'Kadın İmecesi Odun Ateşi Pekmezi'],
  best_sellers: ['Naciye\'nin Saf Yayık Tereyağı', 'Sınır Ötesi 3000 Rakım Karakovan Balı', 'Amine\'nin Çifte Sarı Köy Yumurtası', 'Büyük İskender Çörek Otu Tohumu (Organik)'],
  new_arrivals: ['Merez Hatun\'un Mağara Tulum Peyniri', 'Avaşin Orijinal Kaynak Suyu (Cam Damacana)', 'Hatun Ana\'nın Ekşi Maya Güneşi (Tarhana)', 'İsli Kaya Üzümleri (Tane Kuru)'],
  concierge: ['Abidin\'in Yayla Kuzusu (VIP Bütün/Parçalı)', 'Avaşin Deresi Canlı Alabalığı (Özel Hasat)', 'Fahrettin\'in Sütten Kesilmiş Oğlağı'],
  offers: ['Avaşin Meşe Balı', 'Sami Usta\'nın Kurutulmuş Dağ Dutları', 'El İşçiliği Meşe Palamudu Ekmeği', 'Köyün Efsanevi Beyaz Isıtma/Pres Taşı']
};

let productRegex = /name:\s*(['"`])(.*?)\1\s*,/g;
let newContent = content;

Object.keys(assignments).forEach(section => {
  assignments[section].forEach(productName => {
    // Find the product block by matching its name
    // Then replace it with `homeSection: 'xyz', \n name: ... `
    // Using RegExp that matches the name exactly
    let matchStr = `name: '${productName.replace(/'/g, "\\'")}',`;
    let replacement = `homeSection: '${section}',\n    ${matchStr}`;
    
    // Also try checking double quotes
    newContent = newContent.replace(matchStr, replacement);
  });
});

fs.writeFileSync('src/data.ts', newContent);
console.log('Sections added successfully');

const fs = require('fs');

let content = fs.readFileSync('src/data.ts', 'utf-8');

// Update image and preOrderTime for ID 301
let id301Regex = /(id:\s*301,[\s\S]*?image:\s*')https:\/\/images\.unsplash\.com\/photo-1544426541-0caee42e5a6f\?auto=format&fit=crop&q=80&w=1200(',[\s\S]*?preOrderTime:\s*)'Av Süreci İçin 4-7 Gün Önceden Randevu'/;
let id301Replacement = `$1https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&q=80&w=1200$2'Siparişinizden itibaren 2 gün içerisinde sadece sizin için dereden avlanır, en taze haliyle 2-3 gün içinde özel soğutmalı sistemle kapınıza prestijle ulaştırılır.'`;

if (content.match(id301Regex)) {
    content = content.replace(id301Regex, id301Replacement);
    console.log("Updated ID 301 (Alabalık).");
} else {
    console.log("Could not find regex match for ID 301.");
}

// Update other preOrderTime texts to be more prestigious
let id302Regex = /(id:\s*302,[\s\S]*?preOrderTime:\s*)'7 Günlük Hazırlık ve Dinlendirme'/;
let id302Replacement = `$1'Adınıza özel seçim ve kesim işlemlerinin ardından, kusursuz dinlendirme süreciyle 7 gün içerisinde size özel teslimatı sağlanır.'`;

if (content.match(id302Regex)) {
    content = content.replace(id302Regex, id302Replacement);
    console.log("Updated ID 302.");
} else {
    console.log("Could not find regex match for ID 302.");
}

let id303Regex = /(id:\s*303,[\s\S]*?preOrderTime:\s*)'10 Gün Önceden Randevu'/;
let id303Replacement = `$1'Üst düzey gurme deneyimi için adınıza tahsis edilir; özel serbest peşrev sonrası 10 gün içerisinde VIP ekibimizle adresinize ulaştırılır.'`;

if (content.match(id303Regex)) {
    content = content.replace(id303Regex, id303Replacement);
    console.log("Updated ID 303.");
} else {
    console.log("Could not find regex match for ID 303.");
}

fs.writeFileSync('src/data.ts', content);

const fs = require('fs');

let content = fs.readFileSync('src/data.ts', 'utf-8');

// Unsplash salmon/fish
content = content.replace(
  /1519708227418-c8fd9a32b7a2/g,
  "1580476262798-b768a41bf823"
);

// Enhance product texts
content = content.replace(/(id:\s*301,[\s\S]*?description:\s*)'[^']+'/,
  `$1'Yapay havuzların durgun sularını hiç tanımamış, Avaşin Deresi\\'nin buz gibi ve hırçın akıntılarında kaslanarak büyümüş kırmızı benekli vahşi alabalık. Sadece size özel bir randevu ile usta balıkçılarımız tarafından derede avlanır.'`
);

content = content.replace(/(id:\s*301,[\s\S]*?preOrderTime:\s*)'[^']+'/,
  `$1'Siparişinizi 2 gün önceden oluşturun. Onayınızla usta ekiplerimiz Avaşin Deresi\\'ne iner; 2 veya 3 gün içerisinde yakalanan bu eşsiz kırmızı balık, sağlıkla kapınıza ulaştırılır.'`
);

fs.writeFileSync('src/data.ts', content);

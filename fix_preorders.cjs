const fs = require('fs');

let content = fs.readFileSync('src/data.ts', 'utf-8');

content = content.replace(/(id:\s*204,[\s\S]*?preOrderTime:\s*)'Sağım Gecesi Sipariş Edilmelidir'/, 
  `$1'Siparişinizin verildiği gece vakti özel olarak sağılır ve sabahın ilk ışıklarında canlılığını kaybetmeden size teslim edilir.'`);

content = content.replace(/(id:\s*401,[\s\S]*?preOrderTime:\s*)'Cam İadesi Sistemi'/, 
  `$1'Siparişinize istinaden özel cam damacanalara doğanın özünden doldurulur; abonelik sistemi ekseninde prestijle adresinize sunulur.'`);

content = content.replace(/(id:\s*501,[\s\S]*?preOrderTime:\s*)'Tandırın Yanacağı Günlere Özel \(Haftada 1 Kesim\)'/, 
  `$1'Haftada bir yakılan geleneksel köy tandırında adınıza tahsis edilmiş hamuruyla ağır ağır pişerek kapınıza uzanır.'`);

content = content.replace(/(id:\s*601,[\s\S]*?preOrderTime:\s*)'Bulunduğu Sabah Şoklu Gönderim'/, 
  `$1'Doğanın mucizevi anında keşfedildiği o taze sabah, eşsiz rayihasını kaybetmeksizin eksi dereceli VIP şoklama ile size uğurlanır.'`);

fs.writeFileSync('src/data.ts', content);

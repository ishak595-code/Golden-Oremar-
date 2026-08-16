const fs = require('fs');

const updates = {
  301: 'https://images.unsplash.com/photo-1544426541-0caee42e5a6f?auto=format&fit=crop&q=80&w=1200', // Alabalik 
  302: 'https://images.unsplash.com/photo-1603048297172-c92544798d5e?auto=format&fit=crop&q=80&w=1200', // Kuzu
  303: 'https://images.unsplash.com/photo-1623855244183-52fd8d3ce7f7?auto=format&fit=crop&q=80&w=1200', // Oglak
  304: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&q=80&w=1200', // Horoz
  701: 'https://images.unsplash.com/photo-1615486511484-95e0c6aeb8c3?auto=format&fit=crop&q=80&w=1200', // Icyag
  702: 'https://images.unsplash.com/photo-1559404281-546ec03b14d2?auto=format&fit=crop&q=80&w=1200', // Bamya
  703: 'https://images.unsplash.com/photo-1559561853-08451507cbe7?auto=format&fit=crop&q=80&w=1200', // Kurud
  704: 'https://images.unsplash.com/photo-1628102379761-12502787e974?auto=format&fit=crop&q=80&w=1200', // Tahta Kasik
  705: 'https://images.unsplash.com/photo-1611074092550-93bcbc07ddf9?auto=format&fit=crop&q=80&w=1200', // Corek Otu
  706: 'https://images.unsplash.com/photo-1596645396956-628a8d11d9cd?auto=format&fit=crop&q=80&w=1200', // Aci Biber
  707: 'https://images.unsplash.com/photo-1600878142713-333e3edc6b24?auto=format&fit=crop&q=80&w=1200', // Kusburnu
};

let code = fs.readFileSync('src/data.ts', 'utf-8');

for (const [id, imgUrl] of Object.entries(updates)) {
  const regex = new RegExp(`(id:\\s*${id},[\\s\\S]*?image:\\s*')https://[^']*(',[\\s\\S]*?story:)`, 'g');
  code = code.replace(regex, `$1${imgUrl}$2`);
}

fs.writeFileSync('src/data.ts', code);

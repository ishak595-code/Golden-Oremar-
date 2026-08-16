const fs = require('fs');

let data = fs.readFileSync('src/data.ts', 'utf8');

const replacements = {
  // categories
  "'https://picsum.photos/seed/meat-cat/600/400'": "'https://images.unsplash.com/photo-1603048297172-c92544798d5e?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/dairy-cat/600/400'": "'https://images.unsplash.com/photo-1486297672625-f5dc1bfe7c04?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/fruit-cat/600/400'": "'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/dry-cat/600/400'": "'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/mountain-cat/600/400'": "'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/stones-cat/600/400'": "'https://images.unsplash.com/photo-1520114878144-6123742a170b?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/honey-cat/600/400'": "'https://images.unsplash.com/photo-1587049352847-4d43ac7b98d3?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/beverages-cat/600/400'": "'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&q=80&w=800'",

  // hero
  "'https://picsum.photos/seed/honeycomb-flowers/800/600'": "'https://images.unsplash.com/photo-1587049352847-4d43ac7b98d3?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/farm-fresh/800/600'": "'https://images.unsplash.com/photo-1486297672625-f5dc1bfe7c04?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/mountain-herbs/800/600'": "'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/pantry-wood/800/600'": "'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800'",

  // products
  "'https://picsum.photos/seed/honey-comb/800/1000'": "'https://images.unsplash.com/photo-1587049352847-4d43ac7b98d3?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/flower-honey/800/1000'": "'https://images.unsplash.com/photo-1620063223011-85b46e30bba9?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/cheese-tulum/800/1000'": "'https://images.unsplash.com/photo-1486297672625-f5dc1bfe7c04?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/butter-yellow/800/1000'": "'https://images.unsplash.com/photo-1588195538320-067d0bc11314?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/chicken/800/1000'": "'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/eggs/800/1000'": "'https://images.unsplash.com/photo-1587486913049-53fc88f28453?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/walnut/800/1000'": "'https://images.unsplash.com/photo-1599598425947-33002620ebb6?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/rhubarb/800/1000'": "'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/morel-mushroom/800/1000'": "'https://images.unsplash.com/photo-1604543519967-17296041acce?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/tarhana/800/1000'": "'https://images.unsplash.com/photo-1548943487-a2e4f43b4852?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/firewood/800/1000'": "'https://images.unsplash.com/photo-1520114878144-6123742a170b?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/dried-mulberry/800/1000'": "'https://images.unsplash.com/photo-1603569283896-1934988f04fd?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/wild-thyme/800/1000'": "'https://images.unsplash.com/photo-1596541571217-14234054fa25?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/grape-molasses/800/1000'": "'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/white-cheese/800/1000'": "'https://images.unsplash.com/photo-1559561853-08451507cbe7?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/propolis/800/1000'": "'https://images.unsplash.com/photo-1615484475510-4ed57e849ea9?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/apple-cider-vinegar/800/1000'": "'https://images.unsplash.com/photo-1593006526993-8ba9fe8d578c?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/strained-honey/800/1000'": "'https://images.unsplash.com/photo-1587049352851-8d4e89134a6a?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/tomato-paste/800/1000'": "'https://images.unsplash.com/photo-1581600140682-d4e1ad15ea01?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/cevizli-sucuk/800/1000'": "'https://images.unsplash.com/photo-1586208558742-b68e9f5ff771?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/pomegranate-syrup/800/1000'": "'https://images.unsplash.com/photo-1621235940381-8b2b73bc3ebb?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/whole-wheat-flour/800/1000'": "'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/dried-fig/800/1000'": "'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=800'",
  
  // Also any remaining picsum links in OTHER variables
  "'https://picsum.photos/seed/honey-harvest/800/600'": "'https://images.unsplash.com/photo-1587049352847-4d43ac7b98d3?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/sheep-shearing/800/600'": "'https://images.unsplash.com/photo-1484704324500-528d0ae4dc7d?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/workshop/800/600'": "'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/cheese-workshop/800/600'": "'https://images.unsplash.com/photo-1486297672625-f5dc1bfe7c04?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/autumn-harvest/800/600'": "'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/honey-health/800/600'": "'https://images.unsplash.com/photo-1587049352847-4d43ac7b98d3?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/thyme-tea/800/600'": "'https://images.unsplash.com/photo-1596541571217-14234054fa25?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/seasonal-food/800/600'": "'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/walnut-health/800/600'": "'https://images.unsplash.com/photo-1599598425947-33002620ebb6?auto=format&fit=crop&q=80&w=800'",
  "'https://picsum.photos/seed/tarhana-health/800/600'": "'https://images.unsplash.com/photo-1548943487-a2e4f43b4852?auto=format&fit=crop&q=80&w=800'"
};

for (const [key, value] of Object.entries(replacements)) {
  data = data.split(key).join(value);
}

fs.writeFileSync('src/data.ts', data);
console.log('Images updated.');

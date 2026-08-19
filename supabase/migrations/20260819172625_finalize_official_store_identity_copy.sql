update public.producers
set description='Golden Oremar, Hakkâri Yüksekova Yeşiltaş köyü ve Dağlıca bölgesindeki köy ürünlerini doğrulanabilir menşe, ürün bilgisi ve izlenebilirlik kayıtlarıyla sunan platformun resmi mağazasıdır.',
    story='Bu mağaza Golden Oremar tarafından yönetilir. Golden Oremar kendi ürünlerini ve doğrulanmış köylü üreticilerden temin ettiği ürünleri burada yayınlayabilir; ürünün gerçek kaynağı ürün bazında provenance ve izlenebilirlik kayıtlarında korunur.',
    updated_at=timezone('utc',now())
where slug='golden-oremar' and store_kind='official' and deleted_at is null;

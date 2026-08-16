const orderStatusLabels: Record<string,string> = {
  pending_payment:'Ödeme bekleniyor',
  confirmed:'Onaylandı',
  preparing:'Hazırlanıyor',
  partially_shipped:'Kısmen gönderildi',
  shipped:'Kargoda',
  delivered:'Teslim edildi',
  completed:'Tamamlandı',
  cancelled:'İptal edildi',
};

const paymentStatusLabels: Record<string,string> = {
  pending:'Bekliyor',
  authorized:'Yetkilendirildi',
  captured:'Ödendi',
  partially_refunded:'Kısmi geri ödeme',
  refunded:'Geri ödendi',
  failed:'Başarısız',
  cancelled:'İptal edildi',
};

const paymentMethodLabels: Record<string,string> = {
  card:'Kart',
  credit_card:'Kredi kartı',
  debit_card:'Banka kartı',
  bank_transfer:'Banka havalesi',
  manual:'Manuel ödeme',
  wallet:'Dijital cüzdan',
};

export function orderStatusLabel(value?: string | null) {
  const key=String(value||'').trim();
  return orderStatusLabels[key] || humanizeCode(key) || 'Durum bilgisi yok';
}

export function paymentStatusLabel(value?: string | null) {
  const key=String(value||'').trim();
  return paymentStatusLabels[key] || humanizeCode(key) || 'Durum bilgisi yok';
}

export function paymentMethodLabel(value?: string | null) {
  const key=String(value||'').trim();
  return paymentMethodLabels[key] || humanizeCode(key) || 'Ödeme';
}

export function providerLabel(value?: string | null) {
  const raw=String(value||'').trim();
  if(!raw)return 'Ödeme sağlayıcısı';
  return raw.replace(/[_-]+/g,' ').replace(/\b\p{L}/gu,letter=>letter.toLocaleUpperCase('tr-TR'));
}

export function formatAccountDate(value?: string | null) {
  if(!value)return '';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '';
  try{return new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short'}).format(date);}catch{return ''}
}

function humanizeCode(value:string){
  if(!value)return '';
  return value.replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().replace(/\b\p{L}/gu,letter=>letter.toLocaleUpperCase('tr-TR'));
}

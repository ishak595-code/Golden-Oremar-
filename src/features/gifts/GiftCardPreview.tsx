import React from 'react';
import { Gift, Heart, Mountain, Sparkles } from 'lucide-react';
import type { GiftOccasion, GiftPresentationStyle } from './api';

export const giftOccasions: Array<{ value: GiftOccasion; label: string; title: string; hint: string }> = [
  { value: 'just_because', label: 'İçimden geldi', title: 'Seni düşündüm', hint: 'Bir sebep gerekmeyen güzel anlar için.' },
  { value: 'birthday', label: 'Doğum günü', title: 'İyi ki doğdun', hint: 'Yeni yaşına köyden gelen sıcak bir armağan.' },
  { value: 'love', label: 'Sevgi', title: 'Senin için', hint: 'Söylemek istediğiniz güzel duygulara küçük bir eşlik.' },
  { value: 'thank_you', label: 'Teşekkür', title: 'İyi ki varsın', hint: 'Bir teşekkürün hatırlanacak hali.' },
  { value: 'celebration', label: 'Kutlama', title: 'Kutlamaya değer', hint: 'Güzel bir haberi birlikte büyütmek için.' },
  { value: 'get_well', label: 'Geçmiş olsun', title: 'Yanındayım', hint: 'Uzakta olsanız da yakın hissettiren bir not.' },
  { value: 'new_home', label: 'Yeni ev', title: 'Yeni yuvana mutlulukla', hint: 'Yeni başlangıca doğal bir dokunuş.' },
  { value: 'new_baby', label: 'Yeni bebek', title: 'Hoş geldin minik mucize', hint: 'Ailenin en yeni mutluluğunu kutlamak için.' },
];

export const giftStyles: Array<{ value: GiftPresentationStyle; label: string; description: string }> = [
  { value: 'oremar_gold', label: 'Oremar Zarafeti', description: 'Altın dokunuşlu, özel gün hissi güçlü.' },
  { value: 'mountain_warmth', label: 'Dağ Sıcaklığı', description: 'Köyden gelen samimi ve doğal bir his.' },
  { value: 'minimal_elegance', label: 'Sade Zarafet', description: 'Sessiz, temiz ve modern bir sunum.' },
];

function styleClass(style: GiftPresentationStyle) {
  if (style === 'mountain_warmth') return 'border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-emerald-50 text-amber-950 dark:border-amber-900/60 dark:from-amber-950/50 dark:via-orange-950/30 dark:to-emerald-950/40 dark:text-amber-50';
  if (style === 'minimal_elegance') return 'border-gray-200 bg-gradient-to-br from-white via-gray-50 to-emerald-50 text-gray-900 dark:border-gray-700 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950/40 dark:text-gray-50';
  return 'border-amber-300 bg-gradient-to-br from-amber-50 via-white to-yellow-50 text-amber-950 dark:border-amber-700/60 dark:from-amber-950/50 dark:via-gray-950 dark:to-yellow-950/30 dark:text-amber-50';
}

function StyleIcon({ style }: { style: GiftPresentationStyle }) {
  if (style === 'mountain_warmth') return <Mountain aria-hidden="true" className="h-5 w-5" />;
  if (style === 'minimal_elegance') return <Sparkles aria-hidden="true" className="h-5 w-5" />;
  return <Gift aria-hidden="true" className="h-5 w-5" />;
}

export default function GiftCardPreview({
  recipientName,
  senderName,
  message,
  occasion,
  presentationStyle,
  cardTitle,
  hidePrice,
}: {
  recipientName: string;
  senderName: string;
  message: string;
  occasion: GiftOccasion;
  presentationStyle: GiftPresentationStyle;
  cardTitle: string;
  hidePrice: boolean;
}) {
  const occasionMeta = giftOccasions.find(item => item.value === occasion) || giftOccasions[0];
  const visibleTitle = cardTitle.trim() || occasionMeta.title;
  const visibleRecipient = recipientName.trim() || 'Sevdiğiniz kişi';
  const visibleSender = senderName.trim() || 'Sizi düşünen biri';
  const visibleMessage = message.trim();

  return <section aria-labelledby="gift-card-preview-title" className={`relative overflow-hidden rounded-[2rem] border p-5 shadow-sm sm:p-6 ${styleClass(presentationStyle)}`}>
    <div aria-hidden="true" className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-current opacity-[0.04]" />
    <div aria-hidden="true" className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-current opacity-[0.035]" />
    <div className="relative">
      <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.16em] opacity-70">
        <span className="flex items-center gap-2"><StyleIcon style={presentationStyle} /> Golden Oremar Hediyesi</span>
        <span>{hidePrice ? 'Fiyat gizli' : 'Fiyat görünür'}</span>
      </div>
      <div className="mt-7 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-current/15 bg-white/50 dark:bg-black/10"><Heart aria-hidden="true" className="h-5 w-5" /></div>
        <p className="mt-4 text-sm opacity-75">{visibleRecipient} için</p>
        <h3 id="gift-card-preview-title" className="mt-1 font-serif text-3xl font-bold leading-tight">{visibleTitle}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 opacity-70">{occasionMeta.hint}</p>
        <div className="mx-auto mt-5 max-w-lg rounded-2xl border border-current/10 bg-white/55 p-4 text-left shadow-sm backdrop-blur-sm dark:bg-black/10">
          {visibleMessage ? <p className="whitespace-pre-wrap break-words text-base leading-7">“{visibleMessage}”</p> : <p className="text-sm italic opacity-55">Kendi cümlenizi yazdığınızda hediye notunuz burada görünecek.</p>}
          <p className="mt-4 text-right text-sm font-bold">{visibleSender}</p>
        </div>
      </div>
      <div className="mt-6 border-t border-current/10 pt-4 text-center text-xs leading-5 opacity-65">Köyden gelen gerçek bir ürün, sizin gerçek sözlerinizle anlam kazanır.</div>
    </div>
  </section>;
}

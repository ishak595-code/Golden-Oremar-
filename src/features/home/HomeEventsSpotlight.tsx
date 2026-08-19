import React,{useEffect,useMemo,useState}from'react';
import{ArrowRight,CalendarDays,Clock3,MapPin,Share2,TicketCheck,Users}from'lucide-react';
import{listPublicEvents,publicContentUrl,type PublicEvent}from'../engagement/api';
import{buildEventUrl,shareOrCopy}from'../navigation/appUrl';

function formatEventDate(value:string){
 const date=new Date(value);if(Number.isNaN(date.getTime()))return'';
 try{return new Intl.DateTimeFormat('tr-TR',{weekday:'short',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(date);}catch{return'';}
}
function eventHref(reference:string){try{return buildEventUrl(reference);}catch{return'';}}
function eventsHref(){
 if(typeof window==='undefined')return'?tab=events';
 try{const url=new URL(window.location.href);url.search='';url.hash='';url.searchParams.set('tab','events');return url.toString();}catch{return'?tab=events';}
}
function countdown(event:PublicEvent,now:number){
 const start=Date.parse(event.startsAt),end=Date.parse(event.endsAt),deadline=event.reservationDeadline?Date.parse(event.reservationDeadline):Number.NaN;
 if(now>=start&&now<end)return{eyebrow:'Şu anda',value:'Etkinlik devam ediyor'};
 if(now>=end)return{eyebrow:'Durum',value:'Etkinlik tamamlandı'};
 const useDeadline=event.reservable&&Number.isFinite(deadline)&&deadline>now&&deadline<start;
 const target=useDeadline?deadline:start;const diff=Math.max(0,target-now);const totalMinutes=Math.floor(diff/60000);const days=Math.floor(totalMinutes/1440);const hours=Math.floor((totalMinutes%1440)/60);const minutes=totalMinutes%60;
 const parts=[days>0?`${days} gün`:'',hours>0||days>0?`${hours} sa`:'',days===0?`${minutes} dk`:''].filter(Boolean);
 return{eyebrow:useDeadline?'Kayıt bitimine':'Başlamasına',value:parts.join(' ')||'Çok az kaldı'};
}
function eventState(event:PublicEvent,now:number){
 if(event.reservable&&event.waitlistOnly)return{label:'Bekleme listesi',className:'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100'};
 if(event.reservable)return{label:'Kayıt açık',className:'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-100'};
 const start=Date.parse(event.startsAt),end=Date.parse(event.endsAt);
 if(now>=start&&now<end)return{label:'Devam ediyor',className:'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-100'};
 return{label:'Kayıt kapalı',className:'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'};
}
function capacityLabel(event:PublicEvent){
 if(event.capacity==null||event.remainingCapacity==null)return'';
 if(event.reservable&&event.waitlistOnly)return event.remainingCapacity===0?'Kontenjan dolu, bekleme listesi açık':'Bekleme listesi açık';
 if(event.remainingCapacity===0)return'Kontenjan dolu';
 return`${event.remainingCapacity} kişilik yer kaldı`;
}
function CapacityMeter({event}:{event:PublicEvent}){
 if(event.capacity==null||event.remainingCapacity==null)return null;
 const used=Math.max(0,event.capacity-event.remainingCapacity);const percent=Math.min(100,Math.max(0,Math.round((used/event.capacity)*100)));
 return <div className="mt-4">
  <div className="flex items-center justify-between gap-3 text-xs font-semibold"><span>{capacityLabel(event)}</span><span>{used}/{event.capacity}</span></div>
  <div role="progressbar" aria-label="Etkinlik kontenjan doluluğu" aria-valuemin={0} aria-valuemax={event.capacity} aria-valuenow={used} className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full bg-brand-gold transition-[width] duration-300" style={{width:`${percent}%`}}/></div>
 </div>;
}

export default function HomeEventsSpotlight(){
 const[data,setData]=useState<PublicEvent[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState('');const[shareStatus,setShareStatus]=useState('');const[now,setNow]=useState(()=>Date.now());
 async function load(){try{setLoading(true);setError('');const result=await listPublicEvents(false);setData(result.items.slice(0,3));}catch(error:unknown){setData([]);setError(error instanceof Error&&error.message?error.message:'Etkinlik vitrini yüklenemedi.');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),60000);return()=>window.clearInterval(timer);},[]);
 const featured=data[0]??null;const secondary=useMemo(()=>data.slice(1,3),[data]);
 async function share(event:PublicEvent){
  try{setShareStatus('');const url=buildEventUrl(event.slug);const result=await shareOrCopy({title:event.title,text:`${event.title} - ${formatEventDate(event.startsAt)} - ${event.locationName}`,url});if(result==='copied')setShareStatus('Etkinlik bağlantısı kopyalandı.');else if(result==='shared')setShareStatus('Etkinlik paylaşım menüsüne gönderildi.');}
  catch{setShareStatus('Etkinlik paylaşım bağlantısı şu anda kullanılamıyor.');}
 }
 if(loading)return <section className="mb-8" aria-label="Yaklaşan etkinlikler yükleniyor"><div role="status" aria-live="polite" className="h-56 animate-pulse rounded-[2rem] border border-brand-gold/20 bg-brand-gold/5"><span className="sr-only">Yaklaşan etkinlikler yükleniyor.</span></div></section>;
 if(error)return <section className="mb-8" aria-label="Etkinlik vitrini"><div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">Etkinlik vitrini şu anda doğrulanamadı.<button type="button" onClick={()=>void load()} className="ml-2 min-h-11 rounded-xl border px-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Tekrar dene</button></div></section>;
 if(!featured)return null;
 const featuredUrl=eventHref(featured.slug),timer=countdown(featured,now),state=eventState(featured,now),image=publicContentUrl(featured.imagePath);
 return <section className="mb-8" aria-labelledby="home-events-heading">
  {shareStatus?<div role="status" aria-live="polite" className="mb-3 rounded-xl border border-brand-gold/20 bg-brand-gold/10 px-4 py-3 text-sm font-semibold text-brand-green dark:text-brand-gold">{shareStatus}</div>:null}
  <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-[0.16em] text-brand-gold">Golden Oremar Etkinlikleri</div><h2 id="home-events-heading" className="mt-1 text-2xl font-black text-brand-green dark:text-brand-gold">Yaklaşan etkinlikler</h2><p className="mt-1 max-w-2xl text-sm text-gray-500">Herkese açık etkinlikleri keşfedin, yerinizi ayırın veya kontenjan dolduysa bekleme listesine katılın.</p></div><a href={eventsHref()} className="inline-flex min-h-11 items-center rounded-xl border px-4 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Tüm etkinlikler<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4"/></a></div>
  <div className="grid gap-4 lg:grid-cols-[1.45fr_.55fr]">
   <article className="relative overflow-hidden rounded-[2rem] border border-brand-gold/25 bg-brand-green text-white shadow-xl">
    {image?<img src={image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-35"/>:null}<div className="absolute inset-0 bg-gradient-to-r from-brand-green via-brand-green/95 to-brand-green/55"/>
    <div className="relative grid min-h-[22rem] gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
     <div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-xs font-black ${state.className}`}>{state.label}</span><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">Herkese açık</span></div>
      <h3 className="mt-5 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">{featured.title}</h3><p className="mt-3 max-w-2xl line-clamp-3 text-sm leading-6 text-white/80 sm:text-base">{featured.description}</p>
      <div className="mt-5 grid gap-2 text-sm text-white/85 sm:grid-cols-2"><div className="flex gap-2"><CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold"/><span>{formatEventDate(featured.startsAt)}</span></div><div className="flex gap-2"><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold"/><span>{featured.locationName}</span></div></div><CapacityMeter event={featured}/>
      <div className="mt-6 flex flex-wrap gap-3">{featuredUrl?<a href={featuredUrl} className="inline-flex min-h-12 items-center rounded-xl bg-brand-gold px-5 font-black text-brand-green shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><TicketCheck aria-hidden="true" className="mr-2 h-5 w-5"/>{featured.reservable?(featured.waitlistOnly?'Bekleme listesine katıl':'Etkinliği incele'):'Etkinliği incele'}</a>:null}<button type="button" onClick={()=>void share(featured)} className="inline-flex min-h-12 items-center rounded-xl border border-white/30 bg-white/10 px-5 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><Share2 aria-hidden="true" className="mr-2 h-5 w-5"/>Paylaş</button></div>
     </div>
     <div className="min-w-40 rounded-3xl border border-white/20 bg-black/15 p-5 text-center backdrop-blur-sm"><Clock3 aria-hidden="true" className="mx-auto h-6 w-6 text-brand-gold"/><div className="mt-2 text-xs font-bold uppercase tracking-[0.15em] text-white/65">{timer.eyebrow}</div><div className="mt-1 text-2xl font-black">{timer.value}</div></div>
    </div>
   </article>
   {secondary.length?<div className="grid gap-4">{secondary.map(event=>{const url=eventHref(event.slug),status=eventState(event,now),smallTimer=countdown(event,now);return <article key={event.id} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"><div className="flex items-start justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span><button type="button" onClick={()=>void share(event)} aria-label={`${event.title} etkinliğini paylaş`} className="grid min-h-11 min-w-11 place-items-center rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><Share2 aria-hidden="true" className="h-4 w-4"/></button></div><h3 className="mt-3 line-clamp-2 text-lg font-black text-brand-green dark:text-brand-gold">{event.title}</h3><div className="mt-3 space-y-2 text-sm text-gray-500"><div className="flex gap-2"><CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold"/><span>{formatEventDate(event.startsAt)}</span></div><div className="flex gap-2"><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold"/><span>{event.locationName}</span></div>{event.capacity!=null?<div className="flex gap-2"><Users aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold"/><span>{capacityLabel(event)}</span></div>:null}</div><div className="mt-4 rounded-xl bg-brand-gold/10 p-3 text-sm"><span className="font-bold text-brand-green dark:text-brand-gold">{smallTimer.eyebrow}:</span> {smallTimer.value}</div>{url?<a href={url} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-green px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Detay ve kayıt<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4"/></a>:null}</article>;})}</div>:null}
  </div>
 </section>;
}

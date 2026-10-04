import React, { useEffect, useRef, useState } from 'react';
import { BellRing, CreditCard, Inbox, Lock, Megaphone, MessageCircle, Moon, Package, PackageCheck, ShieldCheck, Smartphone, Sprout, Star, Store, Truck, Undo2 } from 'lucide-react';
import { ErrorState } from './ui';
import { getNotificationPreferencesV2, INBOX_OPTIONAL_CATEGORIES, updateNotificationPreferencesV2, type NotificationCategoryKey, type NotificationPreferencesPatch, type NotificationPreferencesV2 } from './notificationPreferencesApi';
import { disableNativePushRegistration, enableNativePushRegistration, getNativePushPermission, isNativePushPlatform, isNativePushProviderConfigured } from '../notifications/nativePush';
import { showAppToast } from '../../lib/appToast';

type Row = { key: NotificationCategoryKey; title: string; description: string; preview: string; Icon: React.ComponentType<{ className?: string }> };
type Group = { title: string; rows: Row[]; producerOnly?: boolean };

// Every row is an event the database really creates. The preview is the
// wording that notification arrives with.
const GROUPS: Group[] = [
  { title: 'Siparişlerim', rows: [
    { key: 'order', title: 'Sipariş durumu', description: 'Onay, hazırlık ve teslimat adımları', preview: 'GO-241004-7KQ2 numaralı siparişinizin yeni durumu: Hazırlanıyor.', Icon: Package },
    { key: 'shipment', title: 'Kargoya verildi', description: 'Kargo firması ve takip numarası', preview: 'Siparişiniz kargoya verildi. Takip numarasıyla izleyebilirsiniz.', Icon: Truck },
    { key: 'payment', title: 'Ödeme ve geri ödeme', description: 'Ödeme onayı ve iade tutarının yatması', preview: 'Ödemeniz onaylandı. Siparişiniz hazırlığa alındı.', Icon: CreditCard },
    { key: 'return', title: 'İade talepleri', description: 'İade talebinin her adımı', preview: 'İade talebiniz onaylandı. Ürünü kargoya verebilirsiniz.', Icon: Undo2 },
  ] },
  { title: 'Takip ettiklerim', rows: [
    { key: 'harvest', title: 'Hasat ve sipariş dönemi', description: '“Haber ver” dediğiniz ürünün sipariş dönemi açılınca', preview: 'Sipariş dönemi açıldı: Karakovan Petek Balı için sipariş verebilirsiniz.', Icon: Sprout },
    { key: 'restock', title: 'Stok tekrar geldi', description: 'Stok bildirimi açtığınız ürün yeniden satışta', preview: 'Stok geldi: Hakkari Dağ Elması yeniden stokta.', Icon: PackageCheck },
  ] },
  { title: 'Mesajlar ve değerlendirmeler', rows: [
    { key: 'message', title: 'Üretici ve destek mesajları', description: 'Üretici veya destek ekibi yanıt verdiğinde', preview: 'Yeni mesaj: Üretici sorunuzu yanıtladı.', Icon: MessageCircle },
    { key: 'review_reminder', title: 'Değerlendirme hatırlatması', description: 'Teslim edilen siparişi puanlamanız için bir kez', preview: 'Siparişiniz teslim edildi. Ürünleri puanlayıp deneyiminizi paylaşın.', Icon: Star },
    { key: 'review', title: 'Yorumunuza yanıt', description: 'Üretici değerlendirmenizi yanıtladığında', preview: 'Üretici değerlendirmenize yanıt verdi.', Icon: MessageCircle },
  ] },
  { title: 'Kampanyalar', rows: [
    { key: 'campaign', title: 'Kampanya ve sezon fırsatları', description: 'Golden Oremar duyuruları ve fırsatlar', preview: 'Yeni sezon ürünleri Golden Oremar’da.', Icon: Megaphone },
  ] },
  { title: 'Hesap', rows: [
    { key: 'system', title: 'Hesap ve güvenlik', description: 'Şifre, oturum ve hesap durumu', preview: 'Şifreniz güncellendi.', Icon: ShieldCheck },
  ] },
  { title: 'Mağazam', producerOnly: true, rows: [
    { key: 'producer', title: 'Mağaza işlemleri', description: 'Yeni sipariş, ürün onayı ve satıcı süreçleri', preview: 'Yeni sipariş: hazırlamanız gereken 1 ürün var.', Icon: Store },
  ] },
];

const TIMES = Array.from({ length: 48 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`);

function Switch({ checked, disabled, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: (next: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold disabled:cursor-not-allowed disabled:opacity-40 ${checked ? 'border-brand-green bg-brand-green' : 'border-brand-border bg-black/5 dark:bg-white/5'}`}>
    <span aria-hidden="true" className={`absolute h-5 w-5 rounded-full shadow transition-transform ${checked ? 'translate-x-[22px] bg-white' : 'translate-x-0.5 bg-brand-muted'}`} />
  </button>;
}

function errorText(error: unknown) {
  const message = String((error as { message?: unknown })?.message || '');
  if (message === 'DENIED') return 'Telefon bildirim izni verilmedi. Telefon ayarlarından izin verin.';
  if (message === 'NOT_READY') return 'Telefon bildirimleri bu cihazda henüz hazır değil.';
  if (message.includes('campaign_push_requires_marketing_consent')) return 'Kampanya bildirimleri için önce Profilimi Düzenle’den pazarlama iznini açın.';
  if (message.includes('quiet_hours_invalid')) return 'Sessiz saatlerin başlangıcı ve bitişi farklı olmalı.';
  return 'Değişiklik kaydedilemedi. Bağlantınızı kontrol edip yeniden deneyin.';
}

export default function NotificationPreferencesPanel({ isProducer = false }: { isProducer?: boolean }) {
  const [prefs, setPrefs] = useState<NotificationPreferencesV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState('unknown');
  const nativePlatform = isNativePushPlatform();
  const nativeConfigured = isNativePushProviderConfigured();
  const queue = useRef(Promise.resolve());

  async function load() {
    try { setLoading(true); setLoadError(''); setPrefs(await getNotificationPreferencesV2()); }
    catch { setPrefs(null); setLoadError('Bildirim tercihleri yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.'); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    void load();
    if (nativePlatform) void getNativePushPermission().then(value => setPermission(String(value))).catch(() => setPermission('unknown'));
  }, []);

  // Optimistic: the switch moves at once, the change is saved in order, and a
  // failed save puts the previous value back.
  function save(patch: NotificationPreferencesPatch, optimistic: NotificationPreferencesV2, message = 'Kaydedildi') {
    const previous = prefs;
    setPrefs(optimistic); setSaveError('');
    queue.current = queue.current.then(async () => {
      try {
        setBusy(true);
        if (nativePlatform && patch.pushEnabled === true) {
          const registration = await enableNativePushRegistration();
          if (registration.status === 'not-configured') throw new Error('NOT_READY');
          if (registration.status === 'denied') throw new Error('DENIED');
          setPermission('granted');
        }
        if (nativePlatform && patch.pushEnabled === false) { await disableNativePushRegistration(); setPermission(String(await getNativePushPermission())); }
        setPrefs(await updateNotificationPreferencesV2(patch));
        showAppToast(message);
      } catch (error) {
        setPrefs(previous); setSaveError(errorText(error));
      } finally { setBusy(false); }
    });
  }

  function setChannel(key: NotificationCategoryKey, channel: 'inApp' | 'push', value: boolean) {
    if (!prefs) return;
    const next = { ...prefs, categories: { ...prefs.categories, [key]: { ...prefs.categories[key], [channel]: value } } };
    save({ categories: { [key]: { [channel]: value } } }, next);
  }
  function setQuiet(patch: Partial<NotificationPreferencesV2['quietHours']>) {
    if (!prefs) return;
    const quietHours = { ...prefs.quietHours, ...patch };
    if (quietHours.enabled && quietHours.start === quietHours.end) { setSaveError('Sessiz saatlerin başlangıcı ve bitişi farklı olmalı.'); return; }
    save({ quietHours: patch }, { ...prefs, quietHours });
  }

  if (loading) return <div role="status" className="rounded-2xl border-2 border-brand-border bg-brand-card p-5 text-sm font-semibold text-brand-muted">Bildirim tercihleri yükleniyor…</div>;
  if (loadError || !prefs) return <ErrorState message={loadError || 'Bildirim tercihleri yüklenemedi.'} onRetry={() => void load()} />;

  const pushNote = nativePlatform
    ? nativeConfigured ? `Bu telefon: ${permission === 'granted' ? 'izin verildi' : permission === 'denied' ? 'izin kapalı, telefon ayarlarından açın' : 'izin henüz sorulmadı'}.` : 'Telefon bildirimleri bu sürümde henüz etkin değil; bildirimler uygulamada görünür.'
    : 'Telefon bildirimleri Golden Oremar Android uygulamasına gelir.';

  return <section aria-labelledby="notification-prefs-title" className="space-y-5" aria-busy={busy}>
    <div>
      <h2 id="notification-prefs-title" data-account-panel-heading tabIndex={-1} className="text-2xl font-black outline-none">Bildirim Tercihleri</h2>
      <p className="mt-1 text-sm text-brand-muted">Hangi gelişmeden nasıl haberdar olacağınızı seçin. Değişiklikler anında kaydedilir.</p>
    </div>
    {saveError ? <div role="alert" className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{saveError}</div> : null}

    <div className="flex items-center gap-3 rounded-2xl border-2 border-brand-green/30 bg-brand-green/5 p-4">
      <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-green text-brand-on-green"><Smartphone className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block font-black text-brand-text">Telefon bildirimleri</span><span className="mt-0.5 block text-xs leading-5 text-brand-muted">{pushNote}</span></span>
      <Switch checked={prefs.pushEnabled} label="Telefon bildirimleri" onChange={value => save({ pushEnabled: value }, { ...prefs, pushEnabled: value }, value ? 'Telefon bildirimleri açıldı' : 'Telefon bildirimleri kapatıldı')} />
    </div>

    <div className="flex items-end gap-4 px-4 text-[11px] font-bold text-brand-muted" aria-hidden="true"><span className="flex-1 uppercase tracking-wide">Bildirim</span><span className="flex w-12 flex-col items-center gap-0.5"><Inbox className="h-4 w-4" />Uygulama</span><span className="flex w-12 flex-col items-center gap-0.5"><Smartphone className="h-4 w-4" />Telefon</span></div>

    {GROUPS.filter(group => !group.producerOnly || isProducer).map(group => <section key={group.title} aria-label={group.title} className="overflow-hidden rounded-2xl border-2 border-brand-border bg-brand-card">
      <h3 className="border-b border-brand-border bg-brand-green/5 px-4 py-2.5 text-sm font-black text-brand-green dark:text-brand-gold">{group.title}</h3>
      <ul className="divide-y divide-brand-border">{group.rows.map(row => {
        const choice = prefs.categories[row.key];
        const inboxLocked = !INBOX_OPTIONAL_CATEGORIES.has(row.key);
        const campaignNeedsConsent = row.key === 'campaign' && !prefs.marketingConsent;
        return <li key={row.key} className="p-4">
          <div className="flex items-start gap-3">
          <span aria-hidden="true" className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-gold/10 text-brand-gold"><row.Icon className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="font-bold leading-6 text-brand-text">{row.title}</div>
            <div className="text-sm leading-5 text-brand-muted">{row.description}</div>
          </div>
          <div className="flex shrink-0 items-center gap-4 pt-1">
            {inboxLocked
              ? <span className="grid h-7 w-12 place-items-center" title="Her zaman açık"><Lock aria-hidden="true" className="h-4 w-4 text-brand-muted" /><span className="sr-only">{row.title}, uygulamada her zaman açık</span></span>
              : <Switch checked={choice.inApp} label={`${row.title}, uygulamada`} onChange={value => setChannel(row.key, 'inApp', value)} />}
            <Switch checked={prefs.pushEnabled && choice.push} disabled={!prefs.pushEnabled || campaignNeedsConsent} label={`${row.title}, telefona`} onChange={value => setChannel(row.key, 'push', value)} />
          </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-700 dark:bg-gray-800/70 dark:text-gray-200 sm:ml-[52px]"><BellRing aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-green" /><span><span className="sr-only">Örnek: </span>{row.preview}</span></div>
          {campaignNeedsConsent ? <p className="mt-2 text-xs text-brand-muted sm:ml-[52px]">Telefona kampanya bildirimi için Profilimi Düzenle’den pazarlama iznini açın.</p> : null}
        </li>;
      })}</ul>
    </section>)}

    <section aria-labelledby="quiet-hours-title" className="rounded-2xl border-2 border-brand-border bg-brand-card p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"><Moon className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span id="quiet-hours-title" className="block font-black text-brand-text">Sessiz saatler</span><span className="block text-xs leading-5 text-brand-muted">Bu saatlerde telefona bildirim gelmez; bildirimler uygulamada bekler. Hesap güvenliği hariç. Türkiye saati.</span></span>
        <Switch checked={prefs.quietHours.enabled} disabled={!prefs.pushEnabled} label="Sessiz saatler" onChange={value => setQuiet({ enabled: value })} />
      </div>
      {prefs.quietHours.enabled ? <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold">Başlangıç<select value={prefs.quietHours.start} onChange={event => setQuiet({ start: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border-2 border-brand-border bg-transparent px-3">{TIMES.map(time => <option key={time} value={time}>{time}</option>)}</select></label>
        <label className="block text-sm font-semibold">Bitiş<select value={prefs.quietHours.end} onChange={event => setQuiet({ end: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border-2 border-brand-border bg-transparent px-3">{TIMES.map(time => <option key={time} value={time}>{time}</option>)}</select></label>
      </div> : null}
    </section>

    <p className="px-1 text-xs leading-5 text-brand-muted"><Inbox aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />Uygulamada: Hesabım › Bildirimler kutusu. <Smartphone aria-hidden="true" className="mx-1 inline h-3.5 w-3.5" />Telefona: Android uygulaması. Ödeme makbuzları her zaman e-postanıza gönderilir; kampanya e-postaları için E-bülten ayarını kullanın. SMS bildirimi gönderilmez.</p>
  </section>;
}

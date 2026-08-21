import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BanknoteArrowDown, Eye, EyeOff, LockKeyhole, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { cancelProducerPayout, getMyProducerBankIdentity, getProducerFinance, listProducerPayouts, producerFinanceErrorMessage, requestProducerPayout, type ProducerBalance, type ProducerBankIdentity, type ProducerPayout } from './api';
import { ErrorState, LoadingState, Money, Panel } from '../account/ui';

const PAYOUT_PAGE_SIZE = 20;
const payoutLabel: Record<ProducerPayout['status'], string> = { requested: 'Ödeme talebi alındı', scheduled: 'Planlandı', processing: 'Aktarım işleniyor', paid: 'Ödendi', failed: 'Başarısız', cancelled: 'İptal edildi' };
const payoutChannelLabel: Record<ProducerPayout['channel'], string> = { provider_marketplace: 'iyzico pazaryeri aktarımı', manual_bank_transfer: 'Manuel banka transferi' };
const accountStatus: Record<ProducerBankIdentity['paymentAccountStatus'], string> = { pending_configuration: 'Yapılandırma bekliyor', onboarding: 'Sağlayıcı kaydı sürüyor', ready: 'Ödeme hesabı hazır', suspended: 'Askıya alındı', error: 'Yapılandırma hatası' };
function mergePayouts(previous: ProducerPayout[], incoming: ProducerPayout[]) { const unique = new Map<string, ProducerPayout>(); for (const payout of [...previous, ...incoming]) if (!unique.has(payout.id)) unique.set(payout.id, payout); return Array.from(unique.values()); }
function formatIban(value: string) { return value.replace(/(.{4})/g, '$1 ').trim(); }
function majorToMinor(value: string) { const normalized = value.trim().replace(',', '.'); if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null; const [whole, fraction = ''] = normalized.split('.'); const minor = Number(whole) * 100 + Number((fraction + '00').slice(0, 2)); return Number.isSafeInteger(minor) && minor > 0 ? minor : null; }
function minorToMajor(value: number) { return (value / 100).toFixed(2).replace('.', ','); }

export default function ProducerFinancePanel({ onBack }: { onBack: () => void }) {
  const [balances, setBalances] = useState<ProducerBalance[]>([]);
  const [payouts, setPayouts] = useState<ProducerPayout[]>([]);
  const [bankIdentity, setBankIdentity] = useState<ProducerBankIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [revealingBank, setRevealingBank] = useState(false);
  const [payoutBusy, setPayoutBusy] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [bankError, setBankError] = useState('');
  const [payoutError, setPayoutError] = useState('');
  const [toast, setToast] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const [withdrawCurrency, setWithdrawCurrency] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');

  const withdrawable = useMemo(() => balances.filter(row => row.availableMinor > 0), [balances]);
  const selectedBalance = useMemo(() => withdrawable.find(row => row.currency === withdrawCurrency) || withdrawable[0] || null, [withdrawable, withdrawCurrency]);

  async function load(preserveBank = false) {
    try {
      setLoading(true); setError(''); setLoadMoreError(''); setPayoutError(''); if (!preserveBank) { setBankIdentity(null); setBankError(''); }
      const [balanceRows, payoutRows] = await Promise.all([getProducerFinance(), listProducerPayouts(PAYOUT_PAGE_SIZE, 0)]);
      setBalances(balanceRows); setPayouts(payoutRows); setHasMore(payoutRows.length === PAYOUT_PAGE_SIZE);
      const first = balanceRows.find(row => row.availableMinor > 0); setWithdrawCurrency(current => balanceRows.some(row => row.currency === current && row.availableMinor > 0) ? current : first?.currency || '');
    } catch (err: unknown) { setError(producerFinanceErrorMessage(err, 'Finans bilgileri yüklenemedi.')); }
    finally { setLoading(false); }
  }

  function showToast(message: string) { setToast(message); window.setTimeout(() => setToast(''), 4500); }

  async function revealBank() {
    if (revealingBank) return;
    if (bankIdentity) { setBankIdentity(null); setBankError(''); return; }
    try { setRevealingBank(true); setBankError(''); setBankIdentity(await getMyProducerBankIdentity()); }
    catch (err: unknown) { setBankError(producerFinanceErrorMessage(err, 'Ödeme hesabınız görüntülenemedi.')); }
    finally { setRevealingBank(false); }
  }

  async function submitWithdrawal(event: React.FormEvent) {
    event.preventDefault(); if (!selectedBalance || payoutBusy) return;
    const amountMinor = majorToMinor(withdrawAmount); if (!amountMinor) { setPayoutError('Çekim tutarını kuruş hassasiyetinde geçerli bir sayı olarak girin.'); return; }
    if (amountMinor > selectedBalance.availableMinor) { setPayoutError('Çekim tutarı kullanılabilir bakiyeden yüksek olamaz.'); return; }
    try {
      setPayoutBusy('request'); setPayoutError(''); await requestProducerPayout(selectedBalance.currency, amountMinor, withdrawNote);
      setWithdrawAmount(''); setWithdrawNote(''); showToast('Çekim talebiniz oluşturuldu. Tutar tekrar çekilmemesi için rezerve edildi.'); await load(true);
    } catch (err: unknown) { setPayoutError(producerFinanceErrorMessage(err, 'Çekim talebi oluşturulamadı.')); }
    finally { setPayoutBusy(''); }
  }

  async function cancelWithdrawal(payout: ProducerPayout) {
    if (payoutBusy) return;
    try { setPayoutBusy(payout.id); setPayoutError(''); await cancelProducerPayout(payout.id); showToast('Bekleyen çekim talebi iptal edildi ve tutar tekrar kullanılabilir bakiyeye döndü.'); await load(true); }
    catch (err: unknown) { setPayoutError(producerFinanceErrorMessage(err, 'Çekim talebi iptal edilemedi.')); }
    finally { setPayoutBusy(''); }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    try { setLoadingMore(true); setLoadMoreError(''); const rows = await listProducerPayouts(PAYOUT_PAGE_SIZE, payouts.length); setPayouts(previous => mergePayouts(previous, rows)); setHasMore(rows.length === PAYOUT_PAGE_SIZE); }
    catch (err: unknown) { setLoadMoreError(producerFinanceErrorMessage(err, 'Daha eski ödeme kayıtları yüklenemedi.')); }
    finally { setLoadingMore(false); }
  }

  useEffect(() => { void load(); return () => setBankIdentity(null); }, []);
  if (loading) return <LoadingState label="Satıcı finans bilgileri yükleniyor" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3"><button type="button" onClick={onBack} className="min-h-11 rounded-xl border px-4 font-semibold" aria-label="Satıcı paneline dön"><ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4"/>Geri</button><button type="button" onClick={() => void load(true)} disabled={loadingMore || revealingBank || Boolean(payoutBusy)} className="min-h-11 rounded-xl border px-4 font-semibold disabled:opacity-50" aria-label="Finans bilgilerini yenile"><RefreshCw aria-hidden="true" className="mr-2 inline h-4 w-4"/>Yenile</button></div>

    <Panel title="Finans ve Bakiye" description="Müşteri ödemesi önce korumalı havuzda kalır. Teslimat tamamlanıp Super Admin onay verdiğinde iyzico pazaryeri payı kayıtlı IBAN'a aktarılmak üzere serbest bırakılır. Aynı satış için ikinci bir manuel ödeme oluşturulmaz.">
      {!balances.length ? <p className="text-sm text-gray-500">Henüz finans hareketi yok.</p> : <div className="grid gap-3">{balances.map(balance => <section key={`${balance.producerId}:${balance.currency}`} className="rounded-2xl border p-4" aria-label={`${balance.currency} finans özeti`}><div className="text-sm font-semibold">{balance.currency}</div><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Manuel çekilebilir"><Money minor={balance.availableMinor} currency={balance.currency}/></Metric><Metric label="Korumalı / bekleyen"><Money minor={balance.pendingMinor} currency={balance.currency}/></Metric><Metric label="Serbest bırakılan defter"><Money minor={balance.availableLedgerMinor} currency={balance.currency}/></Metric><Metric label="iyzico aktarımı sürüyor"><Money minor={balance.providerTransferProcessingMinor} currency={balance.currency}/></Metric><Metric label="Banka çekimi bekliyor"><Money minor={balance.manualWithdrawalPendingMinor} currency={balance.currency}/></Metric><Metric label="Toplam rezerve"><Money minor={balance.reservedPayoutMinor} currency={balance.currency}/></Metric><Metric label="Ödenen toplam"><Money minor={balance.paidMinor} currency={balance.currency}/></Metric><Metric label="Yaşam boyu net"><Money minor={balance.netSalesMinor} currency={balance.currency}/></Metric></div></section>)}</div>}
    </Panel>

    <Panel title="Ödeme Hesabım" description="Onaylı satıcı başvurunuza bağlı IBAN ödeme hedefidir. Siz kendi hesabınızı, Super Admin ise ödeme ve mutabakat operasyonunda tam IBAN'ı görebilir.">
      <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><LockKeyhole aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-brand-green"/><div><div className="font-bold">Bağlı banka hesabı</div><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">IBAN ilk yüklemede gereksiz yere ekrana basılmaz. Görüntüleme denetim kaydına yazılır, ancak ödeme yetkisine sahip Super Admin'den gizlenmez.</p></div></div><button type="button" onClick={() => void revealBank()} disabled={revealingBank} aria-expanded={Boolean(bankIdentity)} className="min-h-11 shrink-0 rounded-xl border border-brand-green px-4 font-bold text-brand-green disabled:opacity-50">{bankIdentity ? <EyeOff aria-hidden="true" className="mr-2 inline h-4 w-4"/> : <Eye aria-hidden="true" className="mr-2 inline h-4 w-4"/>}{revealingBank ? 'Doğrulanıyor...' : bankIdentity ? 'IBAN’ı gizle' : 'IBAN’ımı göster'}</button></div>
      {bankError ? <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{bankError}</div> : null}
      {bankIdentity ? <dl className="mt-4 grid gap-3 rounded-2xl bg-white p-4 text-sm dark:bg-gray-900/60 sm:grid-cols-2"><BankField label="Hesap sahibi" value={bankIdentity.bankAccountHolder}/><BankField label="Ödeme sağlayıcısı" value={bankIdentity.provider}/><div className="sm:col-span-2"><BankField label="IBAN" value={formatIban(bankIdentity.iban)} mono/></div><BankField label="Hesap durumu" value={accountStatus[bankIdentity.paymentAccountStatus]}/><BankField label="KYC güncelleme" value={formatDate(bankIdentity.updatedAt)}/></dl> : null}
      </div>
    </Panel>

    <Panel title="Manuel Çekim" description="Bu alan yalnız sağlayıcı tarafından zaten aktarılmamış gerçek kullanılabilir bakiyeyi banka transferi için rezerve eder. iyzico pazaryeri satışları burada ikinci kez çekilemez.">
      {!withdrawable.length ? <div className="rounded-xl border p-4 text-sm text-gray-600 dark:text-gray-300"><BanknoteArrowDown aria-hidden="true" className="mr-2 inline h-5 w-5 text-brand-green"/>Şu anda manuel çekime uygun bakiye yok. Sağlayıcı aktarımındaki tutarlar ödeme geçmişinde ayrıca görünür.</div> : <form onSubmit={submitWithdrawal} className="grid gap-4 rounded-2xl border p-4 md:grid-cols-2"><label><span className="text-sm font-semibold">Para birimi</span><select value={selectedBalance?.currency || ''} onChange={event => { setWithdrawCurrency(event.target.value); setWithdrawAmount(''); setPayoutError(''); }} className="mt-1 min-h-11 w-full rounded-xl border px-3">{withdrawable.map(row => <option key={row.currency} value={row.currency}>{row.currency} - {minorToMajor(row.availableMinor)} kullanılabilir</option>)}</select></label><label><span className="text-sm font-semibold">Çekim tutarı</span><div className="mt-1 flex gap-2"><input inputMode="decimal" required value={withdrawAmount} onChange={event => setWithdrawAmount(event.target.value)} placeholder="0,00" className="min-h-11 min-w-0 flex-1 rounded-xl border px-3"/><button type="button" onClick={() => selectedBalance && setWithdrawAmount(minorToMajor(selectedBalance.availableMinor))} className="min-h-11 rounded-xl border px-3 font-semibold">Tümü</button></div></label><label className="md:col-span-2"><span className="text-sm font-semibold">Not <span className="font-normal text-gray-500">(isteğe bağlı)</span></span><textarea rows={2} maxLength={1000} value={withdrawNote} onChange={event => setWithdrawNote(event.target.value)} className="mt-1 w-full rounded-xl border p-3" placeholder="Ödeme operasyonu için açıklama"/></label><div className="md:col-span-2"><button disabled={Boolean(payoutBusy)} className="min-h-11 w-full rounded-xl bg-brand-green px-4 font-bold text-brand-on-green disabled:opacity-50">{payoutBusy === 'request' ? 'Talep oluşturuluyor...' : 'IBAN’ıma çekim talebi oluştur'}</button></div></form>}
      {payoutError ? <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{payoutError}</div> : null}
    </Panel>

    <Panel title="Ödeme Geçmişi" description="iyzico pazaryeri aktarımları ve manuel banka çekimleri aynı finans geçmişinde, ancak ayrı kanallar olarak izlenir.">
      {!payouts.length ? <p className="text-sm text-gray-500">Henüz ödeme kaydı yok.</p> : <div className="space-y-3">{payouts.map(payout => <article key={payout.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-bold"><Money minor={payout.amount_minor} currency={payout.currency}/></div><div className="mt-1 text-xs font-semibold text-gray-500">{payoutChannelLabel[payout.channel]}</div></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold dark:bg-gray-800">{payoutLabel[payout.status]}</span></div>{payout.destination_account_holder || payout.destination_iban_masked ? <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900/60"><div className="font-semibold">Ödeme hedefi</div>{payout.destination_account_holder ? <div>{payout.destination_account_holder}</div> : null}{payout.destination_iban_masked ? <div className="font-mono">{payout.destination_iban_masked}</div> : null}</div> : null}<div className="mt-2 text-sm text-gray-500">Oluşturulma: {formatDate(payout.created_at)}</div>{payout.requested_at ? <div className="text-sm text-gray-500">Talep: {formatDate(payout.requested_at)}</div> : null}{payout.provider_settlement_released_at ? <div className="text-sm text-gray-500">Sağlayıcıya serbest bırakıldı: {formatDate(payout.provider_settlement_released_at)}</div> : null}{payout.processed_at ? <div className="text-sm text-gray-500">Sonuçlandı: {formatDate(payout.processed_at)}</div> : null}{payout.provider_reference ? <div className="mt-1 break-all text-sm text-gray-500">Transfer referansı: {payout.provider_reference}</div> : null}{payout.note ? <div className={`mt-2 text-sm ${payout.status === 'failed' ? 'text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-300'}`}>{payout.note}</div> : null}{payout.channel === 'manual_bank_transfer' && payout.status === 'requested' && payout.request_source === 'producer' ? <button type="button" disabled={Boolean(payoutBusy)} onClick={() => void cancelWithdrawal(payout)} className="mt-3 min-h-11 rounded-xl border border-red-200 px-4 font-semibold text-red-700 disabled:opacity-50"><XCircle aria-hidden="true" className="mr-2 inline h-4 w-4"/>{payoutBusy === payout.id ? 'İptal ediliyor...' : 'Bekleyen talebi iptal et'}</button> : null}</article>)}
      {loadMoreError ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"><p>{loadMoreError}</p><button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="mt-2 min-h-11 rounded-xl border px-4 font-semibold disabled:opacity-50">Tekrar dene</button></div> : null}
      {hasMore ? <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="min-h-11 w-full rounded-xl border border-brand-green px-4 font-bold text-brand-green disabled:opacity-50">{loadingMore ? 'Daha eski ödemeler yükleniyor...' : 'Daha eski ödemeleri göster'}</button> : null}<div className="sr-only" aria-live="polite">{loadingMore ? 'Daha eski ödeme kayıtları yükleniyor.' : loadMoreError || `${payouts.length} ödeme kaydı gösteriliyor.`}</div></div>}
    </Panel>

    <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4 text-sm"><div className="flex gap-3"><ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-green"/><p>Bir satış iyzico pazaryeri kırılımıyla serbest bırakıldığında sağlayıcı aktarımı ayrıca rezerve edilir. Böylece aynı hakediş hem iyzico tarafından hem manuel banka transferiyle iki kez ödenemez.</p></div></div>
    {toast ? <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white">{toast}</div> : null}
  </div>;
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) { return <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 font-bold">{children}</div></div>; }
function BankField({label,value,mono=false}:{label:string;value:string;mono?:boolean}) { return <div><dt className="text-xs font-semibold text-gray-500">{label}</dt><dd className={`mt-1 break-words font-bold ${mono ? 'font-mono tracking-wide' : ''}`}>{value}</dd></div>; }
function formatDate(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return 'Tarih doğrulanamadı'; try { return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(date); } catch { return 'Tarih doğrulanamadı'; } }

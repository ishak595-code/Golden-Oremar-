import React, { useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { getMyProducerBankIdentity, getProducerFinance, listProducerPayouts, type ProducerBalance, type ProducerBankIdentity, type ProducerPayout } from './api';
import { ErrorState, LoadingState, Money, Panel } from '../account/ui';

const PAYOUT_PAGE_SIZE = 20;
const payoutLabel: Record<ProducerPayout['status'], string> = { scheduled: 'Planlandı', processing: 'İşleniyor', paid: 'Ödendi', failed: 'Başarısız', cancelled: 'İptal edildi' };
const accountStatus: Record<ProducerBankIdentity['paymentAccountStatus'], string> = { pending_configuration: 'Yapılandırma bekliyor', onboarding: 'Sağlayıcı kaydı sürüyor', ready: 'Ödeme hesabı hazır', suspended: 'Askıya alındı', error: 'Yapılandırma hatası' };
function mergePayouts(previous: ProducerPayout[], incoming: ProducerPayout[]) { const unique = new Map<string, ProducerPayout>(); for (const payout of [...previous, ...incoming]) if (!unique.has(payout.id)) unique.set(payout.id, payout); return Array.from(unique.values()); }
function formatIban(value: string) { return value.replace(/(.{4})/g, '$1 ').trim(); }

export default function ProducerFinancePanel({ onBack }: { onBack: () => void }) {
  const [balances, setBalances] = useState<ProducerBalance[]>([]);
  const [payouts, setPayouts] = useState<ProducerPayout[]>([]);
  const [bankIdentity, setBankIdentity] = useState<ProducerBankIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [revealingBank, setRevealingBank] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [bankError, setBankError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');

  async function load() {
    try {
      setLoading(true); setError(''); setLoadMoreError(''); setBankIdentity(null); setBankError('');
      const [balanceRows, payoutRows] = await Promise.all([getProducerFinance(), listProducerPayouts(PAYOUT_PAGE_SIZE, 0)]);
      setBalances(balanceRows); setPayouts(payoutRows); setHasMore(payoutRows.length === PAYOUT_PAGE_SIZE);
    } catch (err: unknown) { setError(messageOf(err, 'Finans bilgileri yüklenemedi.')); }
    finally { setLoading(false); }
  }

  async function revealBank() {
    if (revealingBank) return;
    if (bankIdentity) { setBankIdentity(null); setBankError(''); return; }
    try { setRevealingBank(true); setBankError(''); setBankIdentity(await getMyProducerBankIdentity()); }
    catch (err: unknown) { setBankError(messageOf(err, 'Ödeme hesabınız görüntülenemedi.')); }
    finally { setRevealingBank(false); }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    try { setLoadingMore(true); setLoadMoreError(''); const rows = await listProducerPayouts(PAYOUT_PAGE_SIZE, payouts.length); setPayouts(previous => mergePayouts(previous, rows)); setHasMore(rows.length === PAYOUT_PAGE_SIZE); }
    catch (err: unknown) { setLoadMoreError(messageOf(err, 'Daha eski ödeme kayıtları yüklenemedi.')); }
    finally { setLoadingMore(false); }
  }

  useEffect(() => { void load(); return () => setBankIdentity(null); }, []);
  if (loading) return <LoadingState label="Satıcı finans bilgileri yükleniyor" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3"><button type="button" onClick={onBack} className="min-h-11 rounded-xl border px-4 font-semibold" aria-label="Satıcı paneline dön"><ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4"/>Geri</button><button type="button" onClick={() => void load()} disabled={loadingMore || revealingBank} className="min-h-11 rounded-xl border px-4 font-semibold disabled:opacity-50" aria-label="Finans bilgilerini yenile"><RefreshCw aria-hidden="true" className="mr-2 inline h-4 w-4"/>Yenile</button></div>

    <Panel title="Finans ve Bakiye" description="Bekleyen tutar teslimat ve Super Admin hakediş onayı tamamlanana kadar çekilebilir bakiyeye geçmez.">
      {!balances.length ? <p className="text-sm text-gray-500">Henüz finans hareketi yok.</p> : <div className="grid gap-3">{balances.map(balance => <section key={`${balance.producerId}:${balance.currency}`} className="rounded-2xl border p-4" aria-label={`${balance.currency} finans özeti`}><div className="text-sm font-semibold">{balance.currency}</div><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3"><Metric label="Ödenebilir"><Money minor={balance.availableMinor} currency={balance.currency}/></Metric><Metric label="Korumalı / bekleyen"><Money minor={balance.pendingMinor} currency={balance.currency}/></Metric><Metric label="Serbest bırakılan"><Money minor={balance.availableLedgerMinor} currency={balance.currency}/></Metric><Metric label="Planlanan / işlemde"><Money minor={balance.reservedPayoutMinor} currency={balance.currency}/></Metric><Metric label="Ödenen toplam"><Money minor={balance.paidMinor} currency={balance.currency}/></Metric><Metric label="Yaşam boyu net"><Money minor={balance.netSalesMinor} currency={balance.currency}/></Metric></div></section>)}</div>}
    </Panel>

    <Panel title="Ödeme Hesabım" description="IBAN başvurunuzdaki şifreli KYC kaydından okunur. Yalnız siz ve yetkili Super Admin görüntüleyebilir.">
      <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><LockKeyhole aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-brand-green"/><div><div className="font-bold">Banka hesabı gizli tutuluyor</div><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">IBAN ilk yüklemede istemciye gönderilmez. Görüntülediğinizde hassas erişim sunucuda kayıt altına alınır.</p></div></div><button type="button" onClick={() => void revealBank()} disabled={revealingBank} aria-expanded={Boolean(bankIdentity)} className="min-h-11 shrink-0 rounded-xl border border-brand-green px-4 font-bold text-brand-green disabled:opacity-50">{bankIdentity ? <EyeOff aria-hidden="true" className="mr-2 inline h-4 w-4"/> : <Eye aria-hidden="true" className="mr-2 inline h-4 w-4"/>}{revealingBank ? 'Doğrulanıyor...' : bankIdentity ? 'IBAN’ı gizle' : 'IBAN’ımı göster'}</button></div>
      {bankError ? <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{bankError}</div> : null}
      {bankIdentity ? <dl className="mt-4 grid gap-3 rounded-2xl bg-white p-4 text-sm dark:bg-gray-900/60 sm:grid-cols-2"><BankField label="Hesap sahibi" value={bankIdentity.bankAccountHolder}/><BankField label="Ödeme sağlayıcısı" value={bankIdentity.provider}/><div className="sm:col-span-2"><BankField label="IBAN" value={formatIban(bankIdentity.iban)} mono/></div><BankField label="Hesap durumu" value={accountStatus[bankIdentity.paymentAccountStatus]}/><BankField label="KYC güncelleme" value={formatDate(bankIdentity.updatedAt)}/></dl> : null}
      </div>
    </Panel>

    <Panel title="Ödeme Geçmişi" description="Planlanan, işlenen ve tamamlanan gerçek satıcı ödemeleriniz.">
      {!payouts.length ? <p className="text-sm text-gray-500">Henüz ödeme kaydı yok.</p> : <div className="space-y-3">{payouts.map(payout => <article key={payout.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-bold"><Money minor={payout.amount_minor} currency={payout.currency}/></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold dark:bg-gray-800">{payoutLabel[payout.status]}</span></div><div className="mt-2 text-sm text-gray-500">Oluşturulma: {formatDate(payout.created_at)}</div>{payout.scheduled_at ? <div className="text-sm text-gray-500">Planlanan: {formatDate(payout.scheduled_at)}</div> : null}{payout.processed_at ? <div className="text-sm text-gray-500">İşlendi: {formatDate(payout.processed_at)}</div> : null}{payout.status === 'failed' && payout.note ? <div role="status" className="mt-2 text-sm text-red-700 dark:text-red-300">{payout.note}</div> : null}</article>)}
      {loadMoreError ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"><p>{loadMoreError}</p><button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="mt-2 min-h-11 rounded-xl border px-4 font-semibold disabled:opacity-50">Tekrar dene</button></div> : null}
      {hasMore ? <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="min-h-11 w-full rounded-xl border border-brand-green px-4 font-bold text-brand-green disabled:opacity-50">{loadingMore ? 'Daha eski ödemeler yükleniyor...' : 'Daha eski ödemeleri göster'}</button> : null}<div className="sr-only" aria-live="polite">{loadingMore ? 'Daha eski ödeme kayıtları yükleniyor.' : loadMoreError || `${payouts.length} ödeme kaydı gösteriliyor.`}</div></div>}
    </Panel>

    <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4 text-sm"><div className="flex gap-3"><ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-green"/><p>Müşteri ödemesi, sipariş tamamlanıp açık iade/geri ödeme kalmayıp Super Admin sağlayıcı kırılımlarını onaylayana kadar çekilebilir satıcı bakiyesine geçmez.</p></div></div>
  </div>;
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) { return <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 font-bold">{children}</div></div>; }
function BankField({label,value,mono=false}:{label:string;value:string;mono?:boolean}) { return <div><dt className="text-xs font-semibold text-gray-500">{label}</dt><dd className={`mt-1 break-words font-bold ${mono ? 'font-mono tracking-wide' : ''}`}>{value}</dd></div>; }
function formatDate(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return 'Tarih doğrulanamadı'; try { return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(date); } catch { return 'Tarih doğrulanamadı'; } }
function messageOf(error: unknown, fallback: string) { const message = String((error as { message?: unknown } | null)?.message || '').trim(); return message || fallback; }

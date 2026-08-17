import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Check, CheckCircle, ClipboardCheck, Eye, FileSearch, FileText, Loader2, MapPin, RefreshCw, Search, ShieldCheck, Store, X, XCircle } from 'lucide-react';
import {
  adminGetProducerApplicationSensitive,
  adminListProducerApplications,
  adminReviewProducerApplication,
  adminSetProducerDocumentStatus,
  producerApplicationErrorMessage,
  type AdminProducerApplication,
  type ProducerApplicationDocument,
  type ProducerApplicationStatus,
  type SensitiveProducerApplication,
} from './producerApplicationAdminApi';
import { createProducerDocumentPreviewUrl } from './producerDocumentApi';
import { useAccessibleDialog } from '../features/accessibility/useAccessibleDialog';

type ReviewAction = 'under_review' | 'needs_information' | 'approved' | 'rejected';

function statusLabel(status: ProducerApplicationStatus) {
  return ({ draft: 'Taslak', submitted: 'Gönderildi', under_review: 'İnceleniyor', needs_information: 'Ek bilgi gerekli', approved: 'Onaylandı', rejected: 'Reddedildi', withdrawn: 'Geri çekildi' } as const)[status];
}

function statusClass(status: ProducerApplicationStatus) {
  if (status === 'approved') return 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200';
  if (status === 'rejected' || status === 'withdrawn') return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200';
  if (status === 'needs_information') return 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200';
  if (status === 'under_review') return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200';
  return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200';
}

function documentStatusClass(status: string) {
  if (status === 'verified') return 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200';
  if (status === 'rejected') return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200';
  return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200';
}

function documentStatusLabel(status: string) {
  return status === 'verified' ? 'Doğrulandı' : status === 'rejected' ? 'Reddedildi' : 'Bekliyor';
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Bilinmiyor';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Bilinmiyor' : date.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
}

export function AdminVendorApplications() {
  const [applications, setApplications] = useState<AdminProducerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProducerApplicationStatus>('submitted');
  const [selected, setSelected] = useState<AdminProducerApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [commissionPercent, setCommissionPercent] = useState(10);
  const [sensitivePurpose, setSensitivePurpose] = useState('');
  const [sensitive, setSensitive] = useState<SensitiveProducerApplication | null>(null);
  const [sensitiveLoading, setSensitiveLoading] = useState(false);

  const closeDetail = () => {
    if (busy || sensitiveLoading || reviewAction) return;
    setSelected(null);
    setSensitive(null);
    setSensitivePurpose('');
    setError('');
  };

  const closeReview = () => {
    if (busy) return;
    setReviewAction(null);
    setReviewReason('');
    setError('');
  };

  const detailDialogRef = useAccessibleDialog<HTMLElement>(Boolean(selected), closeDetail);
  const reviewDialogRef = useAccessibleDialog<HTMLElement>(Boolean(reviewAction && selected), closeReview);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const rows = await adminListProducerApplications();
      setApplications(rows);
      setSelected(current => current ? rows.find(row => row.id === current.id) || null : null);
    } catch (err) {
      setError(producerApplicationErrorMessage(err, 'Satıcı başvuruları yüklenemedi.'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase('tr-TR');
    return applications.filter(app => {
      if (statusFilter !== 'all' && app.status !== statusFilter) return false;
      if (!q) return true;
      return `${app.brand_name} ${app.public_name || ''} ${app.legal_name || ''} ${app.email} ${app.production_location || ''} ${app.planned_products.join(' ')}`.toLocaleLowerCase('tr-TR').includes(q);
    });
  }, [applications, searchTerm, statusFilter]);

  const openDetail = (app: AdminProducerApplication) => {
    setSelected(app);
    setSensitive(null);
    setSensitivePurpose('');
    setError('');
  };

  const openReview = (action: ReviewAction) => {
    setReviewAction(action);
    setReviewReason('');
    setError('');
  };

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !reviewAction || busy) return;
    setBusy(selected.id);
    setError('');
    try {
      await adminReviewProducerApplication({
        applicationId: selected.id,
        status: reviewAction,
        reason: reviewReason,
        commissionPercent,
      });
      showToast(reviewAction === 'approved' ? 'Satıcı başvurusu onaylandı ve üretici hesabı oluşturuldu.' : reviewAction === 'rejected' ? 'Başvuru reddedildi.' : reviewAction === 'needs_information' ? 'Başvuru sahibinden ek bilgi istendi.' : 'Başvuru incelemeye alındı.');
      setReviewAction(null);
      await load(true);
    } catch (err) {
      setError(producerApplicationErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const updateDocument = async (document: ProducerApplicationDocument, status: 'pending' | 'verified' | 'rejected') => {
    if (busy) return;
    setBusy(document.id);
    setError('');
    try {
      await adminSetProducerDocumentStatus(document.id, status);
      showToast(`Belge durumu ${documentStatusLabel(status).toLocaleLowerCase('tr-TR')} olarak güncellendi.`);
      await load(true);
    } catch (err) {
      setError(producerApplicationErrorMessage(err, 'Belge durumu güncellenemedi.'));
    } finally {
      setBusy('');
    }
  };

  const previewDocument = async (document: ProducerApplicationDocument) => {
    if (busy) return;
    setBusy(document.id);
    setError('');
    try {
      const url = await createProducerDocumentPreviewUrl(document.storage_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(producerApplicationErrorMessage(err, 'Belge önizlemesi açılamadı.'));
    } finally {
      setBusy('');
    }
  };

  const unlockSensitive = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || sensitiveLoading) return;
    setSensitiveLoading(true);
    setError('');
    try {
      setSensitive(await adminGetProducerApplicationSensitive(selected.id, sensitivePurpose));
    } catch (err) {
      setError(producerApplicationErrorMessage(err, 'Hassas başvuru bilgileri açılamadı.'));
    } finally {
      setSensitiveLoading(false);
    }
  };

  const canReview = selected && !['approved', 'rejected', 'withdrawn'].includes(selected.status);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Satıcı Başvuruları</h2><p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Köy üreticisi başvuruları gerçek Supabase KYC, belge, izlenebilirlik ve organik iddia kurallarıyla incelenir. Sertifikası doğrulanmamış ürün veya mağazaya organik sertifika statüsü verilmez.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Yenile</button>
      </header>

      {error && !selected && !reviewAction && <div role="alert" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

      <div className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:grid-cols-[minmax(0,1fr)_220px]">
        <label className="relative"><span className="sr-only">Başvuru ara</span><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" /><input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Mağaza, kişi, e-posta, köy veya ürün ara..." className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
        <label><span className="sr-only">Başvuru durumu</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="all">Tüm başvurular</option><option value="submitted">Gönderilenler</option><option value="under_review">İncelenenler</option><option value="needs_information">Ek bilgi bekleyen</option><option value="approved">Onaylananlar</option><option value="rejected">Reddedilenler</option><option value="withdrawn">Geri çekilenler</option></select></label>
      </div>

      {loading ? <div role="status" aria-live="polite" className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Başvurular yükleniyor...</div> : <div className="grid gap-4 xl:grid-cols-2">
        {filtered.map(app => <article key={app.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green"><Store className="h-6 w-6" aria-hidden="true" /></div><div className="min-w-0"><h3 className="truncate font-bold text-gray-900 dark:text-white">{app.brand_name}</h3><p className="mt-1 truncate text-sm text-gray-500">{app.legal_name || app.public_name || 'Başvuru sahibi'} · {app.email}</p></div></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(app.status)}`}>{statusLabel(app.status)}</span></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60"><div className="text-xs text-gray-500">Üretim yeri</div><div className="mt-1 flex items-start gap-1.5 text-gray-800 dark:text-gray-200"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {app.production_location || 'Belirtilmemiş'}</div></div><div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60"><div className="text-xs text-gray-500">Organik iddia</div><div className="mt-1 font-medium text-gray-800 dark:text-gray-200">{app.organic_claim_status || 'Belirtilmemiş'}{app.organic_certifier_name ? ` · ${app.organic_certifier_name}` : ''}</div></div></div><div className="mt-3 flex flex-wrap gap-2 text-xs">{app.village_product_commitment && <span className="rounded-full bg-green-50 px-2.5 py-1 font-medium text-green-800 dark:bg-green-950/30 dark:text-green-200">Köy ürünü taahhüdü</span>}{app.traceability_commitment && <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">İzlenebilirlik</span>}{app.product_truth_commitment && <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Ürün doğruluğu</span>}<span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-700 dark:text-gray-200">{app.documents.length} belge</span></div><div className="mt-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-700"><div className="text-xs text-gray-500">Gönderim: {formatDate(app.submitted_at || app.created_at)}</div><button type="button" onClick={() => openDetail(app)} className="min-h-11 rounded-xl bg-brand-green px-4 py-2 font-semibold text-white hover:bg-green-700"><Eye className="mr-2 inline h-4 w-4" aria-hidden="true" /> İncele</button></div></article>)}
        {filtered.length === 0 && <div className="xl:col-span-2 rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800">Filtrelerle eşleşen başvuru yok.</div>}
      </div>}

      {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) closeDetail(); }}><section ref={detailDialogRef} role="dialog" aria-modal="true" aria-labelledby="application-title" aria-describedby="application-description" tabIndex={-1} className="max-h-[96dvh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl outline-none dark:bg-gray-800 sm:rounded-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h3 id="application-title" className="text-xl font-bold text-gray-900 dark:text-white">{selected.brand_name}</h3><p id="application-description" className="mt-1 text-sm text-gray-500">{selected.legal_name || selected.public_name || selected.email}</p></div><button type="button" onClick={closeDetail} disabled={Boolean(busy) || sensitiveLoading || Boolean(reviewAction)} className="min-h-11 min-w-11 rounded-xl p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-700" aria-label="Başvuru detayını kapat"><X className="mx-auto h-5 w-5" aria-hidden="true" /></button></div>

        {error && !reviewAction && <div role="alert" aria-live="assertive" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

        <div className="mt-6 grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-gray-100 p-4 dark:border-gray-700"><h4 className="font-bold text-gray-900 dark:text-white">Başvuru özeti</h4><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-gray-500">Başvuru türü</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.applicant_type} · {selected.seller_classification || 'sınıflandırılmamış'}</dd></div><div><dt className="text-xs text-gray-500">İletişim</dt><dd className="mt-1 break-all text-gray-900 dark:text-white">{selected.email} · {selected.phone || 'telefon yok'}</dd></div><div><dt className="text-xs text-gray-500">Doğrulamalar</dt><dd className="mt-1 flex flex-wrap gap-2"><span className={`rounded-full px-2 py-1 text-xs ${selected.contact_email_verified_at ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>E-posta {selected.contact_email_verified_at ? 'doğrulandı' : 'doğrulanmadı'}</span><span className={`rounded-full px-2 py-1 text-xs ${selected.phone_verified_at ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>Telefon {selected.phone_verified_at ? 'doğrulandı' : 'doğrulanmadı'}</span></dd></div><div><dt className="text-xs text-gray-500">Üretim yeri</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.production_location || 'Belirtilmemiş'}</dd></div><div><dt className="text-xs text-gray-500">Planlanan ürünler</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.planned_products.length ? selected.planned_products.join(', ') : 'Belirtilmemiş'}</dd></div><div><dt className="text-xs text-gray-500">Üretim uygulamaları</dt><dd className="mt-1 whitespace-pre-wrap text-gray-900 dark:text-white">{selected.production_practice_notes || 'Not girilmemiş'}</dd></div></dl></section>

          <section className="rounded-2xl border border-gray-100 p-4 dark:border-gray-700"><h4 className="font-bold text-gray-900 dark:text-white">Maskelenmiş KYC</h4><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-gray-500">Kimlik / vergi</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.identifier_masked || 'Yok'}</dd></div><div><dt className="text-xs text-gray-500">IBAN</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.iban_masked || 'Yok'}</dd></div><div><dt className="text-xs text-gray-500">MERSİS</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.mersis_masked || 'Yok'}</dd></div><div><dt className="text-xs text-gray-500">Gıda kayıt</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.food_registration_masked || 'Yok'}</dd></div><div><dt className="text-xs text-gray-500">Organik iddia</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.organic_claim_status || 'Yok'}{selected.organic_certifier_name ? ` · ${selected.organic_certifier_name}` : ''}{selected.organic_certificate_expires_on ? ` · ${selected.organic_certificate_expires_on}` : ''}</dd></div></dl></section>
        </div>

        <section className="mt-4 rounded-2xl border border-gray-100 p-4 dark:border-gray-700"><div className="flex items-center justify-between gap-3"><div><h4 className="font-bold text-gray-900 dark:text-white">Belgeler</h4><p className="mt-1 text-xs text-gray-500">Önizlemeler 5 dakikalık özel bağlantıyla açılır. Onay için zorunlu belgelerin doğrulanmış olması gerekir.</p></div><FileSearch className="h-5 w-5 text-gray-400" aria-hidden="true" /></div><div className="mt-4 space-y-2">{selected.documents.map(document => <div key={document.id} className="flex flex-col gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium text-gray-900 dark:text-white">{document.document_type}</span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${documentStatusClass(document.verification_status)}`}>{documentStatusLabel(document.verification_status)}</span></div><p className="mt-1 truncate text-xs text-gray-500">{document.mime_type || 'dosya'} · {document.size_bytes ? `${Math.ceil(document.size_bytes / 1024)} KB` : 'boyut bilinmiyor'}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => void previewDocument(document)} aria-label={`${document.document_type} belgesini önizle`} className="min-h-11 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">Önizle</button><button type="button" disabled={Boolean(busy) || document.verification_status === 'verified'} onClick={() => void updateDocument(document, 'verified')} aria-label={`${document.document_type} belgesini doğrula`} className="min-h-11 rounded-lg border border-green-200 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-40 dark:border-green-900/50 dark:text-green-300">Doğrula</button><button type="button" disabled={Boolean(busy) || document.verification_status === 'rejected'} onClick={() => void updateDocument(document, 'rejected')} aria-label={`${document.document_type} belgesini reddet`} className="min-h-11 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40 dark:border-red-900/50 dark:text-red-300">Reddet</button></div></div>)}{selected.documents.length === 0 && <p className="py-4 text-center text-sm text-gray-500">Başvuruya yüklenmiş belge yok.</p>}</div></section>

        <section className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" /><div className="flex-1"><h4 className="font-bold text-amber-950 dark:text-amber-100">Hassas KYC erişimi</h4><p id="sensitive-purpose-help" className="mt-1 text-xs text-amber-800 dark:text-amber-200">Tam kimlik, vergi, IBAN ve sertifika numaraları varsayılan olarak gizlidir. Açmak için denetim kaydına yazılacak erişim amacını belirtin.</p>{!sensitive ? <form onSubmit={unlockSensitive} className="mt-3 flex flex-col gap-2 sm:flex-row"><label htmlFor="sensitive-purpose" className="sr-only">Hassas KYC erişim amacı</label><input id="sensitive-purpose" required minLength={10} maxLength={200} aria-describedby="sensitive-purpose-help" value={sensitivePurpose} onChange={event => setSensitivePurpose(event.target.value)} placeholder="Örn. Satıcı KYC belge doğrulaması için..." className="min-h-11 flex-1 rounded-xl border border-amber-200 bg-white px-3 outline-none focus:ring-2 focus:ring-amber-500 dark:border-amber-900 dark:bg-gray-900 dark:text-white" /><button type="submit" disabled={sensitiveLoading || sensitivePurpose.trim().length < 10} className="min-h-11 rounded-xl bg-amber-700 px-4 font-semibold text-white disabled:opacity-50">{sensitiveLoading ? 'Açılıyor...' : 'Hassas bilgileri aç'}</button></form> : <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-amber-700 dark:text-amber-300">Kimlik</dt><dd className="break-all font-medium">{sensitive.national_id || 'Yok'}</dd></div><div><dt className="text-xs text-amber-700 dark:text-amber-300">Vergi no</dt><dd className="break-all font-medium">{sensitive.tax_number || 'Yok'}</dd></div><div><dt className="text-xs text-amber-700 dark:text-amber-300">IBAN</dt><dd className="break-all font-medium">{sensitive.iban || 'Yok'}</dd></div><div><dt className="text-xs text-amber-700 dark:text-amber-300">Hesap sahibi</dt><dd className="font-medium">{sensitive.bank_account_holder || 'Yok'}</dd></div><div><dt className="text-xs text-amber-700 dark:text-amber-300">Gıda kayıt no</dt><dd className="break-all font-medium">{sensitive.food_registration_number || 'Yok'}</dd></div><div><dt className="text-xs text-amber-700 dark:text-amber-300">Organik sertifika no</dt><dd className="break-all font-medium">{sensitive.organic_certificate_number || 'Yok'}</dd></div><div className="sm:col-span-2"><button type="button" onClick={() => { setSensitive(null); setSensitivePurpose(''); }} className="min-h-11 w-full rounded-xl border border-amber-300 px-3 font-medium text-amber-900 dark:text-amber-100">Hassas bilgileri kapat</button></div></dl>}</div></div></section>

        {canReview && <div className="mt-5 grid gap-2 sm:grid-cols-4"><button type="button" onClick={() => openReview('under_review')} className="min-h-11 rounded-xl border border-blue-200 px-3 font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-300">İncelemeye al</button><button type="button" onClick={() => openReview('needs_information')} className="min-h-11 rounded-xl border border-orange-200 px-3 font-semibold text-orange-700 hover:bg-orange-50 dark:border-orange-900/50 dark:text-orange-300">Ek bilgi iste</button><button type="button" onClick={() => openReview('rejected')} className="min-h-11 rounded-xl border border-red-200 px-3 font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300"><XCircle className="mr-1 inline h-4 w-4" aria-hidden="true" /> Reddet</button><button type="button" onClick={() => openReview('approved')} className="min-h-11 rounded-xl bg-brand-green px-3 font-semibold text-white hover:bg-green-700"><CheckCircle className="mr-1 inline h-4 w-4" aria-hidden="true" /> Onayla</button></div>}
      </section></div>}

      {reviewAction && selected && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4"><section ref={reviewDialogRef} role="dialog" aria-modal="true" aria-labelledby="review-title" aria-describedby="review-description" tabIndex={-1} className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl outline-none dark:bg-gray-800 sm:rounded-2xl"><h3 id="review-title" className="text-lg font-bold text-gray-900 dark:text-white">{reviewAction === 'approved' ? 'Satıcıyı onayla' : reviewAction === 'rejected' ? 'Başvuruyu reddet' : reviewAction === 'needs_information' ? 'Ek bilgi iste' : 'İncelemeye al'}</h3><p id="review-description" className="mt-1 text-sm text-gray-500">{selected.brand_name} · Sunucu tarafındaki tüm KYC ve belge koşulları yeniden kontrol edilir.</p>{error && <div role="alert" aria-live="assertive" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}<form onSubmit={submitReview} className="mt-4 space-y-4"><label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Platform komisyonu (%)</span><input type="number" min="0" max="30" step="0.01" value={commissionPercent} onChange={event => setCommissionPercent(Number(event.target.value))} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /><span className="mt-1 block text-xs text-gray-500">Backend'e basis point olarak kaydedilir. Örn. %10 = 1000.</span></label><label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Gerekçe / inceleme notu {reviewAction === 'rejected' || reviewAction === 'needs_information' ? '(zorunlu)' : '(isteğe bağlı)'}</span><textarea required={reviewAction === 'rejected' || reviewAction === 'needs_information'} minLength={reviewAction === 'rejected' || reviewAction === 'needs_information' ? 10 : undefined} maxLength={1000} rows={4} value={reviewReason} onChange={event => setReviewReason(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label><div className="flex gap-3"><button type="button" disabled={Boolean(busy)} onClick={closeReview} className="min-h-11 flex-1 rounded-xl px-4 text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-700">İptal</button><button type="submit" disabled={Boolean(busy)} className={`min-h-11 flex-1 rounded-xl px-4 font-semibold text-white disabled:opacity-50 ${reviewAction === 'rejected' ? 'bg-red-700 hover:bg-red-800' : 'bg-brand-green hover:bg-green-700'}`}>{busy ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> İşleniyor</span> : 'Onayla'}</button></div></form></section></div>}

      {toast && <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-2xl"><Check className="h-5 w-5 text-green-400" aria-hidden="true" /> {toast}</div>}
    </div>
  );
}

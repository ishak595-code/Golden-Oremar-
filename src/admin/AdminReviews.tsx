import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Check, CheckCircle, EyeOff, Loader2, RefreshCw, Search, Star, XCircle } from 'lucide-react';
import { adminErrorMessage, adminListReviews, adminModerateReview, type AdminReview } from './supabaseAdminApi';

type ReviewFilter = 'all' | AdminReview['status'];
type ModerationAction = 'published' | 'rejected' | 'hidden';

function statusLabel(status: AdminReview['status']) {
  return ({ pending: 'Onay bekliyor', published: 'Yayında', rejected: 'Reddedildi', hidden: 'Gizli', withdrawn: 'Geri çekildi' } as const)[status];
}

function statusClass(status: AdminReview['status']) {
  if (status === 'published') return 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200';
  if (status === 'rejected') return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200';
  if (status === 'hidden') return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
  if (status === 'withdrawn') return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200';
}

export function AdminReviews() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [moderatingId, setModeratingId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<ReviewFilter>('all');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [reasonDialog, setReasonDialog] = useState<{ review: AdminReview; action: Exclude<ModerationAction, 'published'> } | null>(null);
  const [reason, setReason] = useState('');

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      setReviews(await adminListReviews());
    } catch (err) {
      setError(adminErrorMessage(err, 'Yorumlar yüklenemedi.'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredReviews = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('tr-TR');
    return reviews.filter(review => {
      const matchesStatus = filterStatus === 'all' || review.status === filterStatus;
      if (!matchesStatus) return false;
      if (!query) return true;
      return `${review.product_name} ${review.user_name} ${review.title || ''} ${review.comment}`.toLocaleLowerCase('tr-TR').includes(query);
    });
  }, [reviews, searchTerm, filterStatus]);

  const moderate = async (review: AdminReview, action: ModerationAction, moderationReason?: string) => {
    if (moderatingId) return;
    setModeratingId(review.id);
    setError('');
    try {
      await adminModerateReview(review.id, action, moderationReason || null);
      await load(true);
      showToast(action === 'published' ? 'Yorum yayınlandı.' : action === 'hidden' ? 'Yorum gizlendi.' : 'Yorum reddedildi.');
    } catch (err) {
      setError(adminErrorMessage(err, 'Yorum durumu güncellenemedi.'));
    } finally {
      setModeratingId('');
    }
  };

  const openReasonDialog = (review: AdminReview, action: Exclude<ModerationAction, 'published'>) => {
    setReason('');
    setReasonDialog({ review, action });
  };

  const submitReason = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reasonDialog) return;
    const current = reasonDialog;
    setReasonDialog(null);
    await moderate(current.review, current.action, reason.trim());
  };

  const actionButtons = (review: AdminReview) => (
    <div className="flex items-center justify-end gap-1">
      {review.status !== 'published' && review.status !== 'withdrawn' && <button type="button" disabled={Boolean(moderatingId)} onClick={() => void moderate(review, 'published')} className="min-h-11 min-w-11 rounded-lg p-2 text-green-700 hover:bg-green-50 disabled:opacity-50 dark:text-green-300 dark:hover:bg-green-950/30" aria-label={`${review.product_name} yorumunu yayınla`}><CheckCircle className="mx-auto h-5 w-5" aria-hidden="true" /></button>}
      {review.status !== 'rejected' && review.status !== 'withdrawn' && <button type="button" disabled={Boolean(moderatingId)} onClick={() => openReasonDialog(review, 'rejected')} className="min-h-11 min-w-11 rounded-lg p-2 text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/30" aria-label={`${review.product_name} yorumunu reddet`}><XCircle className="mx-auto h-5 w-5" aria-hidden="true" /></button>}
      {review.status === 'published' && <button type="button" disabled={Boolean(moderatingId)} onClick={() => openReasonDialog(review, 'hidden')} className="min-h-11 min-w-11 rounded-lg p-2 text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700" aria-label={`${review.product_name} yorumunu gizle`}><EyeOff className="mx-auto h-5 w-5" aria-hidden="true" /></button>}
      {moderatingId === review.id && <Loader2 className="h-5 w-5 animate-spin text-gray-500" aria-label="İşleniyor" />}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Yorum Moderasyonu</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Yorumlar ve doğrulanmış satın alma bilgisi doğrudan Supabase yönetici sözleşmesinden gelir.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 flex items-center justify-center gap-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Yenile</button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-md"><span className="sr-only">Ürün, kullanıcı veya yorum ara</span><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" /><input type="search" placeholder="Ürün, kullanıcı veya yorum ara..." value={searchTerm} onChange={event => setSearchTerm(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-gray-900 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
          <label><span className="sr-only">Yorum durumuna göre filtrele</span><select value={filterStatus} onChange={event => setFilterStatus(event.target.value as ReviewFilter)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white sm:w-auto"><option value="all">Tüm durumlar</option><option value="pending">Onay bekleyen</option><option value="published">Yayında</option><option value="rejected">Reddedildi</option><option value="hidden">Gizli</option><option value="withdrawn">Geri çekildi</option></select></label>
        </div>

        {loading ? <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Yorumlar yükleniyor...</div> : <>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 md:hidden">
            {filteredReviews.map(review => <article key={review.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold text-gray-900 dark:text-white">{review.product_name}</h3><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500"><span>{review.user_name}</span>{review.is_verified_purchase && <span className="inline-flex items-center gap-1 font-medium text-green-700 dark:text-green-300"><BadgeCheck className="h-4 w-4" aria-hidden="true" /> Doğrulanmış alışveriş</span>}</div></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(review.status)}`}>{statusLabel(review.status)}</span></div><div className="mt-3 flex items-center gap-1" aria-label={`${review.rating} / 5 puan`}>{Array.from({ length: 5 }).map((_, index) => <Star key={index} className={`h-4 w-4 ${index < review.rating ? 'fill-current text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`} aria-hidden="true" />)}</div>{review.title && <h4 className="mt-3 text-sm font-semibold text-gray-800 dark:text-gray-100">{review.title}</h4>}<p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{review.comment}</p><div className="mt-3 flex items-center justify-between gap-3"><time className="text-xs text-gray-500" dateTime={review.created_at}>{new Date(review.created_at).toLocaleString('tr-TR')}</time>{actionButtons(review)}</div></article>)}
          </div>

          <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm text-gray-600 dark:text-gray-300"><thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 dark:bg-gray-900/50"><tr><th className="px-6 py-4">Kullanıcı</th><th className="px-6 py-4">Ürün</th><th className="px-6 py-4">Puan</th><th className="px-6 py-4">Yorum</th><th className="px-6 py-4">Durum</th><th className="px-6 py-4 text-right">İşlem</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{filteredReviews.map(review => <tr key={review.id} className="align-top hover:bg-gray-50 dark:hover:bg-gray-700/40"><td className="px-6 py-4"><div className="font-medium text-gray-900 dark:text-white">{review.user_name}</div>{review.is_verified_purchase && <div className="mt-1 flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300"><BadgeCheck className="h-4 w-4" aria-hidden="true" /> Doğrulanmış</div>}</td><td className="px-6 py-4">{review.product_name}</td><td className="px-6 py-4"><div className="flex items-center gap-1" aria-label={`${review.rating} / 5 puan`}>{Array.from({ length: 5 }).map((_, index) => <Star key={index} className={`h-4 w-4 ${index < review.rating ? 'fill-current text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`} aria-hidden="true" />)}</div></td><td className="max-w-md px-6 py-4"><div className="line-clamp-3" title={review.comment}>{review.comment}</div><div className="mt-1 text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString('tr-TR')}</div></td><td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(review.status)}`}>{statusLabel(review.status)}</span></td><td className="px-6 py-4 text-right">{actionButtons(review)}</td></tr>)}</tbody></table></div>

          {filteredReviews.length === 0 && <div className="p-8 text-center text-gray-500">Bu filtrelerle eşleşen yorum yok.</div>}
        </>}
      </div>

      {reasonDialog && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) setReasonDialog(null); }}><section role="dialog" aria-modal="true" aria-labelledby="moderation-title" className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:rounded-2xl"><h3 id="moderation-title" className="text-lg font-bold text-gray-900 dark:text-white">{reasonDialog.action === 'rejected' ? 'Yorumu reddet' : 'Yorumu gizle'}</h3><p className="mt-1 text-sm text-gray-500">Moderasyon gerekçesi denetim kaydına eklenir. Kişisel veya gereksiz hassas bilgi yazmayın.</p><form onSubmit={submitReason} className="mt-4 space-y-4"><label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Gerekçe</span><textarea autoFocus required minLength={3} maxLength={1000} rows={4} value={reason} onChange={event => setReason(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label><div className="flex gap-3"><button type="button" onClick={() => setReasonDialog(null)} className="min-h-11 flex-1 rounded-xl px-4 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">İptal</button><button type="submit" className={`min-h-11 flex-1 rounded-xl px-4 py-2 font-semibold text-white ${reasonDialog.action === 'rejected' ? 'bg-red-700 hover:bg-red-800' : 'bg-gray-800 hover:bg-gray-900 dark:bg-gray-600 dark:hover:bg-gray-500'}`}>Onayla</button></div></form></section></div>}

      {toast && <div role="status" className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-2xl"><Check className="h-5 w-5 text-green-400" aria-hidden="true" /><span className="font-medium">{toast}</span></div>}
    </div>
  );
}

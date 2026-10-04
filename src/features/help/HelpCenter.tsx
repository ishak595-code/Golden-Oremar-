import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight, FileText, HelpCircle, Info, Mail, MessageCircle, MessageSquareHeart, Scale, Shield, Undo2 } from 'lucide-react';
import FaqPanel from '../account/FaqPanel';
import { getAccountHelpContent } from '../account/api';
import type { AccountHelpContent, AccountHelpDocument } from '../account/types';
import SafePublishedBody from '../content/SafePublishedBody';
import { getPublicContactConfig, submitContactForm } from '../engagement/api';
import { NETWORK_RESTORED_EVENT } from '../resilience/useConnectivity';
import { showAppToast } from '../../lib/appToast';
import { userFacingError } from '../../lib/userFacingError';

/**
 * Yardım merkezi: Yardım ve destek, Sık sorulan sorular, Geri bildirim,
 * Gizlilik ve Politikalar ve yasal bilgiler. Each screen has its own address
 * (?tab=account&view=help, help:faq, help:feedback, help:legal,
 * help:legal:<belge>), so the browser and Android back buttons step back one
 * screen. Signed-in or not, the same screens open: help must never sit
 * behind a login.
 */

export const LEGAL_KEYS = ['terms', 'privacy', 'returns', 'about'] as const;
export type LegalKey = (typeof LEGAL_KEYS)[number];
export const HELP_VIEWS = ['help', 'help:faq', 'help:feedback', 'help:legal', ...LEGAL_KEYS.map(key => `help:legal:${key}`)] as const;

const LEGAL_META: Record<LegalKey, { label: string; description: string; Icon: typeof Info }> = {
  terms: { label: 'Kullanım ve satış koşulları', description: 'Pazaryeri kuralları, sipariş, ödeme ve teslimat', Icon: FileText },
  privacy: { label: 'Gizlilik ve KVKK', description: 'Hangi veriler, neden ve ne kadar süre işlenir', Icon: Shield },
  returns: { label: 'İade ve cayma', description: '14 gün cayma hakkı, istisnalar ve sorunlu ürün', Icon: Undo2 },
  about: { label: 'Golden Oremar hakkında', description: 'Yaklaşımımız ve iletişim bilgileri', Icon: Info },
};

const TOPICS = ['Öneri', 'Sorun bildir', 'Teşekkür', 'Diğer'] as const;
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold';

type HelpUser = { email?: string | null; name?: string | null; displayName?: string | null } | null | undefined;

function titleFor(view: string, docs: AccountHelpContent | null) {
  if (view === 'help:faq') return 'Sık sorulan sorular';
  if (view === 'help:feedback') return 'Geri bildirim';
  if (view === 'help:legal') return 'Politikalar ve yasal bilgiler';
  if (view.startsWith('help:legal:')) {
    const key = view.slice('help:legal:'.length) as LegalKey;
    return docs?.[key]?.title || LEGAL_META[key]?.label || 'Yasal bilgi';
  }
  return 'Yardım ve destek';
}

function parentOf(view: string) {
  if (view.startsWith('help:legal:')) return 'help:legal';
  if (view.startsWith('help:')) return 'help';
  return null;
}

function hasBody(doc: AccountHelpDocument | null | undefined): doc is AccountHelpDocument {
  return Boolean(doc && (doc.markdown.trim() || doc.sanitizedHtml.trim()));
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try { return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeZone: 'Europe/Istanbul' }).format(date); } catch { return ''; }
}

function Row({ icon: Icon, label, description, onClick, badge }: { icon: typeof Info; label: string; description: string; onClick: () => void; badge?: string }) {
  return <button type="button" onClick={onClick} className={`flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-gold/5 active:bg-brand-gold/10 ${focus}`}>
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-green/10 text-brand-green dark:text-brand-gold"><Icon className="h-5 w-5" aria-hidden="true" /></span>
    <span className="min-w-0 flex-1"><span className="block font-bold text-brand-text">{label}</span><span className="mt-0.5 block text-sm text-brand-muted">{description}</span></span>
    {badge ? <span className="shrink-0 rounded-full bg-brand-gold/15 px-2 py-0.5 text-xs font-bold text-brand-text">{badge}</span> : null}
    <ChevronRight className="h-5 w-5 shrink-0 text-brand-muted" aria-hidden="true" />
  </button>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return <section aria-label={title}>
    <h2 className="mb-2 px-1 text-xs font-black uppercase tracking-wider text-brand-muted">{title}</h2>
    <div className="overflow-hidden rounded-2xl border-2 border-brand-border bg-brand-card shadow-sm">
      {items.map((child, index) => <div key={index} className={index ? 'border-t border-brand-border' : ''}>{child}</div>)}
    </div>
  </section>;
}

function FeedbackForm({ currentUser, contactEmail }: { currentUser: HelpUser; contactEmail: string }) {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>('Öneri');
  const [message, setMessage] = useState('');
  const [name, setName] = useState(currentUser?.name || currentUser?.displayName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const successRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (sent) successRef.current?.focus(); }, [sent]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const text = message.trim();
    if (text.length < 10) { setError('Mesajınız en az 10 karakter olmalı.'); return; }
    if (name.trim().length < 2) { setError('Adınızı yazın.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Geçerli bir e-posta adresi yazın.'); return; }
    setBusy(true);
    setError('');
    try {
      await submitContactForm({ name: name.trim(), email: email.trim(), subject: `Geri bildirim: ${topic}`, message: text, locale: 'tr', website, source: 'app-feedback' });
      setSent(true);
      showAppToast('Geri bildiriminiz gönderildi');
    } catch (e) {
      setError(userFacingError(e, 'Geri bildiriminiz şu anda gönderilemedi.'));
    } finally {
      setBusy(false);
    }
  }

  if (sent) return <div ref={successRef} tabIndex={-1} role="status" style={{ outline: "none" }} className="rounded-2xl border-2 border-brand-border bg-brand-card p-6 text-center shadow-sm outline-none">
    <CheckCircle2 className="mx-auto h-14 w-14 text-brand-green dark:text-brand-gold" aria-hidden="true" />
    <h2 className="mt-3 text-xl font-black text-brand-text">Teşekkürler! Geri bildiriminiz alındı.</h2>
    <p className="mt-2 text-sm leading-6 text-brand-muted">Ekibimiz mesajınızı okuyacak. Yanıt gerekiyorsa {email.trim()} adresine yazacağız.</p>
    <button type="button" onClick={() => { setSent(false); setMessage(''); }} className={`mt-5 min-h-11 rounded-xl border-2 border-brand-border px-5 font-bold text-brand-text ${focus}`}>Yeni geri bildirim</button>
  </div>;

  const count = message.trim().length;
  return <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border-2 border-brand-border bg-brand-card p-4 shadow-sm sm:p-5">
    <p className="text-sm leading-6 text-brand-muted">Uygulamayı birlikte geliştirelim. Öneri, sorun veya teşekkürünüzü yazın; her mesajı okuyoruz.</p>
    <fieldset>
      <legend className="mb-2 text-sm font-bold text-brand-text">Konu</legend>
      <div className="flex flex-wrap gap-2">{TOPICS.map(item => <button key={item} type="button" aria-pressed={topic === item} onClick={() => setTopic(item)} className={`min-h-10 rounded-full border-2 px-4 text-sm font-bold transition-colors ${focus} ${topic === item ? 'border-brand-green bg-brand-green text-brand-on-green' : 'border-brand-border text-brand-text hover:border-brand-gold/40'}`}>{item}</button>)}</div>
    </fieldset>
    <label className="block" htmlFor="feedback-message">
      <span className="flex items-baseline justify-between text-sm font-bold text-brand-text"><span>Mesajınız</span><span className={`text-xs font-semibold ${count > 0 && count < 10 ? 'text-amber-600' : 'text-brand-muted'}`} aria-live="polite">{count}/2000</span></span>
      <textarea id="feedback-message" value={message} maxLength={2000} rows={6} onChange={event => setMessage(event.target.value.slice(0, 2000))} placeholder={topic === 'Sorun bildir' ? 'Ne oldu? Hangi ekranda? Sipariş numarası varsa yazın.' : 'Düşüncelerinizi yazın…'} className="mt-2 w-full rounded-xl border-2 border-brand-border bg-transparent p-3 text-brand-text placeholder:text-brand-muted focus:border-brand-gold focus:outline-none" />
    </label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block" htmlFor="feedback-name"><span className="text-sm font-bold text-brand-text">Adınız</span><input id="feedback-name" value={name} maxLength={120} autoComplete="name" onChange={event => setName(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border-2 border-brand-border bg-transparent px-3 text-brand-text focus:border-brand-gold focus:outline-none" /></label>
      <label className="block" htmlFor="feedback-email"><span className="text-sm font-bold text-brand-text">E-posta</span><input id="feedback-email" type="email" value={email} maxLength={254} autoComplete="email" inputMode="email" onChange={event => setEmail(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border-2 border-brand-border bg-transparent px-3 text-brand-text focus:border-brand-gold focus:outline-none" /></label>
    </div>
    <div aria-hidden="true" className="hidden"><label>Web sitesi<input tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} name="website" /></label></div>
    {error ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">{error}{contactEmail ? <> İsterseniz <a className="font-bold underline" href={`mailto:${contactEmail}`}>{contactEmail}</a> adresine de yazabilirsiniz.</> : null}</div> : null}
    <button type="submit" disabled={busy} aria-busy={busy} className={`min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-brand-on-green shadow-lg transition-all hover:brightness-110 disabled:opacity-60 ${focus}`}>{busy ? 'Gönderiliyor…' : 'Gönder'}</button>
    <p className="text-xs leading-5 text-brand-muted">Mesajınız ve iletişim bilgileriniz yalnız geri bildiriminizi değerlendirmek için kullanılır.</p>
  </form>;
}

export default function HelpCenter({ view, currentUser, locale = 'tr', onNavigate, onExit, onOpenContact, onOpenMessages }: {
  view: string;
  currentUser?: HelpUser;
  locale?: string;
  onNavigate: (view: string) => void;
  onExit: () => void;
  onOpenContact: () => void;
  onOpenMessages?: () => void;
}) {
  const [docs, setDocs] = useState<AccountHelpContent | null>(null);
  const [docsError, setDocsError] = useState('');
  const [docsLoading, setDocsLoading] = useState(true);
  const [contactEmail, setContactEmail] = useState('');
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const helpLocale = /^(tr|en|de|fr|ku|ar)$/.test(locale) ? locale : 'tr';

  async function loadDocs(silent = false) {
    try {
      if (!silent) setDocsLoading(true);
      setDocsError('');
      setDocs(await getAccountHelpContent(helpLocale));
    } catch (e) {
      setDocsError(userFacingError(e, 'Belgeler yüklenemedi.'));
    } finally {
      if (!silent) setDocsLoading(false);
    }
  }
  useEffect(() => { void loadDocs(); }, [helpLocale]);
  useEffect(() => { const restore = () => void loadDocs(true); window.addEventListener(NETWORK_RESTORED_EVENT, restore); return () => window.removeEventListener(NETWORK_RESTORED_EVENT, restore); }, [helpLocale]);
  useEffect(() => { void getPublicContactConfig().then(config => setContactEmail(typeof config?.email === 'string' ? config.email : '')).catch(() => undefined); }, []);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); headingRef.current?.focus({ preventScroll: true }); }, [view]);

  function back() {
    const depth = Number((window.history.state as { goldenOremarDepth?: unknown } | null)?.goldenOremarDepth);
    if (Number.isSafeInteger(depth) && depth > 0) { window.history.back(); return; }
    const parent = parentOf(view);
    if (parent) onNavigate(parent); else onExit();
  }

  const title = titleFor(view, docs);
  const legalKey = view.startsWith('help:legal:') ? view.slice('help:legal:'.length) as LegalKey : null;

  let body: React.ReactNode;
  if (view === 'help:faq') body = <FaqPanel locale={helpLocale} />;
  else if (view === 'help:feedback') body = <FeedbackForm currentUser={currentUser} contactEmail={contactEmail} />;
  else if (view === 'help:legal') body = <Group title="Belgeler">{LEGAL_KEYS.map(key => <Row key={key} icon={LEGAL_META[key].Icon} label={LEGAL_META[key].label} description={LEGAL_META[key].description} onClick={() => onNavigate(`help:legal:${key}`)} />)}</Group>;
  else if (legalKey) {
    const doc = docs?.[legalKey];
    body = docsLoading ? <div role="status" aria-label="Belge yükleniyor" className="space-y-3">{[0, 1, 2].map(index => <div key={index} className="h-20 animate-pulse rounded-2xl bg-brand-card ring-1 ring-brand-border" />)}</div>
      : hasBody(doc) ? <article className="rounded-2xl border-2 border-brand-border bg-brand-card p-5 shadow-sm sm:p-7">
        {formatDate(doc.updatedAt || doc.publishedAt) ? <p className="mb-4 text-xs font-semibold text-brand-muted">Son güncelleme: {formatDate(doc.updatedAt || doc.publishedAt)}</p> : null}
        {doc.summary ? <p className="mb-5 rounded-xl bg-brand-green/5 p-3 text-sm leading-6 text-brand-text/90">{doc.summary}</p> : null}
        <SafePublishedBody source={doc.sanitizedHtml.trim() || doc.markdown} hideLeadingTitle />
      </article>
      : <div role="alert" className="rounded-2xl border-2 border-dashed border-brand-border p-5 text-sm text-brand-muted">{docsError || 'Bu belge henüz yayınlanmadı. Geçici veya uydurma hukuki metin gösterilmiyor.'}<button type="button" onClick={() => void loadDocs()} className={`mt-3 block min-h-11 rounded-xl border-2 border-brand-border px-4 font-bold text-brand-text ${focus}`}>Tekrar dene</button></div>;
  } else body = <div className="space-y-5">
    <div className="rounded-2xl bg-brand-green p-5 text-brand-on-green shadow-lg">
      <HelpCircle className="h-8 w-8 opacity-90" aria-hidden="true" />
      <p className="mt-2 text-lg font-black">Size nasıl yardımcı olabiliriz?</p>
      <p className="mt-1 text-sm opacity-85">Sorunun cevabı çoğu zaman sık sorulan sorularda. Bulamazsanız bize yazın.</p>
    </div>
    <Group title="Destek">
      <Row icon={HelpCircle} label="Sık sorulan sorular" description="Sipariş, kargo, iade, ödeme ve hesap" onClick={() => onNavigate('help:faq')} />
      {onOpenMessages ? <Row icon={MessageCircle} label="Mesajlarım" description="Üreticiye veya destek ekibine yazın" onClick={onOpenMessages} /> : null}
      <Row icon={Mail} label="Bize ulaşın" description="E-posta, telefon ve iletişim formu" onClick={onOpenContact} />
      <Row icon={MessageSquareHeart} label="Geri bildirim" description="Öneri, sorun veya teşekkürünüzü iletin" onClick={() => onNavigate('help:feedback')} />
    </Group>
    <Group title="Gizlilik ve yasal">
      <Row icon={Shield} label="Gizlilik" description="KVKK aydınlatma ve veri işleme" onClick={() => onNavigate('help:legal:privacy')} />
      <Row icon={Scale} label="Politikalar ve yasal bilgiler" description="Koşullar, iade ve cayma, hakkımızda" onClick={() => onNavigate('help:legal')} />
    </Group>
  </div>;

  return <section aria-labelledby="help-title" className="mx-auto max-w-3xl px-4 pb-8 pt-4 sm:px-6">
    <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-2 bg-brand-main/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
      <button type="button" onClick={back} aria-label="Geri" className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-brand-border bg-brand-card text-brand-text transition-colors hover:border-brand-gold/40 ${focus}`}><ArrowLeft className="h-5 w-5" aria-hidden="true" /></button>
      <h1 id="help-title" ref={headingRef} tabIndex={-1} style={{ outline: "none" }} className="line-clamp-2 min-w-0 flex-1 text-lg font-black leading-tight text-brand-text outline-none sm:text-xl">{title}</h1>
    </div>
    {body}
  </section>;
}

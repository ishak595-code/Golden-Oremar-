import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileCheck2, Plus, Trash2 } from 'lucide-react';
import {
  getMyProducerApplicationDraft,
  listOnboardingCategories,
  listProductionLocationSuggestions,
  saveProducerApplicationDraft,
  submitProducerApplication,
  uploadProducerDocuments,
  removeProducerUploadedDocuments,
  type PendingDocument,
} from './api';

const sellerClasses = [
  ['individual_non_merchant', 'Bireysel köy üreticisi'],
  ['tax_exempt_artisan', 'Esnaf vergi muafiyetli üretici'],
  ['artisan', 'Esnaf / zanaatkâr'],
  ['sole_proprietor', 'Şahıs işletmesi'],
  ['company', 'Şirket'],
  ['cooperative', 'Kooperatif'],
] as const;

const sourceModels = [
  ['own_production', 'Kendi üretimim'],
  ['family_production', 'Aile üretimi'],
  ['cooperative_production', 'Kooperatif üretimi'],
  ['partner_farm', 'Anlaşmalı üretici/çiftlik'],
  ['authorized_local_supplier', 'Yetkili yerel tedarikçi'],
] as const;

const documentTypes = [
  ['identity', 'Kimlik belgesi'],
  ['cks', 'ÇKS / birincil üretim belgesi'],
  ['organic_certificate', 'Organik sertifikası'],
  ['business_registration', 'İşletme kayıt belgesi'],
  ['tax_certificate', 'Vergi levhası'],
  ['bank_proof', 'IBAN/banka sahiplik belgesi'],
  ['food_business_registration', 'Gıda işletmesi kayıt belgesi'],
  ['food_business_approval', 'Gıda işletmesi onay belgesi'],
  ['tax_exemption_certificate', 'Esnaf vergi muafiyeti belgesi'],
  ['mersis_record', 'MERSİS kaydı'],
  ['cooperative_registration', 'Kooperatif kayıt belgesi'],
  ['residence_proof', 'Yerleşim/ikamet belgesi'],
  ['other', 'Diğer doğrulama belgesi'],
] as const;

const initialForm = {
  applicationId: null as string | null,
  status: 'draft',
  sellerClassification: 'individual_non_merchant',
  brandName: '', publicName: '', description: '',
  countryCode: 'TR', province: 'Hakkâri', district: 'Yüksekova', village: '', villageIsCustom: false,
  latitude: null as number | null, longitude: null as number | null,
  productCategories: [] as string[],
  legalName: '', identifier: '', taxOffice: '', mersisNumber: '', taxExemptionNumber: '', iban: '', phone: '', contactEmail: '',
  addressLine: '', postalCode: '',
  foodComplianceStatus: 'pending', foodRegistrationNumber: '',
  fulfillmentMethods: ['cargo'] as string[], averageDispatchDays: 2, coldChainCapable: false,
  plannedProducts: [{ name: '', category: '', source_model: 'own_production', unit: 'kg', estimated_quantity: 1 }] as any[],
  organicClaimStatus: 'not_certified_no_claim', organicCertifierName: '', organicCertificateNumber: '', organicCertificateExpiresOn: '',
  villageProductCommitment: false, traceabilityCommitment: false, productTruthCommitment: false,
  productionPracticeNotes: '',
};

function valueFrom(draft: any, ...keys: string[]) {
  for (const key of keys) if (draft?.[key] !== undefined && draft?.[key] !== null) return draft[key];
  return undefined;
}

export default function ProducerApplicationFlow({ currentUser, onBack }: { currentUser: any; onBack?: () => void }) {
  const [form, setForm] = useState(initialForm);
  const [categories, setCategories] = useState<any[]>([]);
  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [draft, categoryRows] = await Promise.all([
          getMyProducerApplicationDraft(),
          listOnboardingCategories(),
        ]);
        if (!active) return;
        setCategories(categoryRows || []);
        if (draft) {
          const location = valueFrom(draft, 'production_location') || {};
          setForm(previous => ({
            ...previous,
            applicationId: valueFrom(draft, 'application_id', 'id') || null,
            status: valueFrom(draft, 'status') || 'draft',
            sellerClassification: valueFrom(draft, 'seller_classification') || previous.sellerClassification,
            brandName: valueFrom(draft, 'brand_name') || '',
            publicName: valueFrom(draft, 'public_name') || '',
            description: valueFrom(draft, 'description') || '',
            countryCode: valueFrom(location, 'country_code') || valueFrom(draft, 'production_country_code') || 'TR',
            province: valueFrom(location, 'province') || valueFrom(draft, 'production_province') || 'Hakkâri',
            district: valueFrom(location, 'district') || valueFrom(draft, 'production_district') || 'Yüksekova',
            village: valueFrom(location, 'village') || valueFrom(draft, 'production_village') || '',
            villageIsCustom: !!(valueFrom(location, 'village_is_custom') ?? valueFrom(draft, 'production_village_is_custom')),
            latitude: valueFrom(location, 'latitude') ?? null,
            longitude: valueFrom(location, 'longitude') ?? null,
            productCategories: valueFrom(draft, 'product_categories') || [],
            legalName: valueFrom(draft, 'legal_name') || '',
            identifier: valueFrom(draft, 'identifier') || '',
            taxOffice: valueFrom(draft, 'tax_office') || '',
            mersisNumber: valueFrom(draft, 'mersis_number') || '',
            taxExemptionNumber: valueFrom(draft, 'tax_exemption_number') || '',
            iban: valueFrom(draft, 'iban') || '', phone: valueFrom(draft, 'phone') || '',
            contactEmail: valueFrom(draft, 'contact_email') || currentUser?.email || '',
            foodComplianceStatus: valueFrom(draft, 'food_compliance_status') || 'pending',
            foodRegistrationNumber: valueFrom(draft, 'food_registration_number') || '',
            fulfillmentMethods: valueFrom(draft, 'fulfillment_methods') || ['cargo'],
            averageDispatchDays: Number(valueFrom(draft, 'average_dispatch_days') || 2),
            coldChainCapable: !!valueFrom(draft, 'cold_chain_capable'),
            plannedProducts: valueFrom(draft, 'planned_products')?.length ? valueFrom(draft, 'planned_products') : previous.plannedProducts,
            organicClaimStatus: valueFrom(draft, 'organic_claim_status') || previous.organicClaimStatus,
            organicCertifierName: valueFrom(draft, 'organic_certifier_name') || '',
            organicCertificateNumber: valueFrom(draft, 'organic_certificate_number') || '',
            organicCertificateExpiresOn: valueFrom(draft, 'organic_certificate_expires_on') || '',
            villageProductCommitment: !!valueFrom(draft, 'village_product_commitment'),
            traceabilityCommitment: !!valueFrom(draft, 'traceability_commitment'),
            productTruthCommitment: !!valueFrom(draft, 'product_truth_commitment'),
            productionPracticeNotes: valueFrom(draft, 'production_practice_notes') || '',
          }));
        } else {
          setForm(previous => ({ ...previous, contactEmail: currentUser?.email || '' }));
        }
      } catch (err: any) {
        setError(err?.message || 'Satıcı başvurusu yüklenemedi.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [currentUser?.email]);

  useEffect(() => {
    let active = true;
    if (form.province.trim().length < 2 || form.district.trim().length < 2) {
      setLocationSuggestions([]);
      return () => { active = false; };
    }
    const timer = window.setTimeout(() => {
      listProductionLocationSuggestions(form.countryCode, form.province, form.district)
        .then(rows => { if (active) setLocationSuggestions(rows || []); })
        .catch(() => { if (active) setLocationSuggestions([]); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [form.countryCode, form.province, form.district]);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const businessClass = ['artisan', 'sole_proprietor', 'company', 'cooperative'].includes(form.sellerClassification);
  const sourceModelsSelected = useMemo(() => Array.from(new Set(form.plannedProducts.map(item => item.source_model).filter(Boolean))), [form.plannedProducts]);

  function validateStep(index: number) {
    if (index === 0) {
      if (form.publicName.trim().length < 2) return 'Kamuya gösterilecek üretici adını yazın.';
      if (form.description.trim().length < 40) return 'Üretiminizi ve köy ürünlerinizi en az 40 karakterle açıklayın.';
    }
    if (index === 1) {
      if (form.countryCode.length !== 2 || form.province.trim().length < 2 || form.district.trim().length < 2 || form.village.trim().length < 2) return 'Ülke, il, ilçe ve köy bilgilerini eksiksiz yazın.';
      if (!form.productCategories.length) return 'En az bir ürün kategorisi seçin.';
    }
    if (index === 2) {
      if (!form.plannedProducts.length) return 'En az bir ürün planı ekleyin.';
      for (const item of form.plannedProducts) {
        if (item.name.trim().length < 2 || item.category.trim().length < 2 || !item.source_model || item.unit.trim().length < 1 || Number(item.estimated_quantity) <= 0) return 'Planlanan ürünlerin adı, kategorisi, kaynağı, birimi ve tahmini miktarı eksiksiz olmalıdır.';
      }
    }
    if (index === 3) {
      if (form.legalName.trim().length < 2) return 'Yasal ad/unvan bilgisini yazın.';
      if (businessClass && !/^\d{10}$/.test(form.identifier.replace(/\D/g, ''))) return 'İşletme için 10 haneli vergi numarası gerekir.';
      if (!businessClass && !/^\d{11}$/.test(form.identifier.replace(/\D/g, ''))) return 'Bireysel üretici için 11 haneli T.C. kimlik numarası gerekir.';
      if (businessClass && form.taxOffice.trim().length < 2) return 'İşletme için vergi dairesini yazın.';
      if (!/^TR\d{24}$/.test(form.iban.replace(/\s/g, ''))) return 'IBAN TR ile başlamalı ve toplam 26 karakter olmalıdır.';
      if (form.phone.replace(/\D/g, '').length < 10) return 'Geçerli telefon numarası yazın.';
      if (form.contactEmail.trim().toLowerCase() !== String(currentUser?.email || '').trim().toLowerCase()) return 'Başvuru e-postası giriş yaptığınız hesap e-postasıyla aynı olmalıdır.';
      if (!currentUser?.emailVerified) return 'Satıcı başvurusu için hesap e-postanızı önce doğrulayın.';
      if (form.addressLine.trim().length < 5) return 'Detaylı üretim/işletme adresini yazın.';
      if (form.postalCode && !/^\d{5}$/.test(form.postalCode)) return 'Posta kodu giriyorsanız 5 haneli olmalıdır.';
      if ((form.sellerClassification === 'company' || form.sellerClassification === 'cooperative') && !/^\d{16}$/.test(form.mersisNumber.replace(/\D/g, ''))) return 'Şirket/kooperatif için 16 haneli MERSİS numarası gerekir.';
      if (form.sellerClassification === 'tax_exempt_artisan' && !form.taxExemptionNumber.trim()) return 'Vergi muafiyet numarasını yazın.';
    }
    if (index === 4) {
      if (!form.fulfillmentMethods.length) return 'En az bir teslimat yöntemi seçin.';
      if (['registered','approved_facility'].includes(form.foodComplianceStatus) && form.foodRegistrationNumber.trim().length < 4) return 'Kayıtlı/onaylı gıda işletmesi için kayıt veya onay numarasını yazın.';
      if (form.averageDispatchDays < 1 || form.averageDispatchDays > 30) return 'Ortalama gönderim süresi 1-30 gün olmalıdır.';
      if (form.organicClaimStatus === 'certified' && (!form.organicCertifierName.trim() || form.organicCertificateNumber.trim().length < 4 || !form.organicCertificateExpiresOn)) return 'Sertifikalı organik beyanı için kuruluş, sertifika no ve geçerlilik tarihi zorunludur.';
      if (form.organicClaimStatus === 'certified' && new Date(form.organicCertificateExpiresOn + 'T23:59:59').getTime() < Date.now()) return 'Süresi geçmiş organik sertifikası kullanılamaz.';
      if (form.productionPracticeNotes.trim().length < 30) return 'Üretim uygulamalarınızı en az 30 karakterle açıklayın.';
    }
    if (index === 5) {
      if (!form.villageProductCommitment || !form.traceabilityCommitment || !form.productTruthCommitment) return 'Üç üretici taahhüdünü de onaylamadan başvuru gönderilemez.';
    }
    return '';
  }

  function next() {
    const issue = validateStep(step);
    if (issue) { setError(issue); return; }
    setError(''); setStep(value => Math.min(5, value + 1)); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateProduct(index: number, key: string, value: any) {
    setForm(previous => ({ ...previous, plannedProducts: previous.plannedProducts.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  }

  function addDocument(file?: File) {
    if (!file) return;
    if (documents.length >= 6) { setError('En fazla 6 belge yükleyebilirsiniz.'); return; }
    const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(file.type)) { setError('Belgeler PDF, JPEG, PNG veya WebP olmalıdır.'); return; }
    if (file.size <= 0 || file.size > 20 * 1024 * 1024) { setError('Her belge en fazla 20 MB olabilir ve boş dosya yüklenemez.'); return; }
    setError('');
    setDocuments(previous => [...previous, { file, documentType: businessClass ? 'tax_certificate' : 'identity' }]);
  }

  async function submit() {
    const issue = validateStep(5);
    if (issue) { setError(issue); return; }
    let uploaded: { storage_path: string; document_type: string }[] = [];
    try {
      setBusy(true); setError('');
      const saved = await saveProducerApplicationDraft({
        ...form,
        brandName: form.brandName.trim() || form.publicName.trim(),
        sourcingModels: sourceModelsSelected,
        address: {
          country_code: form.countryCode,
          province: form.province,
          district: form.district,
          settlement_type: 'village',
          settlement_name: form.village,
          address_line: form.addressLine,
          postal_code: form.postalCode || null,
        },
      });
      const applicationId = saved?.application_id || saved?.applicationId || form.applicationId;
      if (!applicationId) throw new Error('Başvuru kimliği oluşturulamadı.');
      uploaded = await uploadProducerDocuments(currentUser.id || currentUser.uid, applicationId, documents);
      const result = await submitProducerApplication(applicationId, uploaded);
      setForm(previous => ({ ...previous, applicationId, status: result?.status || 'submitted' }));
      setSuccess(result);
    } catch (err: any) {
      if (uploaded.length) await removeProducerUploadedDocuments(uploaded.map(item => item.storage_path)).catch(() => {});
      const message = String(err?.message || 'Başvuru gönderilemedi.');
      const friendly = message.includes('identity_document_required') ? 'Bireysel üretici için kimlik belgesi yükleyin.'
        : message.includes('business_document_required') ? 'İşletme için vergi levhası veya işletme kayıt belgesi yükleyin.'
        : message.includes('organic_certificate_document_required') ? 'Sertifikalı organik beyanınız için organik sertifikasını yükleyin.'
        : message.includes('tax_exemption_document_required') ? 'Vergi muafiyet belgesini yükleyin.'
        : message.includes('food_registration_document_required') ? 'Gıda işletmesi kayıt belgesini yükleyin.'
        : message.includes('food_approval_document_required') ? 'Gıda işletmesi onay belgesini yükleyin.'
        : message.includes('primary_producer_document_required') ? 'Birincil üretici/ÇKS belgesini yükleyin.'
        : message;
      setError(friendly);
    } finally { setBusy(false); }
  }

  if (loading) return <div role="status" className="mx-auto max-w-4xl p-8 text-center">Satıcı başvurusu yükleniyor…</div>;
  if (success || ['submitted', 'under_review', 'approved'].includes(form.status)) {
    return <main className="mx-auto max-w-3xl p-4 py-8"><div className="rounded-3xl border bg-white p-7 text-center dark:bg-gray-900 dark:border-gray-800">
      <CheckCircle2 className="mx-auto h-12 w-12 text-brand-green" />
      <h1 className="mt-4 text-2xl font-bold">Satıcı başvurunuz alındı</h1>
      <p className="mt-2 text-gray-500">Durum: {success?.status || form.status}. Golden Oremar yönetimi üretim, köy/menşe ve belgeleri incelemeden satıcı hesabı aktif olmaz.</p>
      {onBack ? <button onClick={onBack} className="mt-5 min-h-11 rounded-xl border px-5 font-semibold">Hesabıma dön</button> : null}
    </div></main>;
  }

  const steps = ['Üretici', 'Köy & Kategori', 'Ürün Planı', 'Yasal & Ödeme', 'Uygunluk', 'Belgeler & Onay'];
  return <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8" aria-labelledby="producer-application-title">
    <div className="mb-5 flex items-center gap-3">{onBack ? <button onClick={onBack} className="min-h-11 rounded-xl border px-4"><ArrowLeft className="mr-2 inline h-4 w-4"/>Geri</button> : null}<div><h1 id="producer-application-title" className="text-2xl font-bold text-brand-green dark:text-brand-gold">Golden Oremar Satıcı Başvurusu</h1><p className="mt-1 text-sm text-gray-500">Yalnız gerçek köy/üretim bilgileri ve doğrulanabilir ürün beyanları kabul edilir.</p></div></div>
    <ol className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Başvuru adımları">{steps.map((label, index) => <li key={label} aria-current={step===index?'step':undefined} className={`rounded-xl border p-2 text-xs font-semibold ${step===index?'border-brand-gold bg-brand-gold/10 text-brand-gold':''}`}>{index+1}. {label}</li>)}</ol>
    {error ? <div ref={errorRef} tabIndex={-1} role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div> : null}

    <section className="rounded-3xl border bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-7">
      {step===0 ? <div className="space-y-4"><h2 className="text-xl font-bold">Üretici kimliği</h2><Field label="Satıcı türü"><select value={form.sellerClassification} onChange={e=>setForm({...form,sellerClassification:e.target.value})} className="input">{sellerClasses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field><Field label="Halka açık üretici/mağaza adı"><input value={form.publicName} onChange={e=>setForm({...form,publicName:e.target.value})} className="input"/></Field><Field label="Marka adı (varsa)"><input value={form.brandName} onChange={e=>setForm({...form,brandName:e.target.value})} className="input"/></Field><Field label="Üretiminizi anlatın"><textarea rows={5} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="input" placeholder="Nerede, kimlerle, hangi yöntemlerle üretim yaptığınızı ve ürünlerinizi anlatın."/></Field></div> : null}

      {step===1 ? <div className="space-y-4"><h2 className="text-xl font-bold">Köy ve üretim yeri</h2><div className="grid gap-3 sm:grid-cols-2"><Field label="Ülke kodu"><input maxLength={2} value={form.countryCode} onChange={e=>setForm({...form,countryCode:e.target.value.toUpperCase()})} className="input"/></Field><Field label="İl"><input value={form.province} onChange={e=>setForm({...form,province:e.target.value})} className="input"/></Field><Field label="İlçe"><input value={form.district} onChange={e=>setForm({...form,district:e.target.value})} className="input"/></Field><Field label="Köy / mezra"><input list="golden-oremar-village-suggestions" value={form.village} onChange={e=>{const value=e.target.value;setForm({...form,village:value,villageIsCustom:!locationSuggestions.some((row:any)=>row.village.toLocaleLowerCase('tr-TR')===value.toLocaleLowerCase('tr-TR'))});}} className="input"/><datalist id="golden-oremar-village-suggestions">{locationSuggestions.map((row:any)=><option key={`${row.province}-${row.district}-${row.village}`} value={row.village}>{row.village} — {row.district}/{row.province}</option>)}</datalist><span className="mt-1 block text-xs text-gray-500">Doğrulanmış mevcut köyler önerilir. Listede yoksa gerçek köy/mezra adını manuel yazabilirsiniz.</span></Field></div><label className="flex min-h-11 items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={form.villageIsCustom} onChange={e=>setForm({...form,villageIsCustom:e.target.checked})} className="h-5 w-5"/><span>Köy listede yoktu; adı manuel girdim</span></label><fieldset><legend className="font-semibold">Satmayı planladığınız kategoriler</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{categories.map(category=><label key={category.id} className="flex min-h-11 items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={form.productCategories.includes(category.slug)} onChange={e=>setForm({...form,productCategories:e.target.checked?[...form.productCategories,category.slug]:form.productCategories.filter(x=>x!==category.slug)})} className="h-5 w-5"/><span>{category.name}</span></label>)}</div></fieldset></div> : null}

      {step===2 ? <div className="space-y-4"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Satacağınız ürünler</h2><button type="button" disabled={form.plannedProducts.length>=30} onClick={()=>setForm({...form,plannedProducts:[...form.plannedProducts,{name:'',category:'',source_model:'own_production',unit:'kg',estimated_quantity:1}]})} className="min-h-11 rounded-xl border px-3 font-semibold"><Plus className="mr-1 inline h-4 w-4"/>Ürün ekle</button></div>{form.plannedProducts.map((item,index)=><fieldset key={index} className="rounded-2xl border p-4"><legend className="px-2 font-bold">Ürün {index+1}</legend><div className="grid gap-3 sm:grid-cols-2"><Field label="Ürün adı"><input value={item.name} onChange={e=>updateProduct(index,'name',e.target.value)} className="input"/></Field><Field label="Kategori"><select value={item.category} onChange={e=>updateProduct(index,'category',e.target.value)} className="input"><option value="">Seçin</option>{categories.map(c=><option key={c.id} value={c.slug}>{c.name}</option>)}</select></Field><Field label="Ürün kaynağı"><select value={item.source_model} onChange={e=>updateProduct(index,'source_model',e.target.value)} className="input">{sourceModels.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field><Field label="Birim"><input value={item.unit} onChange={e=>updateProduct(index,'unit',e.target.value)} className="input" placeholder="kg, litre, adet"/></Field><Field label="Tahmini miktar"><input type="number" min="0.01" max="1000000" step="0.01" value={item.estimated_quantity} onChange={e=>updateProduct(index,'estimated_quantity',Number(e.target.value))} className="input"/></Field></div>{form.plannedProducts.length>1?<button type="button" onClick={()=>setForm({...form,plannedProducts:form.plannedProducts.filter((_,i)=>i!==index)})} className="mt-3 min-h-11 rounded-xl border border-red-200 px-3 text-red-700"><Trash2 className="mr-1 inline h-4 w-4"/>Ürünü kaldır</button>:null}</fieldset>)}</div> : null}

      {step===3 ? <div className="space-y-4"><h2 className="text-xl font-bold">Yasal ve ödeme bilgileri</h2><div className="grid gap-3 sm:grid-cols-2"><Field label="Yasal ad / unvan"><input value={form.legalName} onChange={e=>setForm({...form,legalName:e.target.value})} className="input"/></Field><Field label={businessClass?'Vergi numarası':'T.C. kimlik numarası'}><input inputMode="numeric" value={form.identifier} onChange={e=>setForm({...form,identifier:e.target.value.replace(/\D/g,'')})} className="input"/></Field><Field label="Vergi dairesi (varsa)"><input value={form.taxOffice} onChange={e=>setForm({...form,taxOffice:e.target.value})} className="input"/></Field><Field label="MERSİS (şirket/kooperatif)"><input inputMode="numeric" value={form.mersisNumber} onChange={e=>setForm({...form,mersisNumber:e.target.value.replace(/\D/g,'').slice(0,16)})} className="input"/></Field><Field label="Vergi muafiyet numarası"><input value={form.taxExemptionNumber} onChange={e=>setForm({...form,taxExemptionNumber:e.target.value})} className="input"/></Field><Field label="IBAN"><input value={form.iban} onChange={e=>setForm({...form,iban:e.target.value.toUpperCase().replace(/\s/g,'')})} className="input"/></Field><Field label="Telefon"><input inputMode="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="input"/></Field><Field label="Başvuru e-postası"><input value={form.contactEmail} readOnly className="input bg-gray-100"/></Field></div><Field label="Detaylı üretim/işletme adresi"><textarea rows={3} value={form.addressLine} onChange={e=>setForm({...form,addressLine:e.target.value})} className="input"/></Field><Field label="Posta kodu (varsa)"><input value={form.postalCode} onChange={e=>setForm({...form,postalCode:e.target.value})} className="input"/></Field></div> : null}

      {step===4 ? <div className="space-y-4"><h2 className="text-xl font-bold">Üretim, gıda uygunluğu ve gönderim</h2><Field label="Gıda uygunluk durumu"><select value={form.foodComplianceStatus} onChange={e=>setForm({...form,foodComplianceStatus:e.target.value})} className="input"><option value="pending">İnceleme/belge süreci bekliyor</option><option value="primary_production_review">Birincil üretici / ÇKS incelemesi</option><option value="registered">Gıda işletmesi kayıtlı</option><option value="approved_facility">Onaylı tesis</option></select></Field><Field label="Gıda kayıt/onay numarası (varsa)"><input value={form.foodRegistrationNumber} onChange={e=>setForm({...form,foodRegistrationNumber:e.target.value})} className="input"/></Field><fieldset><legend className="font-semibold">Teslimat yöntemleri</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{[['cargo','Kargo'],['local_delivery','Yerel teslimat'],['pickup','Üreticiden teslim']].map(([value,label])=><label key={value} className="flex min-h-11 items-center gap-2 rounded-xl border p-3"><input type="checkbox" checked={form.fulfillmentMethods.includes(value)} onChange={e=>setForm({...form,fulfillmentMethods:e.target.checked?[...form.fulfillmentMethods,value]:form.fulfillmentMethods.filter(x=>x!==value)})} className="h-5 w-5"/>{label}</label>)}</div></fieldset><Field label="Ortalama gönderim süresi (gün)"><input type="number" min="1" max="30" value={form.averageDispatchDays} onChange={e=>setForm({...form,averageDispatchDays:Number(e.target.value)})} className="input"/></Field><label className="flex min-h-11 items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={form.coldChainCapable} onChange={e=>setForm({...form,coldChainCapable:e.target.checked})} className="h-5 w-5"/><span>Soğuk zincir gerektiren ürünleri uygun şekilde gönderebilirim</span></label><Field label="Organik beyan durumu"><select value={form.organicClaimStatus} onChange={e=>setForm({...form,organicClaimStatus:e.target.value})} className="input"><option value="not_certified_no_claim">Sertifikalı organik iddiasında bulunmuyorum</option><option value="certification_in_progress">Sertifikasyon süreci devam ediyor</option><option value="certified">Geçerli organik sertifikam var</option></select></Field>{form.organicClaimStatus==='certified'?<div className="grid gap-3 sm:grid-cols-3"><Field label="Sertifikayı veren kuruluş"><input value={form.organicCertifierName} onChange={e=>setForm({...form,organicCertifierName:e.target.value})} className="input"/></Field><Field label="Sertifika numarası"><input value={form.organicCertificateNumber} onChange={e=>setForm({...form,organicCertificateNumber:e.target.value})} className="input"/></Field><Field label="Geçerlilik tarihi"><input type="date" value={form.organicCertificateExpiresOn} onChange={e=>setForm({...form,organicCertificateExpiresOn:e.target.value})} className="input"/></Field></div>:null}<Field label="Üretim uygulamalarınız"><textarea rows={4} value={form.productionPracticeNotes} onChange={e=>setForm({...form,productionPracticeNotes:e.target.value})} className="input" placeholder="Yem, gübre, ilaç, hasat, saklama veya üretim yöntemi hakkında doğrulanabilir bilgileri yazın."/></Field></div> : null}

      {step===5 ? <div className="space-y-5"><h2 className="text-xl font-bold">Belgeler ve taahhütler</h2><div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><FileCheck2 className="mr-2 inline h-5 w-5"/>En fazla 6 belge; PDF/JPEG/PNG/WebP, belge başına en fazla 20 MB. Belgeler public değildir; yalnız siz ve yetkili admin inceleyebilir.</div><label className="block min-h-11 cursor-pointer rounded-xl border border-dashed p-4 text-center font-semibold">Belge seç<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={e=>{addDocument(e.target.files?.[0]);e.currentTarget.value='';}}/></label>{documents.map((doc,index)=><div key={`${doc.file.name}-${index}`} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_220px_auto] sm:items-center"><div className="min-w-0"><div className="truncate font-semibold">{doc.file.name}</div><div className="text-xs text-gray-500">{(doc.file.size/1024/1024).toFixed(2)} MB</div></div><select value={doc.documentType} onChange={e=>setDocuments(prev=>prev.map((item,i)=>i===index?{...item,documentType:e.target.value}:item))} className="input">{documentTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button type="button" onClick={()=>setDocuments(prev=>prev.filter((_,i)=>i!==index))} aria-label={`${doc.file.name} belgesini kaldır`} className="min-h-11 rounded-xl border px-3"><Trash2 className="h-4 w-4"/></button></div>)}<div className="space-y-2"><Commitment checked={form.villageProductCommitment} onChange={checked=>setForm({...form,villageProductCommitment:checked})} label="Satacağım ürünlerin köy/üretim kaynağını doğru beyan edeceğimi ve yanıltıcı köy ürünü iddiasında bulunmayacağımı kabul ediyorum."/><Commitment checked={form.traceabilityCommitment} onChange={checked=>setForm({...form,traceabilityCommitment:checked})} label="Ürünlerin üretici, menşe ve mümkün olduğunda lot/hasat izlenebilirliğini sağlamayı kabul ediyorum."/><Commitment checked={form.productTruthCommitment} onChange={checked=>setForm({...form,productTruthCommitment:checked})} label="Sertifikasız ürünü sertifikalı organik olarak sunmayacağımı; ürün açıklaması ve belgelerde doğru bilgi vereceğimi kabul ediyorum."/></div><button type="button" disabled={busy} onClick={submit} className="min-h-12 w-full rounded-xl bg-brand-green font-bold text-white disabled:opacity-50">{busy?'Başvuru doğrulanıyor ve gönderiliyor…':'Başvuruyu İncelemeye Gönder'}</button></div> : null}

      {step<5?<div className="mt-6 flex gap-3"><button type="button" disabled={step===0} onClick={()=>{setError('');setStep(v=>Math.max(0,v-1));}} className="min-h-11 flex-1 rounded-xl border font-semibold disabled:opacity-40">Geri</button><button type="button" onClick={next} className="min-h-11 flex-1 rounded-xl bg-brand-green font-bold text-white">Devam Et</button></div>:<button type="button" onClick={()=>{setError('');setStep(4);}} className="mt-5 min-h-11 w-full rounded-xl border font-semibold">Önceki adıma dön</button>}
    </section>
    <style>{`.input{width:100%;min-height:44px;border:1px solid rgb(209 213 219);border-radius:.75rem;padding:.7rem .8rem;background:transparent;outline:none}.dark .input{border-color:rgb(55 65 81)}`}</style>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-semibold">{label}</span>{children}</label>;
}

function Commitment({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <label className="flex items-start gap-3 rounded-xl border p-3"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} className="mt-1 h-5 w-5"/><span className="text-sm">{label}</span></label>;
}

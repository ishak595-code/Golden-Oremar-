import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileCheck2, Plus, Trash2 } from 'lucide-react';
import {
  getMyProducerApplicationDraft,
  listOnboardingCategories,
  listProductionLocationSuggestions,
  removeProducerUploadedDocuments,
  saveProducerApplicationDraft,
  submitProducerApplication,
  uploadProducerDocuments,
  type OnboardingCategory,
  type PendingDocument,
  type ProducerApplicationMutationResult,
  type ProducerPlannedProduct,
  type ProductionLocationSuggestion,
} from './api';

const sellerClasses = [
  ['individual_non_merchant', 'Bireysel köy üreticisi'],
  ['tax_exempt_artisan', 'Esnaf vergi muafiyetli üretici'],
  ['artisan', 'Esnaf / zanaatkâr üretici'],
  ['sole_proprietor', 'Şahıs işletmesi'],
  ['company', 'Şirket'],
  ['cooperative', 'Kooperatif'],
] as const;
const sellerClassKeys = new Set(sellerClasses.map(([value]) => value));

const activityTypes = [
  ['beekeeping', 'Arıcılık', 'Bal, petek, arı ürünleri ve arıcılık üretimi'],
  ['livestock', 'Hayvancılık', 'Büyükbaş veya küçükbaş hayvan yetiştiriciliği'],
  ['dairy', 'Süt üretimi', 'Süt ve süt temelli köy ürünleri'],
  ['poultry', 'Kümes hayvancılığı', 'Tavuk, hindi, kaz ve yumurta üretimi'],
  ['field_farming', 'Tarla tarımı', 'Tahıl, bakliyat ve açık tarla üretimi'],
  ['fruit_growing', 'Meyvecilik', 'Bahçe ve meyve üretimi'],
  ['vegetable_growing', 'Sebzecilik', 'Sebze ve bostan üretimi'],
  ['wild_harvest', 'Dağ ve doğa mahsulleri', 'Doğadan kontrollü toplama ve yöresel dağ ürünleri'],
  ['fishing', 'Balıkçılık', 'Yerel ve mevzuata uygun su ürünleri üretimi'],
  ['food_processing', 'Geleneksel gıda işleme', 'Kurutma, peynir, tereyağı, salça ve benzeri köy üretimi'],
  ['beverage_production', 'Yöresel içecek üretimi', 'Geleneksel alkolsüz içecek ve benzeri üretim'],
  ['natural_materials', 'Doğal malzeme üretimi', 'Doğal taş ve köy kaynaklı doğrulanabilir malzemeler'],
] as const;

const sourceModels = [
  ['own_production', 'Kendi üretimim'],
  ['family_production', 'Aile üretimimiz'],
  ['cooperative_production', 'Üyesi olduğum kooperatifin üretimi'],
] as const;
const sourceModelKeys = new Set(sourceModels.map(([value]) => value));
const foodComplianceKeys = new Set(['pending','primary_production_review','registered','approved_facility']);
const organicClaimKeys = new Set(['not_certified_no_claim','certification_in_progress','certified']);

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
const documentTypeLabels = new Map<string, string>(documentTypes.map(([value, label]) => [value, label]));

const initialForm = {
  applicationId: null as string | null,
  status: 'draft',
  sellerClassification: 'individual_non_merchant',
  activityTypes: [] as string[],
  brandName: '', publicName: '', description: '',
  countryCode: 'TR', province: 'Hakkâri', district: 'Yüksekova', village: '', villageIsCustom: false,
  latitude: null as number | null, longitude: null as number | null,
  productCategories: [] as string[],
  legalName: '', identifier: '', taxOffice: '', mersisNumber: '', taxExemptionNumber: '', iban: '', phone: '', contactEmail: '',
  addressLine: '', postalCode: '',
  foodComplianceStatus: 'pending', foodRegistrationNumber: '',
  fulfillmentMethods: ['cargo'] as string[], averageDispatchDays: 2, coldChainCapable: false,
  plannedProducts: [{ name: '', category: '', source_model: 'own_production', unit: 'kg', estimated_quantity: 1 }] as ProducerPlannedProduct[],
  organicClaimStatus: 'not_certified_no_claim', organicCertifierName: '', organicCertificateNumber: '', organicCertificateExpiresOn: '',
  villageProductCommitment: false, traceabilityCommitment: false, productTruthCommitment: false,
  productionPracticeNotes: '',
};

export default function ProducerApplicationFlow({ currentUser, onBack }: { currentUser: any; onBack?: () => void }) {
  const [form, setForm] = useState(initialForm);
  const [categories, setCategories] = useState<OnboardingCategory[]>([]);
  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const [existingDocumentTypes, setExistingDocumentTypes] = useState<string[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<ProductionLocationSuggestion[]>([]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<ProducerApplicationMutationResult | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [draft, categoryRows] = await Promise.all([getMyProducerApplicationDraft(), listOnboardingCategories()]);
        if (!active) return;
        setCategories(categoryRows);
        if (draft) {
          setExistingDocumentTypes(draft.existingDocumentTypes);
          setForm(previous => ({
            ...previous,
            applicationId: draft.applicationId,
            status: draft.status,
            sellerClassification: draft.sellerClassification,
            activityTypes: draft.activityTypes,
            brandName: draft.brandName,
            publicName: draft.publicName,
            description: draft.description,
            countryCode: draft.countryCode,
            province: draft.province,
            district: draft.district,
            village: draft.village,
            villageIsCustom: draft.villageIsCustom,
            latitude: draft.latitude,
            longitude: draft.longitude,
            productCategories: draft.productCategories,
            legalName: draft.legalName,
            identifier: draft.identifier,
            taxOffice: draft.taxOffice,
            mersisNumber: draft.mersisNumber,
            taxExemptionNumber: draft.taxExemptionNumber,
            iban: draft.iban,
            phone: draft.phone,
            contactEmail: draft.contactEmail,
            addressLine: draft.addressLine,
            postalCode: draft.postalCode,
            foodComplianceStatus: draft.foodComplianceStatus,
            foodRegistrationNumber: draft.foodRegistrationNumber,
            fulfillmentMethods: draft.fulfillmentMethods,
            averageDispatchDays: draft.averageDispatchDays,
            coldChainCapable: draft.coldChainCapable,
            plannedProducts: draft.plannedProducts,
            organicClaimStatus: draft.organicClaimStatus,
            organicCertifierName: draft.organicCertifierName,
            organicCertificateNumber: draft.organicCertificateNumber,
            organicCertificateExpiresOn: draft.organicCertificateExpiresOn,
            villageProductCommitment: draft.villageProductCommitment,
            traceabilityCommitment: draft.traceabilityCommitment,
            productTruthCommitment: draft.productTruthCommitment,
            productionPracticeNotes: draft.productionPracticeNotes,
          }));
        } else {
          setExistingDocumentTypes([]);
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
    if (form.countryCode.trim().length !== 2 || form.province.trim().length < 2 || form.district.trim().length < 2) {
      setLocationSuggestions([]);
      return () => { active = false; };
    }
    const timer = window.setTimeout(() => {
      listProductionLocationSuggestions(form.countryCode, form.province, form.district)
        .then(rows => { if (active) setLocationSuggestions(rows); })
        .catch(() => { if (active) setLocationSuggestions([]); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [form.countryCode, form.province, form.district]);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const businessClass = ['artisan', 'sole_proprietor', 'company', 'cooperative'].includes(form.sellerClassification);
  const sourceModelsSelected = useMemo(() => Array.from(new Set(form.plannedProducts.map(item => item.source_model).filter(Boolean))), [form.plannedProducts]);
  const selectedCategories = useMemo(() => categories.filter(category => form.productCategories.includes(category.slug)), [categories, form.productCategories]);

  function validateStep(index: number) {
    if (index === 0) {
      if (!sellerClassKeys.has(form.sellerClassification as any)) return 'Geçerli satıcı türünü seçin.';
      if (form.publicName.trim().length < 2) return 'Kamuya gösterilecek üretici adını yazın.';
      if (!form.activityTypes.length) return 'Yaptığınız üretim faaliyetlerinden en az birini seçin.';
      if (form.description.trim().length < 40) return 'Üretiminizi ve köy ürünlerinizi en az 40 karakterle açıklayın.';
    }
    if (index === 1) {
      if (!/^[A-Z]{2}$/.test(form.countryCode) || form.province.trim().length < 2 || form.district.trim().length < 2 || form.village.trim().length < 2) return 'Ülke, il, ilçe ve köy bilgilerini eksiksiz yazın.';
      if (form.province.trim().length > 100 || form.district.trim().length > 100 || form.village.trim().length > 160) return 'Üretim yeri alanlarından biri izin verilen uzunluğu aşıyor.';
      if ((form.latitude === null) !== (form.longitude === null)) return 'Enlem ve boylam birlikte girilmelidir.';
      if (!form.productCategories.length) return 'En az bir ürün kategorisi seçin.';
    }
    if (index === 2) {
      if (!form.plannedProducts.length) return 'En az bir ürün planı ekleyin.';
      for (const item of form.plannedProducts) {
        if (item.name.trim().length < 2 || item.name.trim().length > 120 || !form.productCategories.includes(item.category) || !sourceModelKeys.has(item.source_model as any) || item.unit.trim().length < 1 || item.unit.trim().length > 30 || !Number.isFinite(Number(item.estimated_quantity)) || Number(item.estimated_quantity) <= 0 || Number(item.estimated_quantity) > 1_000_000) return 'Her ürün kendi onay kapsamınızdaki kategoriye bağlı olmalı ve size, ailenize veya kooperatifinize ait gerçek üretim olmalıdır.';
      }
    }
    if (index === 3) {
      if (form.legalName.trim().length < 2) return 'Yasal ad/unvan bilgisini yazın.';
      if (form.countryCode === 'TR' && businessClass && !/^\d{10}$/.test(form.identifier.replace(/\D/g, ''))) return 'İşletme için 10 haneli vergi numarası gerekir.';
      if (form.countryCode === 'TR' && !businessClass && !/^\d{11}$/.test(form.identifier.replace(/\D/g, ''))) return 'Bireysel üretici için 11 haneli T.C. kimlik numarası gerekir.';
      if (businessClass && form.taxOffice.trim().length < 2) return 'İşletme için vergi dairesini yazın.';
      if (!/^TR\d{24}$/.test(form.iban.replace(/\s/g, ''))) return 'IBAN TR ile başlamalı ve toplam 26 karakter olmalıdır.';
      const phoneDigits = form.phone.replace(/\D/g, '').length;
      if (phoneDigits < 10 || phoneDigits > 15) return 'Telefon 10 ile 15 rakam içermelidir.';
      if (form.contactEmail.trim().toLowerCase() !== String(currentUser?.email || '').trim().toLowerCase()) return 'Başvuru e-postası giriş yaptığınız hesap e-postasıyla aynı olmalıdır.';
      if (!currentUser?.emailVerified) return 'Satıcı başvurusu için hesap e-postanızı önce doğrulayın.';
      if (form.addressLine.trim().length < 5) return 'Detaylı üretim/işletme adresini yazın.';
      if (form.postalCode.length > 24) return 'Posta kodu en fazla 24 karakter olabilir.';
      if (form.countryCode === 'TR' && form.postalCode && !/^\d{5}$/.test(form.postalCode)) return 'Türkiye posta kodu 5 haneli olmalıdır.';
      if (form.countryCode === 'TR' && (form.sellerClassification === 'company' || form.sellerClassification === 'cooperative') && !/^\d{16}$/.test(form.mersisNumber.replace(/\D/g, ''))) return 'Şirket/kooperatif için 16 haneli MERSİS numarası gerekir.';
      if (form.sellerClassification === 'tax_exempt_artisan' && !form.taxExemptionNumber.trim()) return 'Vergi muafiyet numarasını yazın.';
    }
    if (index === 4) {
      if (!foodComplianceKeys.has(form.foodComplianceStatus)) return 'Geçerli gıda uygunluk durumunu seçin.';
      if (!organicClaimKeys.has(form.organicClaimStatus)) return 'Geçerli organik beyan durumunu seçin.';
      if (!form.fulfillmentMethods.length) return 'En az bir teslimat yöntemi seçin.';
      if (['registered','approved_facility'].includes(form.foodComplianceStatus) && form.foodRegistrationNumber.trim().length < 4) return 'Kayıtlı/onaylı gıda işletmesi için kayıt veya onay numarasını yazın.';
      if (!Number.isInteger(form.averageDispatchDays) || form.averageDispatchDays < 1 || form.averageDispatchDays > 30) return 'Ortalama gönderim süresi 1-30 gün olmalıdır.';
      if (form.organicClaimStatus === 'certified' && (!form.organicCertifierName.trim() || form.organicCertificateNumber.trim().length < 4 || !form.organicCertificateExpiresOn)) return 'Sertifikalı organik beyanı için kuruluş, sertifika no ve geçerlilik tarihi zorunludur.';
      if (form.organicClaimStatus === 'certified' && new Date(form.organicCertificateExpiresOn + 'T23:59:59').getTime() < Date.now()) return 'Süresi geçmiş organik sertifikası kullanılamaz.';
      if (form.productionPracticeNotes.trim().length < 30) return 'Üretim uygulamalarınızı en az 30 karakterle açıklayın.';
    }
    if (index === 5 && (!form.villageProductCommitment || !form.traceabilityCommitment || !form.productTruthCommitment)) return 'Üç üretici taahhüdünü de onaylamadan başvuru gönderilemez.';
    return '';
  }

  function next() {
    const issue = validateStep(step);
    if (issue) { setError(issue); return; }
    setError(''); setStep(value => Math.min(5, value + 1)); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateProduct(index: number, key: keyof ProducerPlannedProduct, value: string | number) {
    setForm(previous => ({ ...previous, plannedProducts: previous.plannedProducts.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  }

  function toggleCategory(slug: string, checked: boolean) {
    setForm(previous => {
      const productCategories = checked ? Array.from(new Set([...previous.productCategories, slug])) : previous.productCategories.filter(value => value !== slug);
      const plannedProducts = checked ? previous.plannedProducts : previous.plannedProducts.map(item => item.category === slug ? { ...item, category: '' } : item);
      return { ...previous, productCategories, plannedProducts };
    });
  }

  function addDocument(file?: File) {
    if (!file) return;
    if (documents.length >= 6) { setError('En fazla 6 yeni belge yükleyebilirsiniz.'); return; }
    const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(file.type)) { setError('Belgeler PDF, JPEG, PNG veya WebP olmalıdır.'); return; }
    if (file.size <= 0 || file.size > 20 * 1024 * 1024) { setError('Her belge en fazla 20 MB olabilir ve boş dosya yüklenemez.'); return; }
    setError('');
    setDocuments(previous => [...previous, { file, documentType: businessClass ? 'tax_certificate' : 'identity' }]);
  }

  async function submit() {
    for (let index = 0; index <= 5; index += 1) {
      const issue = validateStep(index);
      if (issue) { setStep(index); setError(issue); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    }
    let uploaded: { storage_path: string; document_type: string }[] = [];
    try {
      setBusy(true); setError('');
      const saved = await saveProducerApplicationDraft({
        ...form,
        brandName: form.brandName.trim() || form.publicName.trim(),
        sourcingModels: sourceModelsSelected,
        address: { country_code: form.countryCode, province: form.province, district: form.district, settlement_type: 'village', settlement_name: form.village, address_line: form.addressLine, postal_code: form.postalCode || null },
      });
      const applicationId = saved.application_id;
      uploaded = await uploadProducerDocuments(currentUser.id || currentUser.uid, applicationId, documents);
      const result = await submitProducerApplication(applicationId, uploaded);
      setForm(previous => ({ ...previous, applicationId, status: result.status }));
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
        : message.includes('producer_intermediary_source_not_allowed') ? 'Golden Oremar satıcı hesabı aracılık hesabı değildir. Yalnız kendi, aile veya onaylı kooperatif üretiminizi bildirebilirsiniz.'
        : message.includes('producer_activity_required') || message.includes('invalid_producer_activity_types') ? 'Yaptığınız gerçek üretim faaliyetlerinden en az birini seçin.'
        : message.includes('planned_product_outside_category_scope') ? 'Planlanan ürünlerden biri seçtiğiniz kategori yetkisinin dışında.'
        : message;
      setError(friendly);
    } finally { setBusy(false); }
  }

  if (loading) return <div role="status" className="mx-auto max-w-4xl p-8 text-center">Satıcı başvurusu yükleniyor…</div>;
  if (success || ['submitted', 'under_review', 'approved'].includes(form.status)) return <main className="mx-auto max-w-3xl p-4 py-8"><div className="rounded-3xl border bg-white p-7 text-center dark:border-gray-800 dark:bg-gray-900"><CheckCircle2 className="mx-auto h-12 w-12 text-brand-green"/><h1 className="mt-4 text-2xl font-bold">Satıcı başvurunuz alındı</h1><p className="mt-2 text-gray-500">Durum: {success?.status || form.status}. Üretim faaliyeti, köy/menşe, ürün kapsamı ve belgeler doğrulanmadan satıcı hesabı aktif olmaz.</p>{onBack ? <button type="button" onClick={onBack} className="mt-5 min-h-11 rounded-xl border px-5 font-semibold">Hesabıma dön</button> : null}</div></main>;

  const steps = ['Üretici', 'Köy & Kategori', 'Ürün Planı', 'Yasal & Ödeme', 'Uygunluk', 'Belgeler & Onay'];
  return <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8" aria-labelledby="producer-application-title">
    <div className="mb-5 flex items-center gap-3">{onBack ? <button type="button" onClick={onBack} className="min-h-11 rounded-xl border px-4"><ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4"/>Geri</button> : null}<div><h1 id="producer-application-title" className="text-2xl font-bold text-brand-green dark:text-brand-gold">Golden Oremar Satıcı Başvurusu</h1><p className="mt-1 text-sm text-gray-500">Bu hesap aracı satıcılık için değil, gerçek köy üreticisinin kendi üretimini sunması içindir.</p></div></div>
    <ol className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Başvuru adımları">{steps.map((label,index)=><li key={label} aria-current={step===index?'step':undefined} className={`rounded-xl border p-2 text-xs font-semibold ${step===index?'border-brand-gold bg-brand-gold/10 text-brand-gold':''}`}>{index+1}. {label}</li>)}</ol>
    {error ? <div ref={errorRef} tabIndex={-1} role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div> : null}

    <section className="rounded-3xl border bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-7">
      {step===0 ? <div className="space-y-4"><h2 className="text-xl font-bold">Üretici kimliği ve faaliyet alanı</h2><div className="rounded-xl border border-brand-green/20 bg-brand-green/5 p-4 text-sm"><strong>Yetki sınırı:</strong> Onaylandığınızda yalnız kendi üretici hesabınıza bağlı ürünleri ve yönetimin onayladığı kategorileri yönetebilirsiniz. Super Admin araçları bu panelde bulunmaz.</div><Field label="Satıcı türü"><select value={form.sellerClassification} onChange={e=>setForm({...form,sellerClassification:e.target.value})} className="input"><option value="" disabled>Seçin</option>{sellerClasses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field><fieldset><legend className="font-semibold">Hangi üretimleri yapıyorsunuz? *</legend><p className="mt-1 text-sm text-gray-500">Gerçekte yaptığınız tüm faaliyetleri seçin. Bu bilgi üretici profilinizde ve yönetim incelemesinde kullanılır.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{activityTypes.map(([value,label,description])=><label key={value} className="flex min-h-16 items-start gap-3 rounded-xl border p-3"><input type="checkbox" checked={form.activityTypes.includes(value)} onChange={e=>setForm({...form,activityTypes:e.target.checked?[...form.activityTypes,value]:form.activityTypes.filter(item=>item!==value)})} className="mt-1 h-5 w-5"/><span><span className="block font-semibold">{label}</span><span className="mt-0.5 block text-xs text-gray-500">{description}</span></span></label>)}</div></fieldset><Field label="Halka açık üretici/mağaza adı"><input maxLength={160} value={form.publicName} onChange={e=>setForm({...form,publicName:e.target.value})} className="input"/></Field><Field label="Marka adı (varsa)"><input maxLength={160} value={form.brandName} onChange={e=>setForm({...form,brandName:e.target.value})} className="input"/></Field><Field label="Üretiminizi anlatın"><textarea rows={5} maxLength={4000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="input" placeholder="Nerede, kimlerle, hangi yöntemlerle üretim yaptığınızı ve ürünlerinizi anlatın."/></Field></div> : null}

      {step===1 ? <div className="space-y-4"><h2 className="text-xl font-bold">Köy ve ürün kategori kapsamı</h2><div className="grid gap-3 sm:grid-cols-2"><Field label="Ülke kodu"><input maxLength={2} value={form.countryCode} onChange={e=>setForm({...form,countryCode:e.target.value.toUpperCase().slice(0,2)})} className="input"/></Field><Field label="İl / bölge"><input maxLength={100} value={form.province} onChange={e=>setForm({...form,province:e.target.value})} className="input"/></Field><Field label="İlçe / şehir"><input maxLength={100} value={form.district} onChange={e=>setForm({...form,district:e.target.value})} className="input"/></Field><Field label="Köy / mezra"><input maxLength={160} list="golden-oremar-village-suggestions" value={form.village} onChange={e=>{const value=e.target.value;setForm({...form,village:value,villageIsCustom:!locationSuggestions.some(row=>row.village.toLocaleLowerCase('tr-TR')===value.toLocaleLowerCase('tr-TR'))});}} className="input"/><datalist id="golden-oremar-village-suggestions">{locationSuggestions.map(row=><option key={`${row.province}-${row.district}-${row.village}`} value={row.village}>{row.village} - {row.district}/{row.province}</option>)}</datalist><span className="mt-1 block text-xs text-gray-500">Listede yoksa gerçek köy veya mezra adını manuel yazabilirsiniz.</span></Field></div><label className="flex min-h-11 items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={form.villageIsCustom} onChange={e=>setForm({...form,villageIsCustom:e.target.checked})} className="h-5 w-5"/><span>Köy listede yoktu, adı manuel girdim</span></label><fieldset><legend className="font-semibold">Üretip satacağınız kategoriler *</legend><p className="mt-1 text-sm text-gray-500">Onaydan sonra ürün paneliniz yalnız bu kapsamla açılır. Yeni kategori gerektiğinde yönetim incelemesi gerekir.</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{categories.map(category=><label key={category.id} className="flex min-h-11 items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={form.productCategories.includes(category.slug)} onChange={e=>toggleCategory(category.slug,e.target.checked)} className="h-5 w-5"/><span>{category.name}</span></label>)}</div></fieldset></div> : null}

      {step===2 ? <div className="space-y-4"><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"><strong>Aracılık yok:</strong> Başka satıcılardan ürün toplayıp kendi ürününüz gibi listelemek bu hesapta izinli değildir. Kaynak yalnız kendi, aile veya onaylı kooperatif üretiminiz olabilir.</div><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Satacağınız ürünler</h2><button type="button" disabled={form.plannedProducts.length>=30} onClick={()=>setForm({...form,plannedProducts:[...form.plannedProducts,{name:'',category:'',source_model:'own_production',unit:'kg',estimated_quantity:1}]})} className="min-h-11 rounded-xl border px-3 font-semibold disabled:opacity-50"><Plus aria-hidden="true" className="mr-1 inline h-4 w-4"/>Ürün ekle</button></div>{form.plannedProducts.length===0?<p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">Kayıtlı ürün planı bulunmuyor. Gerçek üretiminizi eklemeden devam edemezsiniz.</p>:null}{form.plannedProducts.map((item,index)=><fieldset key={index} className="rounded-2xl border p-4"><legend className="px-2 font-bold">Ürün {index+1}</legend><div className="grid gap-3 sm:grid-cols-2"><Field label="Ürün adı"><input maxLength={120} value={item.name} onChange={e=>updateProduct(index,'name',e.target.value)} className="input"/></Field><Field label="Onay kapsamındaki kategori"><select value={item.category} onChange={e=>updateProduct(index,'category',e.target.value)} className="input"><option value="">Seçin</option>{selectedCategories.map(category=><option key={category.id} value={category.slug}>{category.name}</option>)}</select></Field><Field label="Üretim kaynağı"><select value={item.source_model} onChange={e=>updateProduct(index,'source_model',e.target.value)} className="input">{sourceModels.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field><Field label="Birim"><input maxLength={30} value={item.unit} onChange={e=>updateProduct(index,'unit',e.target.value)} className="input" placeholder="kg, litre, adet"/></Field><Field label="Tahmini miktar"><input type="number" min="0.01" max="1000000" step="0.01" value={item.estimated_quantity} onChange={e=>updateProduct(index,'estimated_quantity',Number(e.target.value))} className="input"/></Field></div>{form.plannedProducts.length>1?<button type="button" onClick={()=>setForm({...form,plannedProducts:form.plannedProducts.filter((_,i)=>i!==index)})} className="mt-3 min-h-11 rounded-xl border border-red-200 px-3 text-red-700"><Trash2 aria-hidden="true" className="mr-1 inline h-4 w-4"/>Ürünü kaldır</button>:null}</fieldset>)}</div> : null}

      {step===3 ? <div className="space-y-4"><h2 className="text-xl font-bold">Yasal ve ödeme bilgileri</h2><div className="grid gap-3 sm:grid-cols-2"><Field label="Yasal ad / unvan"><input maxLength={240} value={form.legalName} onChange={e=>setForm({...form,legalName:e.target.value})} className="input"/></Field><Field label={form.countryCode==='TR'?(businessClass?'Vergi numarası':'T.C. kimlik numarası'):'Kimlik / vergi numarası'}><input inputMode="numeric" maxLength={32} value={form.identifier} onChange={e=>setForm({...form,identifier:e.target.value.replace(/\D/g,'')})} className="input"/></Field><Field label="Vergi dairesi (varsa)"><input maxLength={160} value={form.taxOffice} onChange={e=>setForm({...form,taxOffice:e.target.value})} className="input"/></Field><Field label="MERSİS (şirket/kooperatif)"><input inputMode="numeric" value={form.mersisNumber} onChange={e=>setForm({...form,mersisNumber:e.target.value.replace(/\D/g,'').slice(0,16)})} className="input"/></Field><Field label="Vergi muafiyet numarası"><input maxLength={80} value={form.taxExemptionNumber} onChange={e=>setForm({...form,taxExemptionNumber:e.target.value})} className="input"/></Field><Field label="IBAN"><input maxLength={34} value={form.iban} onChange={e=>setForm({...form,iban:e.target.value.toUpperCase().replace(/\s/g,'')})} className="input"/></Field><Field label="Telefon"><input inputMode="tel" maxLength={40} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="input"/></Field><Field label="Başvuru e-postası"><input value={form.contactEmail} readOnly className="input bg-gray-100 dark:bg-gray-800"/></Field></div><Field label="Detaylı üretim/işletme adresi"><textarea rows={3} maxLength={500} value={form.addressLine} onChange={e=>setForm({...form,addressLine:e.target.value})} className="input"/></Field><Field label="Posta kodu (varsa)"><input maxLength={24} value={form.postalCode} onChange={e=>setForm({...form,postalCode:e.target.value})} className="input"/></Field></div> : null}

      {step===4 ? <div className="space-y-4"><h2 className="text-xl font-bold">Üretim, uygunluk ve gönderim</h2><Field label="Gıda uygunluk durumu"><select value={form.foodComplianceStatus} onChange={e=>setForm({...form,foodComplianceStatus:e.target.value})} className="input"><option value="" disabled>Seçin</option><option value="pending">İnceleme/belge süreci bekliyor</option><option value="primary_production_review">Birincil üretici / ÇKS incelemesi</option><option value="registered">Gıda işletmesi kayıtlı</option><option value="approved_facility">Onaylı tesis</option></select></Field><Field label="Gıda kayıt/onay numarası (varsa)"><input maxLength={120} value={form.foodRegistrationNumber} onChange={e=>setForm({...form,foodRegistrationNumber:e.target.value})} className="input"/></Field><fieldset><legend className="font-semibold">Teslimat yöntemleri</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{[['cargo','Kargo'],['local_delivery','Yerel teslimat'],['pickup','Üreticiden teslim']].map(([value,label])=><label key={value} className="flex min-h-11 items-center gap-2 rounded-xl border p-3"><input type="checkbox" checked={form.fulfillmentMethods.includes(value)} onChange={e=>setForm({...form,fulfillmentMethods:e.target.checked?[...form.fulfillmentMethods,value]:form.fulfillmentMethods.filter(x=>x!==value)})} className="h-5 w-5"/>{label}</label>)}</div></fieldset><Field label="Ortalama gönderim süresi (gün)"><input type="number" min="1" max="30" value={form.averageDispatchDays} onChange={e=>setForm({...form,averageDispatchDays:Number(e.target.value)})} className="input"/></Field><label className="flex min-h-11 items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={form.coldChainCapable} onChange={e=>setForm({...form,coldChainCapable:e.target.checked})} className="h-5 w-5"/><span>Soğuk zincir gerektiren ürünleri uygun şekilde gönderebilirim</span></label><Field label="Organik beyan durumu"><select value={form.organicClaimStatus} onChange={e=>setForm({...form,organicClaimStatus:e.target.value})} className="input"><option value="" disabled>Seçin</option><option value="not_certified_no_claim">Sertifikalı organik iddiasında bulunmuyorum</option><option value="certification_in_progress">Sertifikasyon süreci devam ediyor</option><option value="certified">Geçerli organik sertifikam var</option></select></Field>{form.organicClaimStatus==='certified'?<div className="grid gap-3 sm:grid-cols-3"><Field label="Sertifikayı veren kuruluş"><input maxLength={160} value={form.organicCertifierName} onChange={e=>setForm({...form,organicCertifierName:e.target.value})} className="input"/></Field><Field label="Sertifika numarası"><input maxLength={100} value={form.organicCertificateNumber} onChange={e=>setForm({...form,organicCertificateNumber:e.target.value})} className="input"/></Field><Field label="Geçerlilik tarihi"><input type="date" value={form.organicCertificateExpiresOn} onChange={e=>setForm({...form,organicCertificateExpiresOn:e.target.value})} className="input"/></Field></div>:null}<Field label="Üretim uygulamalarınızı açıklayın"><textarea required minLength={30} maxLength={2000} rows={5} value={form.productionPracticeNotes} onChange={e=>setForm({...form,productionPracticeNotes:e.target.value})} className="input" placeholder="Hayvan bakımı, arı kovanları, tarla/bahçe uygulaması, hasat, süt işleme, hijyen, saklama gibi gerçek üretim sürecinizi yazın."/></Field></div> : null}

      {step===5 ? <div className="space-y-4"><h2 className="text-xl font-bold">Belgeler ve üretici taahhütleri</h2><div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4 text-sm"><FileCheck2 aria-hidden="true" className="mr-2 inline h-5 w-5 text-brand-gold"/>Belgeler yalnız doğrulama amacıyla özel depolamada tutulur. Organik iddiası ancak geçerli sertifika doğrulanırsa yayınlanır.</div>{existingDocumentTypes.length?<div className="rounded-xl border p-4"><h3 className="font-bold">Başvuruda kayıtlı belgeler</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-300">{existingDocumentTypes.map(type=><li key={type}>{documentTypeLabels.get(type) || type}</li>)}</ul><p className="mt-2 text-xs text-gray-500">Bu liste yalnız sunucuda başvurunuza bağlı olduğu doğrulanan belge türlerini gösterir.</p></div>:null}<label className="block min-h-11 cursor-pointer rounded-xl border border-dashed p-4 text-center font-semibold focus-within:ring-2 focus-within:ring-brand-gold">Belge ekle<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={e=>{addDocument(e.target.files?.[0]);e.currentTarget.value='';}}/></label><div className="space-y-2">{documents.map((document,index)=><div key={`${document.file.name}-${index}`} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_240px_auto] sm:items-center"><div className="min-w-0"><div className="truncate font-semibold">{document.file.name}</div><div className="text-xs text-gray-500">{Math.ceil(document.file.size/1024)} KB</div></div><label><span className="sr-only">Belge türü</span><select value={document.documentType} onChange={e=>setDocuments(previous=>previous.map((item,i)=>i===index?{...item,documentType:e.target.value}:item))} className="input">{documentTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button type="button" aria-label={`${document.file.name} belgesini kaldır`} onClick={()=>setDocuments(previous=>previous.filter((_,i)=>i!==index))} className="min-h-11 rounded-xl border border-red-200 px-3 text-red-700"><Trash2 aria-hidden="true" className="h-4 w-4"/></button></div>)}</div><Commitment checked={form.villageProductCommitment} onChange={checked=>setForm({...form,villageProductCommitment:checked})} title="Köy ürünü taahhüdü" body="Listeleyeceğim ürünlerin gerçek üretim kaynağını ve köy/üretim yerini doğru beyan edeceğimi kabul ediyorum."/><Commitment checked={form.traceabilityCommitment} onChange={checked=>setForm({...form,traceabilityCommitment:checked})} title="İzlenebilirlik taahhüdü" body="Hasat, üretim, parti/lot ve gerekli saklama bilgilerini gerçeğe uygun tutacağımı kabul ediyorum."/><Commitment checked={form.productTruthCommitment} onChange={checked=>setForm({...form,productTruthCommitment:checked})} title="Ürün sahipliği ve doğruluk taahhüdü" body="Başka satıcıların ürününü kendi üretimim gibi listelemeyeceğimi, yalnız kendi, aile veya onaylı kooperatif üretimimi yöneteceğimi kabul ediyorum."/></div> : null}

      <div className="mt-6 flex gap-3 border-t pt-5">{step>0?<button type="button" disabled={busy} onClick={()=>{setError('');setStep(value=>Math.max(0,value-1));window.scrollTo({top:0,behavior:'smooth'});}} className="min-h-11 flex-1 rounded-xl border font-semibold disabled:opacity-50">Geri</button>:null}{step<5?<button type="button" disabled={busy} onClick={next} className="min-h-11 flex-1 rounded-xl bg-brand-green font-bold text-brand-on-green disabled:opacity-50">Devam</button>:<button type="button" disabled={busy} onClick={()=>void submit()} className="min-h-11 flex-1 rounded-xl bg-brand-green font-bold text-brand-on-green disabled:opacity-50">{busy?'Gönderiliyor…':'Başvuruyu Gönder'}</button>}</div>
    </section>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-semibold">{label}</span>{children}</label>;
}

function Commitment({ checked, onChange, title, body }: { checked: boolean; onChange: (checked: boolean) => void; title: string; body: string }) {
  return <label className="flex items-start gap-3 rounded-xl border p-4"><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)} className="mt-1 h-5 w-5"/><span><span className="block font-bold">{title}</span><span className="mt-1 block text-sm text-gray-500">{body}</span></span></label>;
}

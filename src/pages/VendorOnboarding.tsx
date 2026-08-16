import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Store, Phone, MapPin, CreditCard, FileText, Send, CheckCircle, Upload, Check, PackageOpen } from 'lucide-react';
import { auth, db, storage } from '../firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const CITIES = {
  'İstanbul': ['Kadıköy', 'Beşiktaş', 'Şişli', 'Üsküdar'],
  'Ankara': ['Çankaya', 'Keçiören', 'Yenimahalle'],
  'İzmir': ['Karşıyaka', 'Bornova', 'Konak'],
  'Hakkari': ['Merkez', 'Yüksekova', 'Şemdinli', 'Çukurca']
};

export default function VendorOnboarding() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    storeName: '',
    tcNo: '',
    city: '',
    district: '',
    phone: '',
    email: '',
    description: '',
    productTypes: '',
    iban: '',
  });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [toast, setToast] = useState<{message: string, visible: boolean}>({ message: '', visible: false });

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'doc' | 'id') => {
    if (e.target.files && e.target.files[0]) {
      if (type === 'doc') setDocumentFile(e.target.files[0]);
      if (type === 'id') setIdFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      showToast('Lütfen önce giriş yapın.');
      return;
    }
    // Add validations before submitting
    if (formData.tcNo.length !== 11) {
      showToast('Lütfen 11 haneli geçerli bir TC Kimlik No girin.');
      return;
    }

    setIsSubmitting(true);
    try {
      const userId = auth.currentUser.uid;
      
      let documentUrl = '';
      let idUrl = '';
      
      try {
        const uploadWithTimeout = (promise: Promise<any>) => Promise.race([
          promise, 
          new Promise((_, reject) => setTimeout(() => reject(new Error('Yükleme zaman aşımı')), 8000))
        ]);

        // Upload Document if exists
        if (documentFile) {
          const docRef = ref(storage, `vendors/${userId}/document_${Date.now()}_${documentFile.name}`);
          await uploadWithTimeout(uploadBytes(docRef, documentFile));
          documentUrl = await getDownloadURL(docRef);
        }

        // Upload ID if exists
        if (idFile) {
          const idRef = ref(storage, `vendors/${userId}/id_${Date.now()}_${idFile.name}`);
          await uploadWithTimeout(uploadBytes(idRef, idFile));
          idUrl = await getDownloadURL(idRef);
        }
      } catch (storageErr) {
        console.warn("Storage upload warn (ignored):", storageErr);
        // We do NOT throw here anymore to fix the "Gönderiliyor..." hang forever.
        // We will just proceed with empty URLs or placeholders.
        showToast("Uyarı: Dosyalar yüklenemedi ancak başvurunuz metin olarak kaydedildi. Gerekirse sizinle iletişime geçeceğiz.");
        documentUrl = "yüklenemedi";
        idUrl = "yüklenemedi";
      }

      // Save to Firestore
      const newApp = {
        userId,
        userEmail: auth.currentUser.email || formData.email,
        userName: auth.currentUser.displayName || formData.fullName,
        first_name: formData.fullName.split(' ')[0] || '',
        last_name: formData.fullName.split(' ').slice(1).join(' ') || '',
        email: formData.email,
        store_name: formData.storeName,
        phone: formData.phone,
        address: `${formData.district}, ${formData.city}`,
        tax_info: formData.tcNo,
        bank_info: formData.iban || '',
        description: formData.description + ' | Ürünler: ' + formData.productTypes,
        documentUrl,
        idUrl,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      await addDoc(collection(db, 'vendor_applications'), newApp);

      // Notify admins
      try {
        const adminQuery = query(collection(db, 'users'), where('role', 'in', ['admin', 'super_admin']));
        const adminDocs = await getDocs(adminQuery);
        adminDocs.forEach(adminDoc => {
          // Add notification record to db
          addDoc(collection(db, 'notifications'), {
            userId: adminDoc.id,
            message: `Yeni satıcı başvurusu: ${formData.storeName} (${formData.fullName})`,
            type: 'system',
            read: false,
            date: new Date().toISOString()
          });
        });
      } catch (notifyErr) {
        console.warn("Could not notify admins (ignored):", notifyErr);
      }

      setIsSuccess(true);
    } catch (error: any) {
      console.warn('Warning submitting vendor application:', error);
      showToast(error.message || 'Başvuru sırasında bir uyarı oluştu, ancak başvuru tamamlanmış olabilir.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Başvurunuz Alındı!</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Satıcı başvurunuz başarıyla sisteme iletildi. Admin onayından sonra mağazanız aktif hale gelecektir. Bu süreçte size bildirim göndereceğiz.
          </p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-semibold hover:bg-emerald-700 transition-colors"
          >
            Ana Sayfaya Dön
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12 mb-20 animate-in slide-in-from-bottom-8">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Üretici Olun</h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Doğal ve organik ürünlerinizi binlerce müşteriye ulaştırın. Başvuru formunu doldurun, onay sürecinden sonra hemen satışa başlayın.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-800">
        <div className="flex border-b border-gray-100 dark:border-gray-800">
          {[1, 2, 3, 4].map((s) => (
            <div 
              key={s}
              className={`flex-1 py-4 md:py-6 text-center text-sm md:text-base font-semibold transition-colors ${
                step === s ? 'text-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              Adım {s}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8">
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Store className="w-6 h-6 text-emerald-600" />
                Kişisel ve Mağaza Bilgileri
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ad Soyad *</label>
                  <input required type="text" name="fullName" value={formData.fullName} onChange={handleChange} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-gray-900 dark:text-white" placeholder="Ad Soyad" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mağaza / Marka Adı *</label>
                  <input required type="text" name="storeName" value={formData.storeName} onChange={handleChange} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-gray-900 dark:text-white" placeholder="Örn: Oremar Organik" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">TC Kimlik No / Vergi No *</label>
                  <input required type="text" name="tcNo" value={formData.tcNo} onChange={handleChange} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-gray-900 dark:text-white" placeholder="11 Haneli TC No" maxLength={11} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">IBAN (İsteğe Bağlı)</label>
                  <input type="text" name="iban" value={formData.iban} onChange={handleChange} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-gray-900 dark:text-white" placeholder="TR..." />
                </div>
              </div>
              <div className="flex justify-end pt-6">
                <button type="button" onClick={() => setStep(2)} className="w-full md:w-auto px-8 py-4 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors">İleri</button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-6 h-6 text-emerald-600" />
                İletişim ve Konum
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">İl *</label>
                  <select required name="city" value={formData.city} onChange={handleChange} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-gray-900 dark:text-white">
                    <option value="">İl Seçin</option>
                    {Object.keys(CITIES).map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">İlçe *</label>
                  <select required name="district" value={formData.district} onChange={handleChange} disabled={!formData.city} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:opacity-50 text-gray-900 dark:text-white">
                    <option value="">İlçe Seçin</option>
                    {formData.city && (CITIES as any)[formData.city].map((district: string) => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Telefon *</label>
                  <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-gray-900 dark:text-white" placeholder="05XX XXX XX XX" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">E-posta *</label>
                  <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-gray-900 dark:text-white" placeholder="ornek@email.com" />
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setStep(1)} className="flex-1 md:flex-none px-6 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 transition-colors">Geri</button>
                <button type="button" onClick={() => setStep(3)} className="flex-1 md:flex-none px-8 py-4 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors">İleri</button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <PackageOpen className="w-6 h-6 text-emerald-600" />
                Satış ve Ürün Bilgileri
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Lütfen sistemimizde ne tür ürünler satmak istediğinizi detaylıca anlatın. Onay sürecinde bu bilgiler çok önemlidir.
              </p>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Satacağınız Ürün Kategorileri *</label>
                  <input required type="text" name="productTypes" value={formData.productTypes} onChange={handleChange} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-gray-900 dark:text-white" placeholder="Örn: Bal, Peynir Ürünleri, Kuruyemiş vs." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">İşletmeniz ve Ürünleriniz Hakkında Detaylı Bilgi *</label>
                  <textarea required name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-gray-900 dark:text-white resize-none" placeholder="Ürünlerinizin doğal veya organik sertifikası var mı? Ne kadardır bu işi yapıyorsunuz?" />
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setStep(2)} className="flex-1 md:flex-none px-6 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 transition-colors">Geri</button>
                <button type="button" onClick={() => setStep(4)} className="flex-1 md:flex-none px-8 py-4 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors">İleri</button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-6 h-6 text-emerald-600" />
                Belge Yükleme
              </h3>
              <div className="space-y-6">
                <div className="border-2 border-dashed border-emerald-300 dark:border-emerald-900/50 rounded-2xl p-6 md:p-8 text-center hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors">
                  <Upload className="w-12 h-12 text-emerald-400 dark:text-emerald-500 mx-auto mb-4" />
                  <p className="text-emerald-800 dark:text-emerald-300 font-medium mb-2">Çiftçi Belgesi veya Üretici Sertifikası (İsteğe Bağlı)</p>
                  <p className="text-emerald-600/70 dark:text-emerald-400/50 text-sm mb-4">Maksimum dosya boyutu: 5MB</p>
                  <input type="file" accept="image/*,.pdf" onChange={(e) => handleFileChange(e, 'doc')} className="w-full max-w-xs mx-auto block text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200" />
                </div>
                <div className="border-2 border-dashed border-emerald-300 dark:border-emerald-900/50 rounded-2xl p-6 md:p-8 text-center hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors">
                  <Upload className="w-12 h-12 text-emerald-400 dark:text-emerald-500 mx-auto mb-4" />
                  <p className="text-emerald-800 dark:text-emerald-300 font-medium mb-2">Kimlik Fotoğrafı (Önlü Arkalı - İsteğe Bağlı)</p>
                  <p className="text-emerald-600/70 dark:text-emerald-400/50 text-sm mb-4">Maksimum dosya boyutu: 5MB</p>
                  <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'id')} className="w-full max-w-xs mx-auto block text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200" />
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setStep(3)} disabled={isSubmitting} className="flex-1 md:flex-none px-6 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50">Geri</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-8 py-4 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed">
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Gönderiliyor...</span>
                    </>
                  ) : (
                    <>
                      <span>Başvuruyu Tamamla</span>
                      <Send className="w-5 h-5 hidden sm:block" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </form>
      </div>

      {/* Toast Notification */}
      {toast.visible && (
        <div className="fixed bottom-4 right-4 max-w-sm w-full bg-gray-900 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5">
          <Check className="w-6 h-6 text-emerald-400 shrink-0" />
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}


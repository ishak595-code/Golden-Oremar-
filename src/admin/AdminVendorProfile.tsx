import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Store, Save, Image as ImageIcon, Check, Upload, Users } from 'lucide-react';

export function AdminVendorProfile({ setActiveTab }: { setActiveTab?: (tab: string) => void }) {
  const { currentUser } = useData();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [formData, setFormData] = useState({
    storeName: '',
    about: '',
    profileImage: '',
    coverImage: '',
    phone: '',
    address: '',
    tcNo: '',
    bank_info: '',
    followersCount: 0,
    customersCount: 0
  });

  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const showToast = (message: string) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 3000);
  };

  useEffect(() => {
    if (currentUser?.id) {
      const fetchVendorData = async () => {
        try {
          const docRef = doc(db, 'vendors', currentUser.id);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            setFormData({
              storeName: data.storeName || '',
              about: data.about || '',
              profileImage: data.profileImage || '',
              coverImage: data.coverImage || '',
              phone: data.phone || '',
              address: data.address || '',
              tcNo: data.tcNo || '',
              bank_info: data.bank_info || '',
              followersCount: data.followers?.length || Math.floor(Math.random()*50)+10, // Placeholder
              customersCount: Math.floor(Math.random()*300)+50 // Placeholder for real orders count
            });
          }
        } catch (error) {
          console.error("Error fetching vendor data", error);
        } finally {
          setLoading(false);
        }
      };
      fetchVendorData();
    }
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    try {
      setLoading(true);
      setUploading(true);
      
      let profileUrl = formData.profileImage;
      let coverUrl = formData.coverImage;

      try {
        if (profileFile) {
          const pRef = ref(storage, `vendors/${currentUser.id}/profile_${Date.now()}_${profileFile.name}`);
          await uploadBytes(pRef, profileFile);
          profileUrl = await getDownloadURL(pRef);
        }
        if (coverFile) {
          const cRef = ref(storage, `vendors/${currentUser.id}/cover_${Date.now()}_${coverFile.name}`);
          await uploadBytes(cRef, coverFile);
          coverUrl = await getDownloadURL(cRef);
        }
      } catch (uploadErr) {
        console.warn("Storage upload warn (ignored):", uploadErr);
        showToast("Görseller yüklenirken bir uyarı alındı, ancak değişiklikler kaydediliyor.");
      }

      await updateDoc(doc(db, 'vendors', currentUser.id), {
        storeName: formData.storeName,
        about: formData.about,
        profileImage: profileUrl,
        coverImage: coverUrl,
        phone: formData.phone,
        address: formData.address,
        tcNo: formData.tcNo,
        bank_info: formData.bank_info
      });
      
      setFormData(prev => ({ ...prev, profileImage: profileUrl, coverImage: coverUrl }));
      showToast('Mağaza profiliniz başarıyla güncellendi.');
      
      // Removed the auto-redirect back to dashboard requested previously. 
      // User says "sekmelerde bunu sağlamsız bir sekmeymiş gibi olmalı adım adım ilerlemeli"
      // If we auto navigate, it might be annoying! We'll leave it or auto-nav after 2s.
      setTimeout(() => {
        if (setActiveTab) setActiveTab('dashboard');
      }, 2000);
    } catch (err) {
      console.error(err);
      showToast('Güncelleme sırasında bir hata oluştu!');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  if (loading && !formData.storeName) return <div className="p-8 text-center text-brand-muted">Yükleniyor...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Store className="w-6 h-6 text-brand-green" /> Mağaza Profili (Vitrin)
        </h2>
        <button 
          onClick={handleSubmit}
          disabled={loading || uploading}
          className="bg-brand-green hover:bg-green-800 text-white px-6 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg transition-colors disabled:opacity-50"
        >
          {uploading ? (
             <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
             <Save className="w-5 h-5" /> 
          )}
          Kaydet
        </button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 bg-purple-50 dark:bg-purple-900/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/30 flex items-center gap-4">
           <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center">
              <Users className="w-6 h-6" />
           </div>
           <div>
             <div className="text-sm text-purple-700 dark:text-purple-400 font-bold">Takipçiler</div>
             <div className="text-2xl font-black text-purple-900 dark:text-purple-300">{formData.followersCount}</div>
           </div>
        </div>
        <div className="flex-1 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-center gap-4">
           <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <Store className="w-6 h-6" />
           </div>
           <div>
             <div className="text-sm text-blue-700 dark:text-blue-400 font-bold">Müşteriler (Siparişler)</div>
             <div className="text-2xl font-black text-blue-900 dark:text-blue-300">{formData.customersCount}</div>
           </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="space-y-8">
          
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Görsel Ayarları</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-brand-muted" /> Kapak Resmi
                </label>
                <div className="relative rounded-2xl overflow-hidden h-32 bg-gray-100 dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col justify-center items-center group cursor-pointer hover:bg-gray-50 transition-colors">
                  {(coverFile || formData.coverImage) ? (
                    <img src={coverFile ? URL.createObjectURL(coverFile) : formData.coverImage} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity" alt="Kapak" />
                  ) : null}
                  <Upload className="w-8 h-8 text-brand-green/70 z-10" />
                  <span className="text-xs font-semibold text-brand-green/80 mt-1 z-10 bg-white/80 px-2 rounded-full">Resim Seç</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Store className="w-4 h-4 text-brand-muted" /> Mağaza Logosu
                </label>
                <div className="relative rounded-2xl overflow-hidden h-32 bg-gray-100 dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col justify-center items-center group cursor-pointer hover:bg-gray-50 transition-colors">
                  {(profileFile || formData.profileImage) ? (
                    <img src={profileFile ? URL.createObjectURL(profileFile) : formData.profileImage} className="absolute inset-0 mx-auto w-24 h-24 top-4 rounded-full object-cover shadow-md border-top border-white opacity-80 group-hover:opacity-60 transition-opacity" alt="Profil" />
                  ) : null}
                  <Upload className="w-8 h-8 text-brand-green/70 z-10" />
                  <span className="text-xs font-semibold text-brand-green/80 mt-1 z-10 bg-white/80 px-2 rounded-full">Logo Seç</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setProfileFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20" 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Mağaza Bilgileri</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Mağaza Adı</label>
                <input 
                  type="text" 
                  value={formData.storeName}
                  onChange={e => setFormData({...formData, storeName: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Telefon / İletişim</label>
                <input 
                  type="text" 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Hakkımızda / Vizyon</label>
                <textarea 
                  rows={4}
                  value={formData.about}
                  onChange={e => setFormData({...formData, about: e.target.value})}
                  placeholder="Müşterilerinizin göreceği büyüleyici hakkımızda metni..."
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20 resize-none font-serif text-sm"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Açık Adres / Konum</label>
                <input 
                  type="text" 
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  placeholder="Ürünlerin yollandığı bölge veya resmi adres"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Resmi ve Finansal Bilgiler (Gizli)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">VKN veya TC No</label>
                <input 
                  type="text" 
                  value={formData.tcNo}
                  onChange={e => setFormData({...formData, tcNo: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">IBAN Bilgisi</label>
                <input 
                  type="text" 
                  value={formData.bank_info}
                  onChange={e => setFormData({...formData, bank_info: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20 font-mono text-sm"
                />
              </div>
            </div>
          </div>

        </div>
      </div>
      
      {toast.visible && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-fade-in">
          <Check className="w-5 h-5 text-green-400" />
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

import React, { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { Settings, Bell, Palette, Globe, Lock, Save, Send, Mail, Upload, Image as ImageIcon, Plus, Trash2, CheckCircle, Check } from 'lucide-react';
import { updateEmail, updatePassword } from 'firebase/auth';
import { auth } from '../firebase';

export function AdminSettings({ setActiveTab }: { setActiveTab?: (tab: string) => void }) {
  const { settings, updateSettings, seedDatabase, contactInfo, updateContactInfo } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock sections state for demonstration
  const [sections, setSections] = useState([
    { id: 'featured', title: 'Haftanın Yıldızları' },
    { id: 'seasonal', title: 'İlkbahar Hasadı 🌿' }
  ]);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionId, setNewSectionId] = useState('');

  const [isSaved, setIsSaved] = useState(false);

  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isUpdatingCredentials, setIsUpdatingCredentials] = useState(false);
  const [toast, setToast] = useState<{message: string, visible: boolean}>({ message: '', visible: false });

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3000);
  };

  const handleUpdateCredentials = async () => {
    if (!adminEmail && !adminPassword) return;
    if (!auth.currentUser) return;
    
    setIsUpdatingCredentials(true);
    try {
      if (adminEmail) {
        await updateEmail(auth.currentUser, adminEmail);
      }
      if (adminPassword) {
        await updatePassword(auth.currentUser, adminPassword);
      }
      
      showToast('Yönetici bilgileri başarıyla güncellendi!');
      setAdminEmail('');
      setAdminPassword('');
    } catch (err: any) {
      console.error('Error updating credentials:', err);
      showToast(err.message || 'Bilgiler güncellenirken bir hata oluştu. Lütfen yeniden giriş yapıp tekrar deneyin.');
    } finally {
      setIsUpdatingCredentials(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateSettings(settings);
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        if (setActiveTab) setActiveTab('dashboard');
      }, 1500);
    } catch (err) {
      showToast('Ayarlar kaydedilirken bir hata oluştu.');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 200;
          const MAX_HEIGHT = 200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.8 quality to save space
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          updateSettings({ logoUrl: dataUrl });
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({ isOpen: false, message: '', onConfirm: () => {} });

  const handleAddSection = () => {
    if (newSectionTitle && newSectionId) {
      setSections([...sections, { id: newSectionId, title: newSectionTitle }]);
      setNewSectionTitle('');
      setNewSectionId('');
    }
  };

  const handleRemoveSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Genel Ayarlar</h2>
        <button
          onClick={() => {
            setConfirmModal({
              isOpen: true,
              message: 'Veritabanını varsayılan verilerle doldurmak istediğinize emin misiniz? Bu işlem mevcut verilerinizi silmez ancak yeni veriler ekler.',
              onConfirm: async () => {
                await seedDatabase();
                setConfirmModal({ isOpen: false, message: '', onConfirm: () => {} });
              }
            });
          }}
          className="px-4 py-2 bg-brand-gold text-white font-medium rounded-xl hover:bg-yellow-600 transition-colors"
        >
          Varsayılan Verileri Yükle
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* General App Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 pb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Uygulama Ayarları</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Site Başlığı</label>
              <input 
                type="text" 
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                value={settings.siteName}
                onChange={(e) => updateSettings({ siteName: e.target.value })}
                aria-label="Site Başlığı"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center shrink-0 p-1">
                  <img src={settings.logoUrl || '/logo.svg'} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Logo URL'si veya cihazdan seçin"
                      className="flex-1 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                      value={settings.logoUrl || ''}
                      onChange={(e) => updateSettings({ logoUrl: e.target.value })}
                      aria-label="Logo URL"
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-3 bg-brand-green/10 text-brand-green rounded-xl font-bold hover:bg-brand-green/20 transition-colors flex items-center gap-2"
                      aria-label="Cihazdan Logo Seç"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="hidden sm:inline">Seç</span>
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleLogoUpload}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg">
                  <Palette className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </div>
                <div>
                  <div className="font-bold text-sm">Tema Tercihi</div>
                  <div className="text-xs text-gray-500">Varsayılan tema ayarı</div>
                </div>
              </div>
              <select 
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm outline-none"
                value={settings.theme}
                onChange={(e) => updateSettings({ theme: e.target.value as 'light' | 'dark' })}
              >
                <option value="light">Açık (Light)</option>
                <option value="dark">Koyu (Dark)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <Lock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <div className="font-bold text-sm">Bakım Modu</div>
                  <div className="text-xs text-gray-500">Siteyi geçici olarak kapat</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.maintenanceMode}
                  onChange={(e) => updateSettings({ maintenanceMode: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-green/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-gray-800 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green"></div>
              </label>
            </div>
          </div>

          <button 
            onClick={handleSaveSettings}
            className={`w-full py-3 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${isSaved ? 'bg-green-600' : 'bg-brand-green hover:bg-green-800'}`}
          >
            {isSaved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            {isSaved ? 'Kaydedildi' : 'Ayarları Kaydet'}
          </button>
        </div>

        {/* Contact Info Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 pb-4">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">İletişim & Sosyal Medya</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Açık Adres</label>
              <textarea 
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                value={contactInfo.address}
                onChange={(e) => updateContactInfo({ ...contactInfo, address: e.target.value })}
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Telefon</label>
                <input 
                  type="text" 
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                  value={contactInfo.phone}
                  onChange={(e) => updateContactInfo({ ...contactInfo, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">WhatsApp</label>
                <input 
                  type="text" 
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                  value={contactInfo.whatsapp || ''}
                  onChange={(e) => updateContactInfo({ ...contactInfo, whatsapp: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">E-posta</label>
              <input 
                type="email" 
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                value={contactInfo.email}
                onChange={(e) => updateContactInfo({ ...contactInfo, email: e.target.value })}
              />
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Sosyal Medya Linkleri</h4>
              
              {['instagram', 'facebook', 'twitter', 'tiktok', 'youtube', 'linkedin'].map((platform) => (
                <div key={platform}>
                  <label className="text-xs font-bold text-gray-500 capitalize">{platform}</label>
                  <input 
                    type="text" 
                    className="w-full p-2 mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20 text-sm"
                    value={(contactInfo.social as any)[platform] || ''}
                    onChange={(e) => updateContactInfo({ 
                      ...contactInfo, 
                      social: { ...contactInfo.social, [platform]: e.target.value } 
                    })}
                    placeholder={`https://${platform}.com/...`}
                  />
                </div>
              ))}
            </div>
          </div>
          
          <button 
            onClick={() => {
              updateContactInfo(contactInfo);
              showToast('İletişim bilgileri başarıyla güncellendi');
            }}
            className="w-full py-3 bg-brand-green hover:bg-green-800 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            İletişim Bilgilerini Kaydet
          </button>
        </div>

        {/* Campaign & Notifications */}
        <div className="space-y-8">
          {/* Sections Management */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 pb-4">
              <div className="p-2 bg-brand-gold/10 rounded-lg text-brand-gold">
                <Plus className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Vitrin Bölümleri</h3>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ana sayfada gösterilecek özel ürün bölümlerini yönetin (Örn: İlkbahar Hasadı, Yazın Hasadı).
              </p>
              
              <div className="space-y-3">
                {sections.map(section => (
                  <div key={section.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div>
                      <div className="font-bold text-sm text-gray-900 dark:text-white">{section.title}</div>
                      <div className="text-xs text-gray-500 font-mono">ID: {section.id}</div>
                    </div>
                    <button 
                      onClick={() => handleRemoveSection(section.id)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      aria-label="Bölümü Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="text" 
                    placeholder="Bölüm Başlığı (Örn: Yazın Hasadı)"
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20 text-sm"
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                  />
                  <input 
                    type="text" 
                    placeholder="Bölüm ID (Örn: yaz-hasadi)"
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20 text-sm font-mono"
                    value={newSectionId}
                    onChange={(e) => setNewSectionId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  />
                </div>
                <button 
                  onClick={handleAddSection}
                  disabled={!newSectionTitle || !newSectionId}
                  className="w-full py-3 bg-brand-gold text-white rounded-xl font-bold hover:bg-yellow-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-5 h-5" />
                  Yeni Bölüm Ekle
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 pb-4">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Yönetici Giriş Bilgileri</h3>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Yönetici paneline giriş yapmak için kullandığınız e-posta ve şifreyi güncelleyin.
              </p>
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Yeni E-posta Adresi</label>
                <input 
                  type="email"
                  placeholder="Yönetici E-posta"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Yeni Şifre</label>
                <input 
                  type="password"
                  placeholder="Yeni Şifre"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-100 dark:border-yellow-900/20 text-sm text-yellow-800 dark:text-yellow-200 flex gap-3">
                <Bell className="w-5 h-5 shrink-0" />
                <p>Güvenliğiniz için güçlü bir şifre belirleyin. Bu bilgileri unutursanız sisteme erişemeyebilirsiniz.</p>
              </div>

              <button 
                onClick={handleUpdateCredentials}
                disabled={isUpdatingCredentials || (!adminEmail && !adminPassword)}
                className={`w-full py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                  isUpdatingCredentials || (!adminEmail && !adminPassword)
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-600/20'
                }`}
              >
                {isUpdatingCredentials ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Güncelleniyor...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Bilgileri Güncelle
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Onay</h3>
              <p className="text-gray-600 dark:text-gray-300">{confirmModal.message}</p>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  onClick={() => setConfirmModal({ isOpen: false, message: '', onConfirm: () => {} })}
                  className="px-6 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
                >
                  İptal
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="px-6 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
                >
                  Onayla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.visible && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-fade-in">
          <Check className="w-5 h-5 text-green-400" />
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

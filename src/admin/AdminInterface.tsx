import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Layout, Type, Image as ImageIcon, Save, CheckCircle } from 'lucide-react';

export function AdminInterface({ setActiveTab: setParentTab }: { setActiveTab?: (tab: string) => void }) {
  const { staticContent, updateStaticContent } = useData();
  const [interfaceData, setInterfaceData] = useState(staticContent.interface);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setInterfaceData(staticContent.interface);
  }, [staticContent.interface]);

  const handleSave = () => {
    updateStaticContent('interface', interfaceData);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 1500);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Arayüz Yönetimi</h2>
        <button 
          onClick={handleSave}
          className="bg-brand-green text-white px-6 py-2 rounded-xl flex items-center gap-2 hover:bg-green-800 transition-colors shadow-lg shadow-brand-green/20"
        >
          {isSaved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          {isSaved ? 'Kaydedildi' : 'Değişiklikleri Kaydet'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Hero Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 pb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
              <Layout className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Hero (Karşılama) Alanı</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Ana Başlık</label>
              <input 
                type="text" 
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                value={interfaceData.heroTitle}
                onChange={(e) => setInterfaceData({ ...interfaceData, heroTitle: e.target.value })}
                aria-label="Hero Ana Başlık"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Alt Başlık</label>
              <textarea 
                rows={3}
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20 resize-none"
                value={interfaceData.heroSubtitle}
                onChange={(e) => setInterfaceData({ ...interfaceData, heroSubtitle: e.target.value })}
                aria-label="Hero Alt Başlık"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Buton Metni</label>
              <input 
                type="text" 
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                value={interfaceData.heroButtonText}
                onChange={(e) => setInterfaceData({ ...interfaceData, heroButtonText: e.target.value })}
                aria-label="Hero Buton Metni"
              />
            </div>
          </div>
        </div>

        {/* Section Titles */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 pb-4">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600">
              <Type className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Bölüm Başlıkları</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Haftanın Ürünleri Başlığı</label>
              <input 
                type="text" 
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                value={interfaceData.featuredTitle}
                onChange={(e) => setInterfaceData({ ...interfaceData, featuredTitle: e.target.value })}
                aria-label="Haftanın Ürünleri Başlığı"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Mevsimlik Ürünler Başlığı</label>
              <input 
                type="text" 
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                value={interfaceData.seasonalTitle}
                onChange={(e) => setInterfaceData({ ...interfaceData, seasonalTitle: e.target.value })}
                aria-label="Mevsimlik Ürünler Başlığı"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Kategoriler Başlığı</label>
              <input 
                type="text" 
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                value={interfaceData.categoriesTitle}
                onChange={(e) => setInterfaceData({ ...interfaceData, categoriesTitle: e.target.value })}
                aria-label="Kategoriler Başlığı"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6 lg:col-span-2">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 pb-4">
            <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-600">
              <Type className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Footer (Alt Bilgi)</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Telif Hakkı Metni</label>
              <input 
                type="text" 
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                value={interfaceData.footerText}
                onChange={(e) => setInterfaceData({ ...interfaceData, footerText: e.target.value })}
                aria-label="Footer Metni"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

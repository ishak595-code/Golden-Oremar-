import React, { useState } from 'react';
import { useData, BlogPost, ProductHealthInfo } from '../context/DataContext';
import { STATIC_CONTENT } from '../data';
import { FileText, Edit, Plus, Trash2, Save, X, Image as ImageIcon, Check, Star, Box } from 'lucide-react';

export function AdminContent({ setActiveTab: setParentTab }: { setActiveTab?: (tab: string) => void }) {
  const { blogPosts, addBlogPost, updateBlogPost, deleteBlogPost, recipes, addRecipe, updateRecipe, deleteRecipe, productHealthInfo, updateProductHealthInfo, staticContent, updateStaticContent, contactInfo, updateContactInfo, heroCategories, updateHeroCategories, homeSections, updateHomeSections } = useData();
  const [activeTab, setActiveTabLocal] = useState<'blog' | 'recipes' | 'productHealth' | 'pages' | 'faq' | 'contact' | 'interface'>('blog');
  
  // Interface State
  const [interfaceHeroCategories, setInterfaceHeroCategories] = useState<any[]>(heroCategories || []);
  const [interfaceHomeSections, setInterfaceHomeSections] = useState<any[]>(homeSections || []);

  React.useEffect(() => {
    if (heroCategories?.length) setInterfaceHeroCategories(heroCategories);
    if (homeSections?.length) setInterfaceHomeSections(homeSections);
  }, [heroCategories, homeSections]);

  // Blog/Recipe State
  const [modalType, setModalType] = useState<'blog' | 'recipe'>('blog');
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [isBlogModalOpen, setIsBlogModalOpen] = useState(false);
  const [blogFormData, setBlogFormData] = useState<Partial<BlogPost>>({
    title: '', summary: '', content: '', image: '', date: ''
  });

  // Product Health State
  const [isProductHealthModalOpen, setIsProductHealthModalOpen] = useState(false);
  const [editingProductHealth, setEditingProductHealth] = useState<ProductHealthInfo | null>(null);
  const [productHealthFormData, setProductHealthFormData] = useState<Partial<ProductHealthInfo>>({
    productId: 0, title: '', content: ''
  });

  // Pages State
  const [selectedPage, setSelectedPage] = useState<keyof typeof STATIC_CONTENT>('about');
  const [pageContent, setPageContent] = useState(staticContent[selectedPage].content);
  const [pageTitle, setPageTitle] = useState(staticContent[selectedPage].title);

  // Contact State
  const [contactData, setContactData] = useState(contactInfo);

  const [toast, setToast] = useState<{message: string, visible: boolean}>({ message: '', visible: false });

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3000);
  };

  const handleOpenBlogModal = (type: 'blog' | 'recipe', post?: BlogPost) => {
    setModalType(type);
    if (post) {
      setEditingPost(post);
      setBlogFormData(post);
    } else {
      setEditingPost(null);
      setBlogFormData({
        title: '', summary: '', content: '', image: 'https://picsum.photos/seed/blog/800/600', date: new Date().toISOString().split('T')[0]
      });
    }
    setIsBlogModalOpen(true);
  };

  const handleSaveBlog = () => {
    if (modalType === 'blog') {
      if (editingPost) {
        updateBlogPost(editingPost.id, blogFormData);
      } else {
        addBlogPost({ id: Date.now(), ...blogFormData as BlogPost });
      }
    } else {
      if (editingPost) {
        updateRecipe(editingPost.id, blogFormData);
      } else {
        addRecipe({ id: Date.now(), ...blogFormData as BlogPost });
      }
    }
    setIsBlogModalOpen(false);
    showToast('İçerik başarıyla kaydedildi!');
  };

  const handleOpenProductHealthModal = (info?: ProductHealthInfo) => {
    if (info) {
      setEditingProductHealth(info);
      setProductHealthFormData(info);
    } else {
      setEditingProductHealth(null);
      setProductHealthFormData({ productId: Date.now(), title: '', content: '' });
    }
    setIsProductHealthModalOpen(true);
  };

  const handleSaveProductHealth = () => {
    if (productHealthFormData.productId) {
      updateProductHealthInfo(productHealthFormData.productId, productHealthFormData);
    }
    setIsProductHealthModalOpen(false);
    showToast('Ürün faydası kaydedildi!');
  };

  const handleSavePage = () => {
    updateStaticContent(selectedPage, { title: pageTitle, content: pageContent });
    showToast('Sayfa içeriği güncellendi!');
  };

  const handleSaveContact = () => {
    updateContactInfo(contactData);
    showToast('İletişim bilgileri güncellendi!');
  };

  const handleSaveInterface = () => {
    updateHeroCategories(interfaceHeroCategories);
    updateHomeSections(interfaceHomeSections);
    showToast('Ana sayfa arayüz ayarları başarıyla güncellendi!');
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto hide-scrollbar">
        <button 
          onClick={() => setActiveTabLocal('blog')}
          className={`pb-3 px-4 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'blog' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Sağlık Yazıları
        </button>
        <button 
          onClick={() => setActiveTabLocal('recipes')}
          className={`pb-3 px-4 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'recipes' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Tarifler
        </button>
        <button 
          onClick={() => setActiveTabLocal('productHealth')}
          className={`pb-3 px-4 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'productHealth' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Ürün Sağlık Bilgileri
        </button>
        <button 
          onClick={() => setActiveTabLocal('pages')}
          className={`pb-3 px-4 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'pages' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Sabit Sayfalar
        </button>
        <button 
          onClick={() => setActiveTabLocal('faq')}
          className={`pb-3 px-4 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'faq' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Sıkça Sorulan Sorular
        </button>
        <button 
          onClick={() => setActiveTabLocal('contact')}
          className={`pb-3 px-4 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'contact' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          İletişim Bilgileri
        </button>
        <button 
          onClick={() => setActiveTabLocal('interface')}
          className={`pb-3 px-4 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'interface' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Ana Sayfa / Arayüz
        </button>
      </div>

      {activeTab === 'blog' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => handleOpenBlogModal('blog')}
              className="bg-brand-green text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-green-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Yeni Sağlık Yazısı Ekle
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogPosts.map(post => (
              <div key={post.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden group">
                <div className="h-48 relative">
                  <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenBlogModal('blog', post)} aria-label="Düzenle" className="p-2 bg-white dark:bg-gray-800 text-blue-600 rounded-full shadow-sm hover:bg-blue-50 dark:hover:bg-gray-700"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => deleteBlogPost(post.id)} aria-label="Sil" className="p-2 bg-white dark:bg-gray-800 text-red-600 rounded-full shadow-sm hover:bg-red-50 dark:hover:bg-gray-700"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-xs text-gray-500 mb-2">{post.date}</div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">{post.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{post.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'recipes' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => handleOpenBlogModal('recipe')}
              className="bg-brand-green text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-green-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Yeni Tarif Ekle
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map(post => (
              <div key={post.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden group">
                <div className="h-48 relative">
                  <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenBlogModal('recipe', post)} aria-label="Düzenle" className="p-2 bg-white dark:bg-gray-800 text-blue-600 rounded-full shadow-sm hover:bg-blue-50 dark:hover:bg-gray-700"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => deleteRecipe(post.id)} aria-label="Sil" className="p-2 bg-white dark:bg-gray-800 text-red-600 rounded-full shadow-sm hover:bg-red-50 dark:hover:bg-gray-700"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-xs text-gray-500 mb-2">{post.date}</div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">{post.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{post.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'productHealth' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => handleOpenProductHealthModal()}
              className="bg-brand-green text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-green-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Yeni Ürün Sağlık Bilgisi Ekle
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {productHealthInfo.map(info => (
              <div key={info.productId} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden group p-4 relative">
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenProductHealthModal(info)} aria-label="Düzenle" className="p-2 bg-white dark:bg-gray-800 text-blue-600 rounded-full shadow-sm hover:bg-blue-50 dark:hover:bg-gray-700"><Edit className="w-4 h-4" /></button>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">{info.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{info.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'pages' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col md:flex-row min-h-[600px]">
          <div className="w-full md:w-64 border-r border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4 space-y-2">
            <h3 className="font-bold text-gray-500 text-xs uppercase mb-4 px-2">Sayfalar</h3>
            {Object.keys(staticContent).filter(key => !['faq', 'interface'].includes(key)).map((key) => (
              <button
                key={key}
                onClick={() => {
                  const pageData = staticContent[key as keyof typeof staticContent] as any;
                  setSelectedPage(key as keyof typeof staticContent);
                  setPageTitle(pageData.title || '');
                  setPageContent(pageData.content || '');
                }}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  selectedPage === key ? 'bg-white dark:bg-gray-800 shadow-sm text-brand-green' : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {key === 'about' ? 'Hakkımızda' : key === 'returns' ? 'İade Politikası' : key === 'privacy' ? 'Gizlilik Politikası' : key}
              </button>
            ))}
          </div>
          
          <div className="flex-1 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Sayfa Düzenle</h3>
              <button onClick={handleSavePage} className="flex items-center gap-2 bg-brand-green text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors">
                <Save className="w-4 h-4" />
                Kaydet
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Sayfa Başlığı</label>
              <input 
                type="text" 
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2 flex-1 flex flex-col">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">İçerik (HTML)</label>
              <textarea 
                className="w-full flex-1 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20 font-mono text-sm resize-none"
                value={pageContent}
                onChange={(e) => setPageContent(e.target.value)}
              />
              <p className="text-xs text-gray-500">HTML etiketleri kullanabilirsiniz (&lt;h3&gt;, &lt;p&gt;, &lt;ul&gt; vb.)</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'faq' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Sıkça Sorulan Sorular</h3>
            <button 
              onClick={() => {
                updateStaticContent('faq', staticContent.faq);
                showToast('Sıkça sorulan sorular güncellendi!');
              }} 
              className="flex items-center gap-2 bg-brand-green text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors"
            >
              <Save className="w-4 h-4" />
              Kaydet
            </button>
          </div>

          <div className="space-y-4">
            {staticContent.faq.map((item: any, index: number) => (
              <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl space-y-3 relative group">
                <button 
                  onClick={() => {
                    const newFaq = [...staticContent.faq];
                    newFaq.splice(index, 1);
                    updateStaticContent('faq', newFaq);
                  }}
                  className="absolute top-2 right-2 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Soru</label>
                  <input 
                    type="text" 
                    className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                    value={item.q}
                    onChange={(e) => {
                      const newFaq = [...staticContent.faq];
                      newFaq[index].q = e.target.value;
                      updateStaticContent('faq', newFaq);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Cevap</label>
                  <textarea 
                    rows={3}
                    className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20 resize-none"
                    value={item.a}
                    onChange={(e) => {
                      const newFaq = [...staticContent.faq];
                      newFaq[index].a = e.target.value;
                      updateStaticContent('faq', newFaq);
                    }}
                  />
                </div>
              </div>
            ))}
            
            <button 
              onClick={() => {
                updateStaticContent('faq', [...staticContent.faq, { q: 'Yeni Soru', a: 'Yeni Cevap' }]);
              }}
              className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500 hover:text-brand-green hover:border-brand-green hover:bg-brand-green/5 transition-colors flex items-center justify-center gap-2 font-bold"
            >
              <Plus className="w-5 h-5" />
              Yeni Soru Ekle
            </button>
          </div>
        </div>
      )}

      {activeTab === 'contact' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">İletişim Bilgileri</h3>
            <button onClick={handleSaveContact} className="flex items-center gap-2 bg-brand-green text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors">
              <Save className="w-4 h-4" />
              Kaydet
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Adres</label>
              <input 
                type="text" 
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none"
                value={contactData.address}
                onChange={(e) => setContactData({...contactData, address: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Telefon</label>
                <input 
                  type="text" 
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none"
                  value={contactData.phone}
                  onChange={(e) => setContactData({...contactData, phone: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">E-posta</label>
                <input 
                  type="email" 
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none"
                  value={contactData.email}
                  onChange={(e) => setContactData({...contactData, email: e.target.value})}
                />
              </div>
            </div>
            
            <h4 className="font-bold text-gray-900 dark:text-white pt-4 border-t border-gray-100 dark:border-gray-700">Sosyal Medya</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Instagram</label>
                <input 
                  type="text" 
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none"
                  value={contactData.social.instagram}
                  onChange={(e) => setContactData({...contactData, social: {...contactData.social, instagram: e.target.value}})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Facebook</label>
                <input 
                  type="text" 
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none"
                  value={contactData.social.facebook}
                  onChange={(e) => setContactData({...contactData, social: {...contactData.social, facebook: e.target.value}})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Twitter</label>
                <input 
                  type="text" 
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none"
                  value={contactData.social.twitter}
                  onChange={(e) => setContactData({...contactData, social: {...contactData.social, twitter: e.target.value}})}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'interface' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 max-w-4xl mx-auto space-y-8">
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-6">
            <div>
              <h3 className="text-2xl font-serif font-bold text-gray-900 dark:text-white">Ana Sayfa Yapısı Konfigürasyonu</h3>
              <p className="text-gray-500 mt-1">Hızlı kategorileri ve ana sayfa bölümlerini buradan düzenleyebilirsiniz.</p>
            </div>
            <button onClick={handleSaveInterface} className="flex items-center gap-2 bg-brand-green text-white px-6 py-2.5 rounded-xl hover:bg-green-800 transition-colors shadow-lg shadow-brand-green/20">
              <Save className="w-5 h-5" />
              Tüm Değişiklikleri Kaydet
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-gold" />
                Hızlı Kategoriler
              </h4>
              <button 
                onClick={() => {
                  setInterfaceHeroCategories([...interfaceHeroCategories, { id: 'new_cat_' + Date.now(), title: 'Yeni Kategori', subtitle: 'Açıklama', targetCategory: 'Yöresel İçecekler', icon: 'Star', image: 'https://picsum.photos/400' }]);
                }}
                className="text-sm text-brand-green hover:underline flex items-center gap-1 font-medium"
              >
                <Plus className="w-4 h-4" /> Kategori Ekle
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {interfaceHeroCategories.map((cat, idx) => (
                <div key={cat.id || idx} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl space-y-3 relative group bg-gray-50 dark:bg-gray-900/50">
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button onClick={() => {
                        if (idx > 0) {
                          const newArr = [...interfaceHeroCategories];
                          const temp = newArr[idx - 1];
                          newArr[idx - 1] = newArr[idx];
                          newArr[idx] = temp;
                          setInterfaceHeroCategories(newArr);
                        }
                      }} className="p-1.5 bg-white dark:bg-gray-800 text-gray-600 rounded-md shadow-sm">
                      ^
                    </button>
                    <button onClick={() => {
                        if (idx < interfaceHeroCategories.length - 1) {
                          const newArr = [...interfaceHeroCategories];
                          const temp = newArr[idx + 1];
                          newArr[idx + 1] = newArr[idx];
                          newArr[idx] = temp;
                          setInterfaceHeroCategories(newArr);
                        }
                      }} className="p-1.5 bg-white dark:bg-gray-800 text-gray-600 rounded-md shadow-sm">
                      v
                    </button>
                    <button onClick={() => {
                      const newArr = [...interfaceHeroCategories];
                      newArr.splice(idx, 1);
                      setInterfaceHeroCategories(newArr);
                    }} className="p-1.5 bg-white dark:bg-gray-800 text-red-600 rounded-md shadow-sm">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-4">
                    <img src={cat.image} className="w-16 h-16 rounded-lg object-cover" alt="" />
                    <div className="flex-1 space-y-2">
                       <input 
                         type="text" 
                         className="w-full text-sm p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none"
                         value={cat.title}
                         onChange={(e) => {
                           const newArr = [...interfaceHeroCategories];
                           newArr[idx].title = e.target.value;
                           setInterfaceHeroCategories(newArr);
                         }}
                         placeholder="Başlık"
                       />
                       <input 
                         type="text" 
                         className="w-full text-xs p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none"
                         value={cat.subtitle}
                         onChange={(e) => {
                           const newArr = [...interfaceHeroCategories];
                           newArr[idx].subtitle = e.target.value;
                           setInterfaceHeroCategories(newArr);
                         }}
                         placeholder="Bağlantı Alt Yazısı"
                       />
                       <input 
                         type="text" 
                         className="w-full text-xs p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none"
                         value={cat.targetCategory}
                         onChange={(e) => {
                           const newArr = [...interfaceHeroCategories];
                           newArr[idx].targetCategory = e.target.value;
                           setInterfaceHeroCategories(newArr);
                         }}
                         title="Yönlendirilecek kategori ismi (Örn: Yöresel İçecekler)"
                         placeholder="Hedef Kategori İsmi (Filtreleme için)"
                       />
                       <input 
                         type="text" 
                         className="w-full text-xs p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none"
                         value={cat.image}
                         onChange={(e) => {
                           const newArr = [...interfaceHeroCategories];
                           newArr[idx].image = e.target.value;
                           setInterfaceHeroCategories(newArr);
                         }}
                         placeholder="Görsel URL"
                       />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-700 w-full" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-brand-green" />
                Ana Sayfa Parçaları (Ürün Bölümleri)
              </h4>
              <button 
                onClick={() => {
                  setInterfaceHomeSections([...interfaceHomeSections, { id: 'new_section_' + Date.now(), title: 'Yeni Bölüm', active: true }]);
                }}
                className="text-sm text-brand-green hover:underline flex items-center gap-1 font-medium"
              >
                <Plus className="w-4 h-4" /> Bölüm Ekle
              </button>
            </div>
            
            <div className="space-y-3">
              {interfaceHomeSections.map((section, idx) => (
                <div key={section.id || idx} className="flex flex-col sm:flex-row items-start sm:items-center p-4 border border-gray-200 dark:border-gray-700 rounded-xl space-y-3 sm:space-y-0 gap-4 bg-gray-50 dark:bg-gray-900/50">
                  <div className="flex flex-col gap-1 w-full sm:w-1/4">
                    <label className="text-xs font-bold text-gray-500 uppercase">Bölüm ID (Sistem)</label>
                    <input 
                      type="text" 
                      className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none text-xs font-mono"
                      value={section.id}
                      onChange={(e) => {
                         const newArr = [...interfaceHomeSections];
                         newArr[idx].id = e.target.value;
                         setInterfaceHomeSections(newArr);
                      }}
                      placeholder="Örn: featured"
                    />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Görünen Başlık</label>
                    <input 
                      type="text" 
                      className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none text-sm font-bold"
                      value={section.title}
                      onChange={(e) => {
                         const newArr = [...interfaceHomeSections];
                         newArr[idx].title = e.target.value;
                         setInterfaceHomeSections(newArr);
                      }}
                      placeholder="Örn: En Çok Satanlar"
                    />
                  </div>
                  <div className="flex items-center gap-4 min-w-[120px]">
                    <label className="flex items-center gap-2 text-sm cursor-pointer border p-2 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
                      <input 
                        type="checkbox" 
                        checked={section.active !== false}
                        onChange={(e) => {
                           const newArr = [...interfaceHomeSections];
                           newArr[idx].active = e.target.checked;
                           setInterfaceHomeSections(newArr);
                        }}
                        className="rounded border-gray-300 text-brand-green focus:ring-brand-green"
                      />
                      Görünür
                    </label>
                    <button onClick={() => {
                        const newArr = [...interfaceHomeSections];
                        newArr.splice(idx, 1);
                        setInterfaceHomeSections(newArr);
                    }} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-gray-500 bg-blue-50/50 p-3 rounded-lg border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800">
                Lütfen ürünleri yeni bölümlere aktarmak için <strong>Ürün Gösterge Paneli</strong>'nden ürün düzenleme menüsüne gidin ve <strong>Ana Sayfa Bölümü</strong> (homeSection) değerini bağlamak istediğiniz "Bölüm ID"sine (Örn: <code>featured</code>) ayarlayın.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Blog Modal */}
      {isBlogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editingPost ? 'Yazıyı Düzenle' : 'Yeni Yazı Ekle'}</h3>
              <button onClick={() => setIsBlogModalOpen(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Başlık</label>
                <input type="text" className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none" value={blogFormData.title} onChange={e => setBlogFormData({...blogFormData, title: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Özet</label>
                <textarea rows={2} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none resize-none" value={blogFormData.summary} onChange={e => setBlogFormData({...blogFormData, summary: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">İçerik</label>
                <textarea rows={6} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none resize-none" value={blogFormData.content} onChange={e => setBlogFormData({...blogFormData, content: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Görsel URL</label>
                <input type="text" className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none" value={blogFormData.image} onChange={e => setBlogFormData({...blogFormData, image: e.target.value})} />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
              <button onClick={() => setIsBlogModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">İptal</button>
              <button onClick={handleSaveBlog} className="px-6 py-3 rounded-xl font-bold bg-brand-green text-white hover:bg-green-800 transition-colors shadow-lg">Kaydet</button>
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

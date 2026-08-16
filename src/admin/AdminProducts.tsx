import React, { useState, useRef, useEffect } from 'react';
import { useData, Product } from '../context/DataContext';
import { Plus, Edit, Trash2, Search, X, Upload, Image as ImageIcon, Video, FileText, List, Tag, MapPin, Scale, Package, Check, AlertCircle, RefreshCw } from 'lucide-react';

export function AdminProducts({ setActiveTab: setParentTab, initialView = 'all' }: { setActiveTab?: (tab: string) => void, initialView?: 'all' | 'pending' }) {
  const { products, addProduct, updateProduct, deleteProduct, categories, currentUser, seedDatabase, addNotification } = useData();
  const pendingProducts = products.filter(p => !p.is_approved && !p.is_rejected);
  const [activeView, setActiveView] = useState<'all' | 'pending'>(initialView);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    const syncMissing = async () => {
      const hasAddedV9 = localStorage.getItem('hasAddedMissingProducts_V9_admin');
      if (!hasAddedV9) {
         localStorage.setItem('hasAddedMissingProducts_V9_admin', 'true');
         const existingNames = products.map(p => p.name);
         // Import PRODUCTS dynamically from data.ts
         import('../data').then(({ PRODUCTS }) => {
           const missing = PRODUCTS.filter(p => !existingNames.includes(p.name));
           if (missing.length > 0) {
             missing.forEach(m => {
               const finalData = { ...m, is_approved: true, categoryId: m.category };
               try {
                 addProduct(finalData as any);
               } catch (e) {
                 console.error("Error auto-adding missing product:", e);
               }
             });
           }
         });
      }
    };
    
    if (products.length > 0) {
      syncMissing();
    }
  }, [products, addProduct]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({ price: '', stock: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<{message: string, visible: boolean}>({ message: '', visible: false });
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({ isOpen: false, message: '', onConfirm: () => {} });

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3000);
  };

  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = async (id: string, status: 'approve' | 'reject') => {
    try {
      const prod = products.find(p => p.id === id);
      const vId = prod?.vendor_id || prod?.vendorId;

      if (status === 'approve') {
        await updateProduct(id, { is_approved: true, is_rejected: false, rejection_reason: null });
        showToast('Ürün onaylandı.');
        if (vId && vId !== 'admin') {
           addNotification({
              userId: vId,
              message: `Önemli: "${prod?.name}" adlı ürününüz sistem yöneticisi tarafından onaylandı ve mağazanızda yayınlandı.`,
              type: 'system'
           });
        }
      } else {
        if (!rejectReason.trim()) {
           showToast('Lütfen ret nedenini belirtin.');
           return;
        }
        await updateProduct(id, { is_approved: false, is_rejected: true, rejection_reason: rejectReason });
        showToast('Ürün reddedildi.');
        if (vId && vId !== 'admin') {
           addNotification({
              userId: vId,
              message: `Uyarı: "${prod?.name}" adlı ürününüz reddedildi. Sebep: ${rejectReason}`,
              type: 'system'
           });
        }
      }
      setIsApproveModalOpen(false);
      setRejectReason('');
    } catch (error) {
      console.error('Error approving product:', error);
    }
  };

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    price: 0,
    category: '',
    homeSection: '',
    description: '',
    stock: 0,
    image: '',
    video: '',
    gallery: [],
    tags: [],
    features: [],
    section: 'regular',
    producer: '',
    story: '',
    origin: '',
    unit: 'adet',
    weight: 0,
    pricePrefix: '',
    preOrder: false,
    preOrderTime: ''
  });

  const [featureInput, setFeatureInput] = useState('');
  const [weightLabelInput, setWeightLabelInput] = useState('');
  const [weightPriceInput, setWeightPriceInput] = useState('');
  const [cutLabelInput, setCutLabelInput] = useState('');
  const [mediaPreview, setMediaPreview] = useState<{ type: 'image' | 'video', url: string }[]>([]);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
      // Initialize media preview from product data
      const previews: { type: 'image' | 'video', url: string }[] = [];
      if (product.image) previews.push({ type: 'image', url: product.image });
      if (product.gallery) {
        product.gallery.forEach(img => {
          if (img !== product.image) previews.push({ type: 'image', url: img });
        });
      }
      if (product.video) previews.push({ type: 'video', url: product.video });
      setMediaPreview(previews);
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        price: 0,
        category: categories[0]?.name || '',
        homeSection: '',
        description: '',
        stock: 0,
        image: '',
        video: '',
        gallery: [],
        tags: [],
        features: [],
        section: 'regular',
        producer: '',
        story: '',
        origin: '',
        unit: 'adet',
        weight: 0,
        pricePrefix: '',
        preOrder: false,
        preOrderTime: '',
        weightOptions: [],
        cutOptions: []
      });
      setMediaPreview([]);
    }
    setFeatureInput('');
    setWeightLabelInput('');
    setWeightPriceInput('');
    setCutLabelInput('');
    setIsModalOpen(true);
  };

  const handleSave = () => {
    // Map media preview back to formData
    const images = mediaPreview.filter(m => m.type === 'image').map(m => m.url);
    const videos = mediaPreview.filter(m => m.type === 'video').map(m => m.url);

    const finalData = {
      ...formData,
      image: images[0] || 'https://picsum.photos/seed/new/800/600', // Default image if none
      gallery: images,
      video: videos[0] || ''
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, finalData);
      showToast('Ürün başarıyla güncellendi.');
    } else {
      addProduct({
        ...finalData as Omit<Product, 'id'>,
        rating: 0,
        reviews: 0,
        originalPrice: (finalData.price || 0) * 1.2 // Mock logic
      });
      showToast('Ürün başarıyla eklendi.');
    }
    setIsModalOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newPreviews = [...mediaPreview];
      // Limit to 10 items total
      const remainingSlots = 10 - newPreviews.length;
      
      if (remainingSlots <= 0) {
        showToast("En fazla 10 adet medya yükleyebilirsiniz.");
        return;
      }

      const filesToProcess = Array.from(files).slice(0, remainingSlots);

      filesToProcess.forEach((file: File) => {
        const url = URL.createObjectURL(file);
        const type = file.type.startsWith('video') ? 'video' : 'image';
        newPreviews.push({ type, url });
      });
      setMediaPreview(newPreviews);
    }
  };

  const removeMedia = (index: number) => {
    setMediaPreview(mediaPreview.filter((_, i) => i !== index));
  };

  const addFeature = () => {
    if (featureInput.trim()) {
      setFormData({
        ...formData,
        features: [...(formData.features || []), featureInput.trim()]
      });
      setFeatureInput('');
    }
  };

  const removeFeature = (index: number) => {
    setFormData({
      ...formData,
      features: (formData.features || []).filter((_, i) => i !== index)
    });
  };

  const addWeightOption = () => {
    if (weightLabelInput.trim() && weightPriceInput.trim()) {
      setFormData({
        ...formData,
        weightOptions: [...(formData.weightOptions || []), { label: weightLabelInput.trim(), price: Number(weightPriceInput) }] as any
      });
      setWeightLabelInput('');
      setWeightPriceInput('');
    }
  };

  const removeWeightOption = (index: number) => {
    setFormData({
      ...formData,
      weightOptions: (formData.weightOptions || []).filter((_: any, i: number) => i !== index) as any
    });
  };

  const addCutOption = () => {
    if (cutLabelInput.trim()) {
      setFormData({
        ...formData,
        cutOptions: [...(formData.cutOptions || []), { label: cutLabelInput.trim() }] as any
      });
      setCutLabelInput('');
    }
  };

  const removeCutOption = (index: number) => {
    setFormData({
      ...formData,
      cutOptions: (formData.cutOptions || []).filter((_: any, i: number) => i !== index) as any
    });
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const matchesStock = stockFilter === 'all' || 
                         (stockFilter === 'in_stock' && p.stock > 10) ||
                         (stockFilter === 'low_stock' && p.stock > 0 && p.stock <= 10) ||
                         (stockFilter === 'out_of_stock' && p.stock === 0);
    const matchesApproval = approvalFilter === 'all' || 
                            (approvalFilter === 'approved' && p.is_approved) ||
                            (approvalFilter === 'pending' && !p.is_approved && !p.is_rejected) ||
                            (approvalFilter === 'rejected' && p.is_rejected);
    
    if (currentUser?.role === 'vendor') {
      return matchesSearch && matchesCategory && matchesStock && matchesApproval && (p.vendor_id === currentUser.id || p.vendorId === currentUser.id);
    }
    return matchesSearch && matchesCategory && matchesStock && matchesApproval;
  });

  const handleSelectProduct = (id: string) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  const handleBulkEdit = async () => {
    try {
      const updates: any = {};
      if (bulkEditData.price) updates.price = Number(bulkEditData.price);
      if (bulkEditData.stock) updates.stock = Number(bulkEditData.stock);
      
      if (Object.keys(updates).length > 0) {
        await Promise.all(selectedProducts.map(id => updateProduct(id, updates)));
        showToast('Seçili ürünler güncellendi.');
        setIsBulkEditModalOpen(false);
        setSelectedProducts([]);
        setBulkEditData({ price: '', stock: '' });
      }
    } catch (error) {
      console.error('Error bulk updating products:', error);
    }
  };

  const handleBulkDelete = async () => {
    setConfirmModal({
      isOpen: true,
      message: 'Seçili ürünleri silmek istediğinize emin misiniz?',
      onConfirm: async () => {
        try {
          await Promise.all(selectedProducts.map(id => deleteProduct(id)));
          showToast('Seçili ürünler silindi.');
          setSelectedProducts([]);
          setConfirmModal({ isOpen: false, message: '', onConfirm: () => {} });
        } catch (error) {
          console.error('Error bulk deleting products:', error);
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Ürün Yönetimi</h2>
        <div className="flex items-center gap-4">
          {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              <button 
                onClick={() => setActiveView('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === 'all' ? 'bg-white dark:bg-gray-700 text-brand-green shadow-sm' : 'text-gray-500'
                }`}
              >
                Tüm Ürünler
              </button>
              <button 
                onClick={() => setActiveView('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                  activeView === 'pending' ? 'bg-white dark:bg-gray-700 text-brand-green shadow-sm' : 'text-gray-500'
                }`}
              >
                Onay Bekleyenler
                {pendingProducts.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white dark:border-gray-800">
                    {pendingProducts.length}
                  </span>
                )}
              </button>
            </div>
          )}
          {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
            <button 
              onClick={() => {
                setConfirmModal({
                  isOpen: true,
                  message: 'Eski ürünleri silip varsayılan ürünleri yüklemek istediğinize emin misiniz?',
                  onConfirm: () => {
                    seedDatabase();
                    showToast('Veritabanı başarıyla sıfırlandı ve varsayılan ürünler yüklendi.');
                    setConfirmModal({ isOpen: false, message: '', onConfirm: () => {} });
                  }
                });
              }}
              className="bg-amber-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-amber-600 transition-colors"
              aria-label="Veritabanını Sıfırla"
            >
              <RefreshCw className="w-5 h-5" />
              Veritabanını Sıfırla
            </button>
          )}
          <button 
            onClick={() => handleOpenModal()}
            className="bg-brand-green text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-green-800 transition-colors"
            aria-label="Yeni Ürün Ekle"
          >
            <Plus className="w-5 h-5" />
            Yeni Ürün Ekle
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Ürün Ara..." 
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">Tüm Kategoriler</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select 
          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20"
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
        >
          <option value="all">Tüm Stok Durumları</option>
          <option value="in_stock">Stokta Var (&gt;10)</option>
          <option value="low_stock">Az Kaldı (1-10)</option>
          <option value="out_of_stock">Tükendi (0)</option>
        </select>
        {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
          <select 
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20"
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value)}
          >
            <option value="all">Tüm Onay Durumları</option>
            <option value="approved">Onaylı</option>
            <option value="pending">Onay Bekleyen</option>
            <option value="rejected">Reddedilenler</option>
          </select>
        )}
      </div>

      {selectedProducts.length > 0 && (
        <div className="bg-brand-green/10 border border-brand-green/20 rounded-xl p-4 flex items-center justify-between mb-6">
          <span className="text-brand-green font-medium">{selectedProducts.length} ürün seçildi</span>
          <div className="flex gap-3">
            <button 
              onClick={() => setIsBulkEditModalOpen(true)}
              className="px-4 py-2 bg-white dark:bg-gray-800 text-brand-green rounded-lg text-sm font-medium border border-brand-green/20 hover:bg-brand-green/5 dark:hover:bg-brand-green/10"
            >
              Toplu Düzenle
            </button>
            <button 
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-200 hover:bg-red-100"
            >
              Toplu Sil
            </button>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 font-medium border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4">
                  <input 
                    type="checkbox" 
                    checked={selectedProducts.length === (activeView === 'all' ? filteredProducts.length : pendingProducts.length) && (activeView === 'all' ? filteredProducts.length : pendingProducts.length) > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-brand-green focus:ring-brand-green"
                  />
                </th>
                <th className="px-6 py-4">Ürün</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Fiyat</th>
                <th className="px-6 py-4">Stok</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {(activeView === 'all' ? filteredProducts : pendingProducts).map(product => (
                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => handleSelectProduct(product.id)}
                      className="rounded border-gray-300 text-brand-green focus:ring-brand-green"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={product.image} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{product.name}</div>
                        {product.store_name && (
                          <div className="text-[10px] text-gray-400 font-medium italic">Satıcı: {product.store_name}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{product.category}</td>
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">₺{product.price.toLocaleString('tr-TR')}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                      product.stock > 10 ? 'bg-green-100 text-green-700' :
                      product.stock > 0 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {Number(product.stock) || 0} adet
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {product.is_approved ? (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs font-bold">
                        <Check className="w-3 h-3" /> Onaylı
                      </span>
                    ) : product.is_rejected ? (
                      <div className="flex flex-col items-start gap-1">
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-lg text-xs font-bold" title={product.rejection_reason}>
                          <X className="w-3 h-3" /> Reddedildi
                        </span>
                        {product.rejection_reason && (
                          <span className="text-[10px] text-red-500 max-w-[120px] truncate" title={product.rejection_reason}>
                            {product.rejection_reason}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg text-xs font-bold">
                        <AlertCircle className="w-3 h-3" /> Bekliyor
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {activeView === 'pending' && (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') ? (
                        <button 
                          onClick={() => {
                            setSelectedProduct(product);
                            setIsApproveModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
                        >
                          İncele
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleOpenModal(product)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteProduct(product.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(activeView === 'all' ? filteredProducts : pendingProducts).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Ürün bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Edit Modal */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Toplu Düzenleme ({selectedProducts.length} Ürün)</h3>
              <button onClick={() => setIsBulkEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Yeni Fiyat (₺)</label>
                <input 
                  type="number" 
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20"
                  value={bulkEditData.price}
                  onChange={(e) => setBulkEditData({...bulkEditData, price: e.target.value})}
                  placeholder="Değiştirmek istemiyorsanız boş bırakın"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Yeni Stok Miktarı</label>
                <input 
                  type="number" 
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20"
                  value={bulkEditData.stock}
                  onChange={(e) => setBulkEditData({...bulkEditData, stock: e.target.value})}
                  placeholder="Değiştirmek istemiyorsanız boş bırakın"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  onClick={() => setIsBulkEditModalOpen(false)}
                  className="px-6 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
                >
                  İptal
                </button>
                <button 
                  onClick={handleBulkEdit}
                  className="px-6 py-2 rounded-xl bg-brand-green text-white hover:bg-green-800 transition-colors font-medium"
                >
                  Uygula
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {isApproveModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Ürün Başvurusu İnceleme</h3>
              <button onClick={() => setIsApproveModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="p-8 overflow-y-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100">
                  <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Ürün Adı</label>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedProduct.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase">Fiyat</label>
                      <p className="text-xl font-bold text-brand-gold">{Number(selectedProduct.price) || 0} ₺</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase">Stok</label>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{Number(selectedProduct.stock) || 0} {selectedProduct.unit}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Satıcı</label>
                    <p className="text-emerald-600 font-bold">{selectedProduct.store_name}</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Kategori</label>
                    <p className="text-gray-900 dark:text-white">{selectedProduct.category}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl">
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Açıklama</label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {selectedProduct.description}
                  </p>
                </div>
                
                {selectedProduct.features && selectedProduct.features.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Özellikler</label>
                    <div className="flex flex-wrap gap-2">
                      {selectedProduct.features.map((f: string, i: number) => (
                        <span key={i} className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col gap-4">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reddetme nedenini buraya yazın (reddedilecekse zorunludur)..."
                className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                rows={3}
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => handleApprove(selectedProduct.id, 'reject')}
                  className="px-6 py-3 rounded-2xl text-red-600 font-bold hover:bg-red-50 transition-colors"
                >
                  Ürünü Reddet
                </button>
                <button
                  onClick={() => handleApprove(selectedProduct.id, 'approve')}
                  className="px-8 py-3 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-lg"
                >
                  Onayla ve Yayınla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-4 max-h-[95vh]">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingProduct ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700" aria-label="Kapat">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto space-y-8">
              
              {/* Media Gallery Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-lg">
                    <ImageIcon className="w-5 h-5 text-brand-green" />
                    Medya Galerisi <span className="text-sm font-normal text-gray-500">({mediaPreview.length}/10)</span>
                  </h4>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-brand-green/10 text-brand-green rounded-lg font-bold hover:bg-brand-green/20 transition-colors flex items-center gap-2"
                    aria-label="Medya Ekle"
                    disabled={mediaPreview.length >= 10}
                  >
                    <Upload className="w-4 h-4" />
                    Medya Ekle
                  </button>
                  <input 
                    type="file" 
                    multiple 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*,video/*" 
                    onChange={handleFileUpload}
                  />
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {/* Upload Placeholder */}
                  {mediaPreview.length < 10 && (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-brand-green hover:text-brand-green transition-colors"
                      aria-label="Medya Ekle Butonu"
                    >
                      <Plus className="w-8 h-8 mb-2" />
                      <span className="text-sm font-medium">Ekle</span>
                    </button>
                  )}

                  {/* Media Items */}
                  {mediaPreview.map((media, idx) => (
                    <div key={idx} className="relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden group border border-gray-200 dark:border-gray-600">
                      {media.type === 'image' ? (
                        <img src={media.url} alt={`Ürün Görseli ${idx + 1}`} className="w-full h-full object-cover" />
                      ) : (
                        <video src={media.url} className="w-full h-full object-cover" aria-label={`Ürün Videosu ${idx + 1}`} />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                         <button 
                          onClick={() => removeMedia(idx)}
                          className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                          title="Kaldır"
                          aria-label={`Medyayı Kaldır ${idx + 1}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded-md backdrop-blur-sm">
                        {media.type === 'video' ? 'Video' : idx === 0 ? 'Kapak' : 'Görsel'}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500">İlk görsel ürün kapak fotoğrafı olarak kullanılacaktır. En fazla 10 adet medya yükleyebilirsiniz.</p>
              </div>

              <hr className="border-gray-100 dark:border-gray-700" />

              {/* Main Form Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column: Identity & Pricing */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-brand-green" />
                      Ürün Kimliği
                    </h4>
                    
                    <div className="space-y-2">
                      <label htmlFor="productName" className="text-sm font-bold text-gray-700 dark:text-gray-300">Ürün Adı</label>
                      <input 
                        id="productName"
                        type="text" 
                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="Örn: Organik Çiçek Balı"
                        aria-label="Ürün Adı"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="productCategory" className="text-sm font-bold text-gray-700 dark:text-gray-300">Kategori</label>
                        <select 
                          id="productCategory"
                          className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20"
                          value={formData.category}
                          onChange={e => setFormData({...formData, category: e.target.value})}
                          aria-label="Kategori Seç"
                        >
                          <option value="" disabled>Kategori Seçin</option>
                          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="homeSection" className="text-sm font-bold text-gray-700 dark:text-gray-300">Ana Sayfa Bölümü (Vitrin) - İsteğe Bağlı</label>
                        <select 
                          id="homeSection"
                          className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20"
                          value={formData.homeSection || ''}
                          onChange={e => setFormData({...formData, homeSection: e.target.value})}
                          aria-label="Ana Sayfa Bölümü Seç"
                        >
                          <option value="">(Belirtilmemiş - Sadece Kategori İle Eşleşsin)</option>
                          <option value="featured">Concierge Seçimleri (VIP)</option>
                          <option value="natural">Doğal Seçimler</option>
                          <option value="seasonal">Sınırlı Üretim / Dağ Serisi</option>
                          <option value="best_sellers">En Çok Satanlar</option>
                          <option value="new_arrivals">Yeni Gelenler</option>
                          <option value="offers">Avantajlı Paketler</option>
                        </select>

                      </div>
                      <div className="space-y-2">
                        <label htmlFor="productProducer" className="text-sm font-bold text-gray-700 dark:text-gray-300">Üretici / Marka</label>
                        <input 
                          id="productProducer"
                          type="text" 
                          className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20"
                          value={formData.producer || ''}
                          onChange={e => setFormData({...formData, producer: e.target.value})}
                          placeholder="Örn: Yerel Çiftçi Kooperatifi"
                          aria-label="Üretici"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="productOrigin" className="text-sm font-bold text-gray-700 dark:text-gray-300">Menşei (Bölge/Şehir)</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                          id="productOrigin"
                          type="text" 
                          className="w-full pl-10 pr-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20"
                          value={formData.origin || ''}
                          onChange={e => setFormData({...formData, origin: e.target.value})}
                          placeholder="Örn: Muğla, Türkiye"
                          aria-label="Menşei"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Tag className="w-5 h-5 text-brand-green" />
                      Fiyatlandırma & Stok
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="productPrice" className="text-sm font-bold text-gray-700 dark:text-gray-300">Satış Fiyatı (₺)</label>
                        <input 
                          id="productPrice"
                          type="number" 
                          className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20 font-mono text-lg"
                          value={formData.price === 0 ? '' : formData.price}
                          onChange={e => setFormData({...formData, price: e.target.value === '' ? 0 : Number(e.target.value)})}
                          placeholder="0.00"
                          aria-label="Satış Fiyatı"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="productStock" className="text-sm font-bold text-gray-700 dark:text-gray-300">Stok Adedi</label>
                        <input 
                          id="productStock"
                          type="number" 
                          className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20 font-mono"
                          value={formData.stock === 0 ? '' : formData.stock}
                          onChange={e => setFormData({...formData, stock: e.target.value === '' ? 0 : Number(e.target.value)})}
                          placeholder="0"
                          aria-label="Stok Adedi"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="pricePrefix" className="text-sm font-bold text-gray-700 dark:text-gray-300">Fiyat Öneki (Örn: 'Başlayan' vb.)</label>
                        <input 
                          id="pricePrefix"
                          type="text" 
                          className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20"
                          value={formData.pricePrefix || ''}
                          onChange={e => setFormData({...formData, pricePrefix: e.target.value})}
                          placeholder="Boş bırakılabilir"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="preOrder" className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <input 
                            id="preOrder"
                            type="checkbox" 
                            className="rounded border-gray-300 text-brand-green focus:ring-brand-green w-4 h-4"
                            checked={formData.preOrder || false}
                            onChange={e => setFormData({...formData, preOrder: e.target.checked})}
                          />
                          Ön Siparişe Açık
                        </label>
                        {formData.preOrder && (
                          <input 
                            type="text" 
                            className="w-full mt-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20"
                            value={formData.preOrderTime || ''}
                            onChange={e => setFormData({...formData, preOrderTime: e.target.value})}
                            placeholder="Tahmini Teslim Süresi (Örn: Kasım ayı)"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="productUnit" className="text-sm font-bold text-gray-700 dark:text-gray-300">Birim</label>
                        <div className="relative">
                          <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <select 
                            id="productUnit"
                            className="w-full pl-10 pr-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20 appearance-none"
                            value={formData.unit || 'adet'}
                            onChange={e => setFormData({...formData, unit: e.target.value})}
                            aria-label="Birim Seç"
                          >
                            <option value="adet">Adet</option>
                            <option value="kg">Kilogram (kg)</option>
                            <option value="gr">Gram (gr)</option>
                            <option value="lt">Litre (lt)</option>
                            <option value="paket">Paket</option>
                            <option value="kavanoz">Kavanoz</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="productWeight" className="text-sm font-bold text-gray-700 dark:text-gray-300">Miktar / Ağırlık</label>
                        <div className="relative">
                          <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input 
                            id="productWeight"
                            type="number" 
                            className="w-full pl-10 pr-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20"
                            value={formData.weight === 0 ? '' : formData.weight}
                            onChange={e => setFormData({...formData, weight: e.target.value === '' ? 0 : Number(e.target.value)})}
                            placeholder="0.5"
                            aria-label="Ağırlık"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="productDescription" className="text-sm font-bold text-gray-700 dark:text-gray-300">Ürün Açıklaması</label>
                    <textarea 
                      id="productDescription"
                      rows={4}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20"
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      placeholder="Ürün hakkında detaylı bilgi..."
                      aria-label="Ürün Açıklaması"
                    />
                  </div>
                </div>

                {/* Right Column: Details & Settings */}
                <div className="space-y-6">
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <List className="w-5 h-5 text-brand-green" />
                      Ayarlar
                    </h4>

                    <div className="space-y-2">
                      <label htmlFor="productSection" className="text-sm font-bold text-gray-700 dark:text-gray-300">Vitrin Bölümü</label>
                      <select 
                        id="productSection"
                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20"
                        value={formData.section || 'regular'}
                        onChange={e => setFormData({...formData, section: e.target.value})}
                        aria-label="Vitrin Bölümü Seç"
                      >
                        <option value="regular">Standart Liste</option>
                        <option value="featured">Haftanın Ürünü (Öne Çıkan)</option>
                        <option value="seasonal">Mevsimin En İyileri</option>
                        <option value="bestseller">Çok Satanlar</option>
                        <option value="new">Yeni Hasat</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="productTags" className="text-sm font-bold text-gray-700 dark:text-gray-300">Etiketler</label>
                      <div className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                        <Tag className="w-4 h-4 text-gray-400" />
                        <input 
                          id="productTags"
                          type="text" 
                          placeholder="Örn: taze, organik"
                          className="flex-1 bg-transparent outline-none min-w-0"
                          value={formData.tags?.join(', ')}
                          onChange={e => setFormData({...formData, tags: e.target.value.split(',').map(t => t.trim())})}
                          aria-label="Etiketler"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-brand-green" />
                      Hikaye & Özellikler
                    </h4>

                    <div className="space-y-2">
                      <label htmlFor="productStory" className="text-sm font-bold text-gray-700 dark:text-gray-300">Ürün Hikayesi</label>
                      <textarea 
                        id="productStory"
                        rows={4}
                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20 resize-none text-sm"
                        value={formData.story || ''}
                        onChange={e => setFormData({...formData, story: e.target.value})}
                        placeholder="Bu ürünün özel bir hikayesi var mı?"
                        aria-label="Ürün Hikayesi"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="featureInput" className="text-sm font-bold text-gray-700 dark:text-gray-300">Özellikler</label>
                      <div className="flex gap-2">
                        <input 
                          id="featureInput"
                          type="text" 
                          className="flex-1 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20 text-sm"
                          value={featureInput}
                          onChange={e => setFeatureInput(e.target.value)}
                          placeholder="Örn: Glutensiz"
                          onKeyDown={e => e.key === 'Enter' && addFeature()}
                          aria-label="Özellik Ekle"
                        />
                        <button 
                          onClick={addFeature}
                          className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                          aria-label="Özellik Ekle Butonu"
                        >
                          Ekle
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.features?.map((feature, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-xs font-medium shadow-sm">
                            {feature}
                            <button onClick={() => removeFeature(idx)} className="hover:text-red-500" aria-label={`${feature} özelliğini kaldır`}>
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <div className="space-y-2">
                        <label htmlFor="weightLabelInput" className="text-sm font-bold text-gray-700 dark:text-gray-300">Ağırlık Varyasyonları (İsteğe Bağlı)</label>
                        <div className="flex flex-wrap sm:flex-nowrap gap-2">
                          <input 
                            id="weightLabelInput"
                            type="text" 
                            className="flex-[2] p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20 text-sm"
                            value={weightLabelInput}
                            onChange={e => setWeightLabelInput(e.target.value)}
                            placeholder="Örn: 500g, 1kg"
                          />
                          <input 
                            id="weightPriceInput"
                            type="number" 
                            className="flex-1 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20 text-sm"
                            value={weightPriceInput}
                            onChange={e => setWeightPriceInput(e.target.value)}
                            placeholder="Fiyat (₺)"
                            onKeyDown={e => e.key === 'Enter' && addWeightOption()}
                          />
                          <button 
                            onClick={addWeightOption}
                            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                          >
                            Ekle
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.weightOptions?.map((opt: any, idx: number) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-xs font-medium shadow-sm">
                              {opt.label || opt} ({opt.price ? opt.price + ' ₺' : '-'})
                              <button onClick={() => removeWeightOption(idx)} className="hover:text-red-500">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-2 mt-4">
                        <label htmlFor="cutLabelInput" className="text-sm font-bold text-gray-700 dark:text-gray-300">Kesim/Dilimleme Seçenekleri (İsteğe Bağlı)</label>
                        <div className="flex gap-2">
                          <input 
                            id="cutLabelInput"
                            type="text" 
                            className="flex-1 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-brand-green/20 text-sm"
                            value={cutLabelInput}
                            onChange={e => setCutLabelInput(e.target.value)}
                            placeholder="Örn: Bütün Gelsin, Kuşbaşı Doğransın"
                            onKeyDown={e => e.key === 'Enter' && addCutOption()}
                          />
                          <button 
                            onClick={addCutOption}
                            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                          >
                            Ekle
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.cutOptions?.map((opt: any, idx: number) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-xs font-medium shadow-sm">
                              {opt.label || opt}
                              <button onClick={() => removeCutOption(idx)} className="hover:text-red-500">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 sticky bottom-0 z-10">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="İptal"
              >
                İptal
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-3 rounded-xl font-bold bg-brand-green text-white hover:bg-green-800 transition-colors shadow-lg shadow-brand-green/20"
                aria-label="Kaydet"
              >
                Kaydet
              </button>
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
    </div>
  );
}

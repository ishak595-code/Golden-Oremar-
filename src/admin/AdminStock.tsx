import React, { useState, useMemo } from 'react';
import { Package, AlertTriangle, TrendingDown, Search, ArrowRight } from 'lucide-react';
import { useData } from '../context/DataContext';

export function AdminStock({ setActiveTab: setParentTab }: { setActiveTab?: (tab: string) => void }) {
  const { products, currentUser } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('low'); // 'low' or 'out'

  const reports = useMemo(() => {
    const vendorProducts = currentUser?.role === 'vendor' ? products.filter(p => p.vendor_id === currentUser.id || p.vendorId === currentUser.id) : products;
    return {
      lowStock: vendorProducts.filter(p => p.stock > 0 && p.stock <= 10),
      outOfStock: vendorProducts.filter(p => p.stock === 0)
    };
  }, [products, currentUser]);

  const currentData = activeTab === 'low' ? reports.lowStock : reports.outOfStock;
  const filteredData = currentData.filter((p: any) => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Stok Yönetimi</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Kritik seviyedeki ve tükenen ürünleri takip edin.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div 
          onClick={() => setActiveTab('low')}
          className={`p-6 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'low' 
              ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800' 
              : 'bg-white dark:bg-gray-800 border-gray-100 dark:bg-gray-800 dark:border-gray-700 hover:border-orange-200'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-xl ${activeTab === 'low' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/50' : 'bg-gray-50 text-gray-500 dark:bg-gray-700'}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{reports.lowStock.length}</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Azalan Ürünler</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Stok miktarı 10'un altında olan ürünler</p>
        </div>

        <div 
          onClick={() => setActiveTab('out')}
          className={`p-6 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'out' 
              ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' 
              : 'bg-white dark:bg-gray-800 border-gray-100 dark:bg-gray-800 dark:border-gray-700 hover:border-red-200'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-xl ${activeTab === 'out' ? 'bg-red-100 text-red-600 dark:bg-red-900/50' : 'bg-gray-50 text-gray-500 dark:bg-gray-700'}`}>
              <TrendingDown className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{reports.outOfStock.length}</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Tükenen Ürünler</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Stok miktarı 0 olan ürünler</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <div className="relative max-w-md w-full">
            <input
              type="text"
              placeholder="Ürün ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-green outline-none"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 font-medium border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4">Ürün</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Fiyat</th>
                <th className="px-6 py-4">Stok</th>
                <th className="px-6 py-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredData.map((product: any) => (
                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                        {product.image ? (
                          <img src={product.image} alt={product.name || product.title} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="font-medium text-gray-900 dark:text-white">{product.name || product.title}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{product.category}</td>
                  <td className="px-6 py-4">₺{product.price.toLocaleString('tr-TR')}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      product.stock === 0 
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      {Number(product.stock) || 0} Adet
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-brand-green hover:text-green-700 font-medium text-sm flex items-center justify-end gap-1">
                      Düzenle <ArrowRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Bu kriterlere uygun ürün bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

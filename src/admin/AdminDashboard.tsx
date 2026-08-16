import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Users, DollarSign, TrendingUp, Package, Clock, ArrowUpRight, ArrowDownRight, Activity, Calendar as CalendarIcon, Store, FileText } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useData } from '../context/DataContext';

const salesData = [
  { name: 'Pzt', sales: 4000, orders: 24 },
  { name: 'Sal', sales: 3000, orders: 18 },
  { name: 'Çar', sales: 2000, orders: 12 },
  { name: 'Per', sales: 2780, orders: 16 },
  { name: 'Cum', sales: 1890, orders: 10 },
  { name: 'Cmt', sales: 2390, orders: 14 },
  { name: 'Paz', sales: 3490, orders: 20 },
];

interface AdminDashboardProps {
  setActiveTab?: (tab: string) => void;
}

export function AdminDashboard({ setActiveTab }: AdminDashboardProps = {}) {
  const { orders, products, users, currentUser, vendorApplications } = useData();
  const [loading, setLoading] = useState(true);

  const stats = useMemo(() => {
    const isVendor = currentUser?.role === 'vendor';
    const vendorProducts = isVendor ? products.filter(p => p.vendor_id === currentUser.id || p.vendorId === currentUser.id) : products;
    const vendorOrders = isVendor ? orders.filter(o => o.vendorId === currentUser.id || o.items?.some(i => i.vendorId === currentUser.id || i.vendor_id === currentUser.id)) : orders;

    const totalSales = vendorOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const todayOrders = vendorOrders.filter(order => new Date(order.date).toDateString() === new Date().toDateString()).length;
    const pendingOrders = vendorOrders.filter(order => order.status === 'pending').length;
    const readyToShip = vendorOrders.filter(order => order.status === 'payment_pending_escrow').length;
    const lowStock = vendorProducts.filter(product => product.stock < 10).length;
    const newUsers = users.filter(user => new Date(user.joinDate).toDateString() === new Date().toDateString()).length;
    const pendingVendors = vendorApplications?.filter(app => app.status === 'pending').length || 0;
    const pendingProducts = vendorProducts.filter(product => !product.is_approved && !product.is_rejected).length;
    const rejectedProducts = vendorProducts.filter(product => product.is_rejected).length;
    // Mock data for vendor visits and followers if needed, or actual followers if available.
    // For now we can generate a consistent mock number based on their ID, or just static.
    const isVendorDetails = currentUser?.role === 'vendor' ? {
        followers: Math.floor(Math.random() * 50) + 10,
        visits: Math.floor(Math.random() * 500) + 100
    } : null;

    return {
      totalSales,
      todayOrders,
      pendingOrders,
      readyToShip,
      lowStock,
      newUsers,
      pendingVendors,
      pendingProducts,
      rejectedProducts,
      vendorDetails: isVendorDetails
    };
  }, [orders, products, users, currentUser, vendorApplications]);

  const recentOrders = useMemo(() => {
    const isVendor = currentUser?.role === 'vendor';
    const vendorOrders = isVendor ? orders.filter(o => o.vendorId === currentUser.id || o.items?.some(i => i.vendorId === currentUser.id || i.vendor_id === currentUser.id)) : orders;
    return [...vendorOrders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [orders, currentUser]);

  useEffect(() => {
    // Simulate loading for a smoother transition
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-green"></div></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Panel Genel Bakış</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Mağazanızın güncel durumunu takip edin.</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <CalendarIcon className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Bugün</span>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign className="w-24 h-24 text-blue-600" />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Toplam Satış</div>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{stats.totalSales.toLocaleString('tr-TR')} ₺</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Package className="w-24 h-24 text-orange-600" />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-orange-600">
                <Package className="w-6 h-6" />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Bugünkü Siparişler</div>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{stats.todayOrders}</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock className="w-24 h-24 text-yellow-600" />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-yellow-600">
                <Clock className="w-6 h-6" />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Bekleyen Siparişler</div>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{stats.pendingOrders}</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp className="w-24 h-24 text-red-600" />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Stokta Azalan Ürünler</div>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{stats.lowStock}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Approval Stats */}
      {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div 
            onClick={() => setActiveTab && setActiveTab('vendor-applications')}
            className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between group cursor-pointer hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-emerald-900 dark:text-emerald-400 font-bold">Satıcı Başvuruları</h4>
                <p className="text-sm text-emerald-700 dark:text-emerald-500/70">Onay bekleyen {stats.pendingVendors} yeni başvuru var.</p>
              </div>
            </div>
            <div className="text-3xl font-black text-emerald-600">{stats.pendingVendors}</div>
          </div>

          <div 
            onClick={() => setActiveTab && setActiveTab('product-approvals')}
            className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-center justify-between group cursor-pointer hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-blue-900 dark:text-blue-400 font-bold">Ürün Onayları</h4>
                <p className="text-sm text-blue-700 dark:text-blue-500/70">İncelenmeyi bekleyen {stats.pendingProducts} yeni ürün var.</p>
              </div>
            </div>
            <div className="text-3xl font-black text-blue-600">{stats.pendingProducts}</div>
          </div>
        </div>
      )}

      {/* Vendor Stats */}
      {currentUser?.role === 'vendor' && stats.vendorDetails && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-purple-50 dark:bg-purple-900/10 p-6 rounded-2xl border border-purple-100 dark:border-purple-900/30 flex items-center justify-between group hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-600/20">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-purple-900 dark:text-purple-400 font-bold">Mağaza Takipçileri</h4>
                <p className="text-sm text-purple-700 dark:text-purple-500/70">Toplam organik takipçi sayısı</p>
              </div>
            </div>
            <div className="text-3xl font-black text-purple-600">{stats.vendorDetails.followers}</div>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between group hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-indigo-900 dark:text-indigo-400 font-bold">Mağaza Ziyareti</h4>
                <p className="text-sm text-indigo-700 dark:text-indigo-500/70">Son 30 gündeki mağaza ziyaretleri</p>
              </div>
            </div>
            <div className="text-3xl font-black text-indigo-600">{stats.vendorDetails.visits}</div>
          </div>

          <div 
            onClick={() => setActiveTab && setActiveTab('products')}
            className="bg-orange-50 dark:bg-orange-900/10 p-6 rounded-2xl border border-orange-100 dark:border-orange-900/30 flex items-center justify-between group cursor-pointer hover:shadow-md transition-all sm:col-span-2"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-600/20">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-orange-900 dark:text-orange-400 font-bold">Ürün Onay Durumları</h4>
                <p className="text-sm text-orange-700 dark:text-orange-500/70">
                  <span className="font-semibold text-amber-600">{stats.pendingProducts}</span> ürün onay bekliyor, <span className="font-semibold text-red-600">{stats.rejectedProducts}</span> ürün reddedildi.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Satış Trendi</h3>
            <select className="text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 outline-none">
              <option>Bu Hafta</option>
              <option>Geçen Hafta</option>
              <option>Bu Ay</option>
            </select>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value} ₺`, 'Satış']}
                />
                <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Sipariş Analizi</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="orders" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Orders & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Son Siparişler</h3>
            <button className="text-sm text-brand-green font-medium hover:underline">Tümünü Gör</button>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase font-semibold text-gray-500">
                <tr>
                  <th className="px-6 py-4">Sipariş No</th>
                  <th className="px-6 py-4">Müşteri</th>
                  <th className="px-6 py-4">Tarih</th>
                  <th className="px-6 py-4">Tutar</th>
                  <th className="px-6 py-4">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">#{order.id.substring(0, 8)}</td>
                    <td className="px-6 py-4">{order.customer}</td>
                    <td className="px-6 py-4">{new Date(order.date).toLocaleDateString('tr-TR')}</td>
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{Number(order.total) || 0} ₺</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        order.status === 'delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        order.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        order.status === 'pending' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' :
                        order.status === 'payment_pending_escrow' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        order.status === 'shipped' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {order.status === 'delivered' ? 'Teslim Edildi' :
                         order.status === 'completed' ? 'Tamamlandı' :
                         order.status === 'pending' ? 'Bekliyor' :
                         order.status === 'payment_pending_escrow' ? 'Ödeme Bekleniyor' :
                         order.status === 'shipped' ? 'Kargoda' : 
                         order.status === 'cancelled' ? 'İptal Edildi' : order.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Henüz sipariş bulunmuyor.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Uygulamalar & Araçlar</h3>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setActiveTab && setActiveTab('profile')}
                  className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 hover:bg-brand-green/10 hover:border-brand-green/30 transition-all flex flex-col items-center text-center gap-3 group"
                >
                  <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center text-brand-green group-hover:scale-110 transition-transform shadow-sm">
                    <Store className="w-6 h-6" />
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">Mağaza Profili</span>
                </button>
                <button 
                  onClick={() => setActiveTab && setActiveTab('products')}
                  className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 hover:bg-orange-500/10 hover:border-orange-500/30 transition-all flex flex-col items-center text-center gap-3 group"
                >
                  <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform shadow-sm">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">Ürünlerim</span>
                </button>
                <button 
                  onClick={() => setActiveTab && setActiveTab('orders')}
                  className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all flex flex-col items-center text-center gap-3 group"
                >
                  <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform shadow-sm">
                    <Package className="w-6 h-6" />
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">Siparişlerim</span>
                </button>
                <button 
                  onClick={() => setActiveTab && setActiveTab('finance')}
                  className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 hover:bg-purple-500/10 hover:border-purple-500/30 transition-all flex flex-col items-center text-center gap-3 group"
                >
                  <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform shadow-sm">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">Finans & Ödemeler</span>
                </button>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}

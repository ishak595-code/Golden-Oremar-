import React from 'react';
import { useData } from '../context/DataContext';
import { DollarSign, TrendingUp, Package, Calendar } from 'lucide-react';

export function VendorFinance() {
  const { orders, currentUser } = useData();

  const vendorOrders = orders.filter(o => o.vendorId === currentUser?.id && (o.status === 'delivered' || o.status === 'completed'));
  
  const totalRevenue = vendorOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const totalOrders = vendorOrders.length;
  
  // Platform fee (e.g., 10%)
  const platformFee = totalRevenue * 0.10;
  const netEarnings = totalRevenue - platformFee;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Finans ve Gelir-Gider</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Toplam Ciro</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">₺{totalRevenue.toLocaleString('tr-TR')}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Platform Kesintisi (%10)</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">₺{platformFee.toLocaleString('tr-TR')}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Net Kazanç</p>
              <h3 className="text-2xl font-bold text-brand-green">₺{netEarnings.toLocaleString('tr-TR')}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Son Tamamlanan Siparişler</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 font-medium border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4">Sipariş No</th>
                <th className="px-6 py-4">Tarih</th>
                <th className="px-6 py-4">Tutar</th>
                <th className="px-6 py-4">Kesinti</th>
                <th className="px-6 py-4 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {vendorOrders.slice(0, 10).map((order) => {
                const fee = (Number(order.total) || 0) * 0.10;
                const net = (Number(order.total) || 0) - fee;
                return (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">#{order.id.slice(0, 8)}</td>
                    <td className="px-6 py-4 text-gray-500">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {new Date(order.date).toLocaleDateString('tr-TR')}
                      </div>
                    </td>
                    <td className="px-6 py-4">₺{(Number(order.total) || 0).toLocaleString('tr-TR')}</td>
                    <td className="px-6 py-4 text-red-500">-₺{fee.toLocaleString('tr-TR')}</td>
                    <td className="px-6 py-4 text-right font-bold text-brand-green">₺{net.toLocaleString('tr-TR')}</td>
                  </tr>
                );
              })}
              {vendorOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Henüz tamamlanmış siparişiniz bulunmuyor.
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

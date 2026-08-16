import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Package, Search, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export function AdminReturns() {
  const { orders, updateReturnStatus } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const returnOrders = orders.filter(o => o.returnStatus);

  const filteredReturns = returnOrders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          order.customer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.returnStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Requested': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'Approved': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Rejected': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'Completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Requested': return 'Talep Edildi';
      case 'Approved': return 'Onaylandı';
      case 'Rejected': return 'Reddedildi';
      case 'Completed': return 'Tamamlandı';
      default: return status;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">İade Talepleri</h2>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Sipariş No veya Müşteri..." 
              className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-brand-green/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="İade Ara"
            />
          </div>
          
          <select 
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-brand-green/20"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Durum Filtrele"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="Requested">Talep Edildi</option>
            <option value="Approved">Onaylandı</option>
            <option value="Rejected">Reddedildi</option>
            <option value="Completed">Tamamlandı</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 font-medium border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4">Sipariş No</th>
                <th className="px-6 py-4">Müşteri</th>
                <th className="px-6 py-4">İade Nedeni</th>
                <th className="px-6 py-4">Tutar</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredReturns.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-gray-900 dark:text-white">
                    {order.id}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                    <div className="font-bold text-gray-900 dark:text-white">{order.customer}</div>
                    <div className="text-xs text-gray-500">{order.items.length} Ürün</div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 max-w-xs truncate" title={order.returnReason}>
                    {order.returnReason || '-'}
                  </td>
                  <td className="px-6 py-4 font-bold text-brand-green dark:text-brand-gold">
                    {Number(order.total) || 0} ₺
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${getStatusColor(order.returnStatus!)}`}>
                      {order.returnStatus === 'Completed' && <CheckCircle className="w-3 h-3" />}
                      {order.returnStatus === 'Requested' && <AlertCircle className="w-3 h-3" />}
                      {order.returnStatus === 'Rejected' && <XCircle className="w-3 h-3" />}
                      {getStatusLabel(order.returnStatus!)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      className="bg-gray-100 dark:bg-gray-700 border-none rounded-lg px-3 py-1.5 text-xs font-bold outline-none cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      value={order.returnStatus}
                      onChange={(e) => updateReturnStatus(order.id, e.target.value as any)}
                      aria-label={`İade Durumu Değiştir ${order.id}`}
                    >
                      <option value="Requested">Talep Edildi</option>
                      <option value="Approved">Onayla</option>
                      <option value="Rejected">Reddet</option>
                      <option value="Completed">Tamamlandı</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredReturns.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>İade talebi bulunamadı.</p>
          </div>
        )}
      </div>
    </div>
  );
}

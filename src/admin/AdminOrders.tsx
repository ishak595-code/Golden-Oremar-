import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Package, Search, CheckCircle, XCircle, Truck, Clock, AlertCircle, Eye, MapPin, CreditCard } from 'lucide-react';

export function AdminOrders({ setActiveTab: setParentTab }: { setActiveTab?: (tab: string) => void }) {
  const { orders, updateOrder, currentUser } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderToComplete, setOrderToComplete] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [trackingNumber, setTrackingNumber] = useState('');

  const filteredOrders = orders.filter(order => {
    const isVendor = currentUser?.role === 'vendor';
    // If user is a vendor, order must contain at least one item from this vendor, or order.vendorId must be this vendor.
    const belongsToVendor = isVendor ? (order.vendorId === currentUser?.id || order.items?.some(item => (item.vendorId === currentUser?.id || item.vendor_id === currentUser?.id))) : true;

    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          order.customer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return belongsToVendor && matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'shipped': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'payment_pending_escrow': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'pending': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
      case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'delivered': return 'Teslim Edildi';
      case 'completed': return 'Tamamlandı';
      case 'shipped': return 'Kargolandı';
      case 'payment_pending_escrow': return 'Ödeme Bekleniyor (Escrow)';
      case 'pending': return 'Bekliyor';
      case 'cancelled': return 'İptal Edildi';
      default: return status;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-50';
      case 'escrow': return 'text-blue-600 bg-blue-50';
      case 'released': return 'text-emerald-600 bg-emerald-50';
      case 'refunded': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const handleCompleteOrder = async () => {
    if (!orderToComplete) return;
    
    try {
      await updateOrder(orderToComplete, 'completed');
      setOrderToComplete(null);
    } catch (error) {
      console.error('Error completing order:', error);
    }
  };

  const handleShipOrder = async (orderId: string) => {
    try {
      await updateOrder(orderId, 'shipped', trackingNumber);
      setSelectedOrder(null);
      setTrackingNumber('');
    } catch (error) {
      console.error('Error shipping order:', error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sipariş Yönetimi</h2>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Sipariş No veya Müşteri..." 
              className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-brand-green/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Sipariş Ara"
            />
          </div>
          
          <select 
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-brand-green/20"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Durum Filtrele"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="pending">Bekliyor</option>
            <option value="payment_pending_escrow">Ödeme Bekleniyor</option>
            <option value="shipped">Kargolandı</option>
            <option value="delivered">Teslim Edildi</option>
            <option value="completed">Tamamlandı</option>
            <option value="cancelled">İptal Edildi</option>
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
                <th className="px-6 py-4">Tarih</th>
                <th className="px-6 py-4">Ödeme</th>
                <th className="px-6 py-4">Tutar</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-gray-900 dark:text-white">
                    {order.id}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                    <div className="font-bold text-gray-900 dark:text-white">{order.customer}</div>
                    <div className="text-xs text-gray-500">{order.items.length} Ürün</div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {order.date}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getPaymentStatusColor(order.payment_status)}`}>
                      {order.payment_status === 'escrow' ? 'Havuzda' : 
                       order.payment_status === 'released' ? 'Aktarıldı' : 
                       order.payment_status === 'paid' ? 'Ödendi' : order.payment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-brand-green dark:text-brand-gold">
                    {Number(order.total) || 0} ₺
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${getStatusColor(order.status)}`}>
                      {order.status === 'delivered' && <CheckCircle className="w-3 h-3" />}
                      {order.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                      {order.status === 'shipped' && <Truck className="w-3 h-3" />}
                      {order.status === 'payment_pending_escrow' && <Clock className="w-3 h-3" />}
                      {order.status === 'pending' && <AlertCircle className="w-3 h-3" />}
                      {order.status === 'cancelled' && <XCircle className="w-3 h-3" />}
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                       <div className="flex gap-2">
                        <button 
                          onClick={() => setSelectedOrder(order)}
                          className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-bold rounded-lg hover:opacity-80 transition-opacity flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> Detaylar
                        </button>
                      </div>
                      <select 
                        className="bg-gray-100 dark:bg-gray-700 border-none rounded-lg px-3 py-1.5 text-xs font-bold outline-none cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors w-full"
                        value={order.status}
                        onChange={(e) => updateOrder(order.id, e.target.value as any)}
                        aria-label={`Sipariş Durumu Değiştir ${order.id}`}
                      >
                        <option value="pending">Bekliyor</option>
                        <option value="payment_pending_escrow">Ödeme Bekleniyor</option>
                        <option value="shipped">Kargolandı</option>
                        <option value="delivered">Teslim Edildi</option>
                        <option value="completed">Tamamlandı</option>
                        <option value="cancelled">İptal Et</option>
                      </select>
                      
                      {order.status === 'delivered' && (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                        <button 
                          onClick={() => setOrderToComplete(order.id)}
                          className="w-full py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Ödemeyi Serbest Bırak
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredOrders.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Sipariş bulunamadı.</p>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
               <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Sipariş #{selectedOrder.id}</h3>
                  <div className="text-sm text-gray-500 mt-1">{selectedOrder.date}</div>
               </div>
               <button onClick={() => setSelectedOrder(null)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:opacity-80">
                  <XCircle className="w-5 h-5" />
               </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
               <div className="space-y-4">
                  <h4 className="font-bold flex items-center gap-2 text-gray-900 dark:text-white"><MapPin className="w-4 h-4 text-brand-green"/> Teslimat Bilgileri</h4>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl text-sm">
                     <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">{selectedOrder.customer}</p>
                     <p className="text-gray-600 dark:text-gray-400">{selectedOrder.shippingAddress || "Alıcı tarafından sistem üzerinde kayıtlı bir adres seçilmiştir. Lütfen kullanıcıya mesaj atarak onaylayın."}</p>
                     {selectedOrder.phone && <p className="text-gray-600 dark:text-gray-400 mt-2">Tel: {selectedOrder.phone}</p>}
                  </div>
               </div>

               <div className="space-y-4">
                  <h4 className="font-bold flex items-center gap-2 text-gray-900 dark:text-white"><CreditCard className="w-4 h-4 text-brand-green"/> Ödeme Bilgileri</h4>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl text-sm">
                     <div className="flex justify-between mb-2">
                        <span className="text-gray-500">Ara Toplam:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{Number(selectedOrder.total) || 0} ₺</span>
                     </div>
                     <div className="flex justify-between font-bold border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                        <span className="text-gray-800 dark:text-gray-200">Toplam:</span>
                        <span className="text-brand-green">{Number(selectedOrder.total) || 0} ₺</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="mb-6">
               <h4 className="font-bold text-gray-900 dark:text-white mb-4">Sipariş İçeriği</h4>
               <div className="space-y-3">
                 {selectedOrder.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex gap-4 items-center bg-gray-50 dark:bg-gray-900 p-3 rounded-xl">
                       <img src={item.image || '/logo.svg'} className="w-12 h-12 rounded-lg object-cover bg-white" alt="Product" />
                       <div className="flex-1">
                          <h5 className="font-bold text-gray-900 dark:text-white text-sm">{item.name || item.title}</h5>
                          <div className="text-xs text-gray-500">{item.quantity} Adet x {item.price} ₺</div>
                       </div>
                       <div className="font-bold text-gray-900 dark:text-white">
                          {(item.quantity || 1) * (Number(item.price) || 0)} ₺
                       </div>
                    </div>
                 ))}
               </div>
            </div>

            {(selectedOrder.status === 'payment_pending_escrow' || selectedOrder.status === 'pending') && (
               <div className="border-t border-gray-100 dark:border-gray-700 pt-6 mt-6">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-4">Kargolama İşlemi</h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                     <input 
                       type="text" 
                       placeholder="Kargo Takip Numarası" 
                       className="flex-1 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                       value={trackingNumber}
                       onChange={e => setTrackingNumber(e.target.value)}
                     />
                     <button 
                       onClick={() => handleShipOrder(selectedOrder.id)}
                       disabled={!trackingNumber}
                       className="px-6 py-3 bg-brand-green text-white font-bold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                     >
                       <Truck className="w-5 h-5"/> Kargoya Verildi Olarak İşaretle
                     </button>
                  </div>
               </div>
            )}
          </div>
        </div>
      )}

      {/* Complete Order Confirmation Modal */}
      {orderToComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Siparişi Tamamla</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Siparişi tamamlamak ve ödemeyi satıcıya aktarmak istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setOrderToComplete(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleCompleteOrder}
                className="px-4 py-2 bg-brand-green text-white rounded-xl hover:bg-green-700 transition-colors"
              >
                Evet, Tamamla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

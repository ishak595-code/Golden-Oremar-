import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { CheckCircle, XCircle, Search, Store, FileText, MapPin, Phone, CreditCard, Check } from 'lucide-react';

export function AdminVendorApplications() {
  const { vendorApplications, updateVendorApplicationStatus } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [toast, setToast] = useState<{message: string, visible: boolean}>({ message: '', visible: false });

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3000);
  };

  const handleUpdateStatus = async (id: string, userId: string, status: 'approved' | 'rejected') => {
    try {
      await updateVendorApplicationStatus(id, userId, status);
      showToast(status === 'approved' ? 'Başvuru onaylandı.' : 'Başvuru reddedildi.');
    } catch (error) {
      showToast('İşlem sırasında bir hata oluştu.');
    }
  };

  const filteredApps = (vendorApplications || []).filter(app => {
    const matchesSearch = app.store_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          app.userName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Satıcı Başvuruları</h2>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Mağaza veya İsim..." 
              className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-brand-green/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-brand-green/20"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tüm Başvurular</option>
            <option value="pending">Bekleyenler</option>
            <option value="approved">Onaylananlar</option>
            <option value="rejected">Reddedilenler</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredApps.map(app => (
          <div key={app.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-brand-green/10 flex items-center justify-center text-brand-green">
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{app.store_name}</h3>
                  <p className="text-sm text-gray-500">{app.userName} ({app.userEmail})</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                app.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                app.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}>
                {app.status === 'approved' ? 'Onaylandı' : app.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
              </span>
            </div>

            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300 flex-1">
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                <span>{app.phone}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                <span>{app.address}</span>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                <span>Vergi/TC: {app.tax_info}</span>
              </div>
              <div className="flex items-start gap-2">
                <CreditCard className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                <span className="break-all">IBAN: {app.bank_info}</span>
              </div>
              {(app as any).documentUrl && (
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 mt-0.5 shrink-0 text-brand-green" />
                  <a href={(app as any).documentUrl} target="_blank" rel="noopener noreferrer" className="text-brand-green hover:underline">Çiftçi Belgesi/Sertifika Görüntüle</a>
                </div>
              )}
              {(app as any).idUrl && (
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 mt-0.5 shrink-0 text-brand-green" />
                  <a href={(app as any).idUrl} target="_blank" rel="noopener noreferrer" className="text-brand-green hover:underline">Kimlik Görüntüle</a>
                </div>
              )}
            </div>

            {app.status === 'pending' && (
              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                <button 
                  onClick={() => handleUpdateStatus(app.id, app.userId, 'rejected')}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20 transition-colors font-medium"
                >
                  <XCircle className="w-4 h-4" /> Reddet
                </button>
                <button 
                  onClick={() => handleUpdateStatus(app.id, app.userId, 'approved')}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-brand-green text-white hover:bg-green-800 transition-colors font-medium"
                >
                  <CheckCircle className="w-4 h-4" /> Onayla
                </button>
              </div>
            )}
          </div>
        ))}
        {filteredApps.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500">
            Başvuru bulunamadı.
          </div>
        )}
      </div>

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

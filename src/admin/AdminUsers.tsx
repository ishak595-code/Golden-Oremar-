import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Users, Search, Trash2, CheckCircle, XCircle, Shield, Eye, X, Mail, Phone, MapPin, Calendar, ShoppingBag } from 'lucide-react';

export function AdminUsers() {
  const { users, updateUserStatus, updateUserRole, deleteUser, orders, currentUser } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || 
                        user.role === roleFilter || 
                        (roleFilter === 'admin' && user.role === 'super_admin');
    return matchesSearch && matchesRole;
  });

  const getUserOrders = (userId: number) => {
    return orders.filter(o => o.userId === userId);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Kullanıcı Yönetimi</h2>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="İsim veya E-posta..." 
              className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-brand-green/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Kullanıcı Ara"
            />
          </div>
          
          <select 
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-brand-green/20"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Rol Filtrele"
          >
            <option value="all">Tüm Roller</option>
            <option value="user">Kullanıcı</option>
            <option value="vendor">Satıcı</option>
            <option value="admin">Yönetici</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 font-medium border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4">Kullanıcı</th>
                <th className="px-6 py-4">Rol</th>
                <th className="px-6 py-4">Katılım Tarihi</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">{user.name}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={user.role}
                      onChange={(e) => updateUserRole(user.id, e.target.value as any)}
                      className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-green/20"
                      disabled={user.role === 'super_admin' && currentUser?.role !== 'super_admin'}
                    >
                      <option value="user">Üye</option>
                      <option value="vendor">Satıcı</option>
                      <option value="admin">Yönetici</option>
                      {(user.role === 'super_admin' || currentUser?.role === 'super_admin') && <option value="super_admin">Süper Yönetici</option>}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {user.joinDate}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                      user.status === 'active' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {user.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {user.status === 'active' ? 'Aktif' : 'Engelli'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setSelectedUser(user)}
                        className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Görüntüle"
                        aria-label="Kullanıcı Detaylarını Görüntüle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => updateUserStatus(user.id, user.status === 'active' ? 'blocked' : 'active')}
                        className={`p-2 rounded-lg transition-colors ${
                          user.status === 'active' 
                            ? 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20' 
                            : 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                        } ${user.role === 'super_admin' && currentUser?.role !== 'super_admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={user.status === 'active' ? 'Engelle' : 'Aktifleştir'}
                        aria-label={user.status === 'active' ? 'Kullanıcıyı Engelle' : 'Kullanıcıyı Aktifleştir'}
                        disabled={user.role === 'super_admin' && currentUser?.role !== 'super_admin'}
                      >
                        {user.status === 'active' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => setUserToDelete(user.id)}
                        className={`p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ${
                          user.role === 'super_admin' && currentUser?.role !== 'super_admin' ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title="Sil"
                        aria-label="Kullanıcıyı Sil"
                        disabled={user.role === 'super_admin' && currentUser?.role !== 'super_admin'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredUsers.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Kullanıcı bulunamadı.</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Kullanıcıyı Sil</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Bu kullanıcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  deleteUser(userToDelete);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 text-white font-medium hover:bg-red-700 rounded-xl transition-colors"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-green" />
                Kullanıcı Detayları
              </h3>
              <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8">
              {/* Profile Header */}
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center text-3xl font-bold">
                  {selectedUser.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedUser.name}</h4>
                  <div className="flex items-center gap-4 mt-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                      selectedUser.status === 'active' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {selectedUser.status === 'active' ? 'Aktif' : 'Engelli'}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Calendar className="w-4 h-4" /> Katılım: {selectedUser.joinDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> E-posta Adresi
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white">{selectedUser.email}</div>
                </div>
                <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Telefon Numarası
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white">{selectedUser.phone || 'Belirtilmemiş'}</div>
                </div>
                <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 sm:col-span-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Kayıtlı Adres
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {selectedUser.address ? (
                      `${selectedUser.address.street}, ${selectedUser.address.city}, ${selectedUser.address.zipCode}`
                    ) : (
                      'Adres bilgisi bulunmuyor.'
                    )}
                  </div>
                </div>
              </div>

              {/* Order History Summary */}
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-gray-400" />
                  Sipariş Geçmişi
                </h4>
                {getUserOrders(selectedUser.id).length > 0 ? (
                  <div className="space-y-3">
                    {getUserOrders(selectedUser.id).map(order => (
                      <div key={order.id} className="flex justify-between items-center p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white">#{order.id}</div>
                          <div className="text-xs text-gray-500">{order.date}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-brand-green">{Number(order.total) || 0} ₺</div>
                          <div className="text-xs text-gray-500">{order.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-6 bg-gray-50 dark:bg-gray-900/50 rounded-xl text-gray-500 text-sm">
                    Henüz sipariş bulunmuyor.
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end">
              <button 
                onClick={() => setSelectedUser(null)}
                className="px-6 py-2 rounded-xl font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

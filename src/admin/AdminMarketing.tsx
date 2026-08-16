import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Mail, Bell, Send, Users, CheckCircle, Search } from 'lucide-react';

export function AdminMarketing() {
  const { users, addNotification } = useData();
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const handleSelectUser = (id: number) => {
    if (selectedUsers.includes(id)) {
      setSelectedUsers(selectedUsers.filter(u => u !== id));
    } else {
      setSelectedUsers([...selectedUsers, id]);
    }
  };

  const handleSend = () => {
    if (!message || !subject || selectedUsers.length === 0) return;
    
    setIsSending(true);
    
    // Simulate API call and add notifications
    setTimeout(() => {
      selectedUsers.forEach(userId => {
        addNotification({
          userId,
          message: `${subject}: ${message}`,
          type: 'marketing'
        });
      });

      setIsSending(false);
      setShowSuccess(true);
      setMessage('');
      setSubject('');
      setSelectedUsers([]);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 1000);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Pazarlama & Bildirimler</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Selection */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-[600px]">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold">
              <Users className="w-5 h-5" />
              <h3>Kullanıcı Seçimi ({selectedUsers.length})</h3>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Kullanıcı ara..." 
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm outline-none focus:ring-2 focus:ring-brand-green/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Kullanıcı Ara"
              />
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="selectAll"
                checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-brand-green focus:ring-brand-green"
                aria-label="Tümünü Seç"
              />
              <label htmlFor="selectAll" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">Tümünü Seç</label>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredUsers.map(user => (
              <div 
                key={user.id} 
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selectedUsers.includes(user.id) ? 'bg-brand-green/10 border border-brand-green/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent'}`}
                onClick={() => handleSelectUser(user.id)}
              >
                <input 
                  type="checkbox" 
                  checked={selectedUsers.includes(user.id)}
                  onChange={() => {}}
                  className="rounded border-gray-300 text-brand-green focus:ring-brand-green pointer-events-none"
                  aria-label={`${user.name} Seç`}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-900 dark:text-white truncate">{user.name}</div>
                  <div className="text-xs text-gray-500 truncate">{user.email}</div>
                </div>
                <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
            ))}
          </div>
        </div>

        {/* Message Composer */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col h-[600px]">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 pb-4 mb-6">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Mesaj Oluştur</h3>
          </div>

          <div className="space-y-6 flex-1 flex flex-col">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Kampanya Türü</label>
                <select className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20">
                  <option value="email">E-Posta Bülteni</option>
                  <option value="push">Anlık Bildirim (Push)</option>
                  <option value="sms">SMS Kampanyası</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Gönderim Zamanı</label>
                <select className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20">
                  <option value="now">Hemen Gönder</option>
                  <option value="schedule">İleri Tarihli Planla</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Konu Başlığı</label>
              <input 
                type="text" 
                placeholder="Örn: Haftasonu İndirimleri Başladı!"
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                aria-label="Konu Başlığı"
              />
            </div>

            <div className="space-y-2 flex-1 flex flex-col">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Mesaj İçeriği</label>
              <textarea 
                className="w-full flex-1 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-brand-green/20 resize-none font-sans"
                placeholder="Mesajınızı buraya yazın..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                aria-label="Mesaj İçeriği"
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/20 flex gap-3">
              <Bell className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-bold">Bilgilendirme</p>
                <p>Bu mesaj seçilen <strong>{selectedUsers.length}</strong> kullanıcıya e-posta ve anlık bildirim olarak gönderilecektir.</p>
              </div>
            </div>

            <button 
              onClick={handleSend}
              disabled={!subject || !message || selectedUsers.length === 0 || isSending}
              className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                !subject || !message || selectedUsers.length === 0 || isSending
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-brand-green text-white hover:bg-green-800 shadow-lg shadow-brand-green/20 hover:scale-[1.02]'
              }`}
            >
              {isSending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Gönderiliyor...
                </>
              ) : showSuccess ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Başarıyla Gönderildi!
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Gönder ({selectedUsers.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

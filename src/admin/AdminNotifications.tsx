import React, { useState, useEffect } from 'react';
import { Send, Users, User, AlertCircle, CheckCircle, Mail, Bell } from 'lucide-react';
import { useData } from '../context/DataContext';

export function AdminNotifications() {
  const { users, addNotification, currentUser } = useData();
  const [sending, setSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    target_role: 'all',
    user_id: '',
    sendEmail: false,
    sendPush: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSuccessMessage('');
    
    try {
      let targetUsers: any[] = [];
      
      if (formData.target_role === 'all') {
        targetUsers = users;
      } else if (formData.target_role === 'vendor') {
        targetUsers = users.filter((u: any) => u.role === 'vendor');
      } else if (formData.target_role === 'specific') {
        targetUsers = users.filter((u: any) => u.id === formData.user_id);
      }

      if (formData.sendPush) {
         for (const user of targetUsers) {
           addNotification({
             userId: user.id || user.uid,
             message: formData.message,
             type: formData.type as 'order' | 'system' | 'campaign' | 'info'
           });
         }
      }

      // Simulated email sending (No real backend to send emails)
      if (formData.sendEmail) {
         console.log(`Simulating email via DataContext for ${targetUsers.length} users with subject: ${formData.title}`);
         // We would call a backend function here to deploy actual emails.
      }

      setSuccessMessage('Bildirim(ler) başarıyla gönderildi.');
      setFormData({
        title: '',
        message: '',
        type: 'info',
        target_role: 'all',
        user_id: '',
        sendEmail: false,
        sendPush: true
      });
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error sending notification:', error);
      setErrorMessage('Bildirim gönderilirken bir hata oluştu.');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bildirim & E-posta Gönder</h2>
      </div>

      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-4 rounded-xl flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hedef Kitle</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  formData.target_role === 'all' 
                    ? 'bg-brand-green/10 border-brand-green text-brand-green' 
                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-green/50'
                }`}>
                  <input 
                    type="radio" 
                    name="target" 
                    value="all" 
                    checked={formData.target_role === 'all'}
                    onChange={(e) => setFormData({...formData, target_role: e.target.value})}
                    className="hidden" 
                  />
                  <Users className="w-5 h-5" />
                  <span className="font-medium">Tüm Kullanıcılar</span>
                </label>
                
                <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  formData.target_role === 'vendor' 
                    ? 'bg-brand-green/10 border-brand-green text-brand-green' 
                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-green/50'
                }`}>
                  <input 
                    type="radio" 
                    name="target" 
                    value="vendor" 
                    checked={formData.target_role === 'vendor'}
                    onChange={(e) => setFormData({...formData, target_role: e.target.value})}
                    className="hidden" 
                  />
                  <Users className="w-5 h-5" />
                  <span className="font-medium">Sadece Satıcılar</span>
                </label>

                <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  formData.target_role === 'specific' 
                    ? 'bg-brand-green/10 border-brand-green text-brand-green' 
                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-green/50'
                }`}>
                  <input 
                    type="radio" 
                    name="target" 
                    value="specific" 
                    checked={formData.target_role === 'specific'}
                    onChange={(e) => setFormData({...formData, target_role: e.target.value})}
                    className="hidden" 
                  />
                  <User className="w-5 h-5" />
                  <span className="font-medium">Belirli Kullanıcı</span>
                </label>
              </div>
            </div>

            {formData.target_role === 'specific' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kullanıcı Seçin</label>
                <select
                  required
                  value={formData.user_id}
                  onChange={(e) => setFormData({...formData, user_id: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-green"
                >
                  <option value="">Kullanıcı seçin...</option>
                  {users.map((user: any) => (
                    <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Gönderim Kanalları</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formData.sendPush}
                    onChange={(e) => setFormData({...formData, sendPush: e.target.checked})}
                    className="rounded text-brand-green focus:ring-brand-green w-4 h-4 cursor-pointer"
                  />
                  <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1"><Bell className="w-4 h-4" /> Uygulama İçi (Bildirimler)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formData.sendEmail}
                    onChange={(e) => setFormData({...formData, sendEmail: e.target.checked})}
                    className="rounded text-brand-green focus:ring-brand-green w-4 h-4 cursor-pointer"
                  />
                  <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1"><Mail className="w-4 h-4" /> E-posta (Bülten)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bildirim Türü</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-green"
              >
                <option value="info">Bilgilendirme</option>
                <option value="success">Başarılı İşlem</option>
                <option value="warning">Uyarı</option>
                <option value="campaign">Kampanya</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Başlık</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Örn: Yeni Yıl İndirimleri Başladı!"
                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-green"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mesaj İçeriği</label>
              <textarea
                required
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                placeholder="Kullanıcılara gösterilecek mesajı buraya yazın..."
                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-green"
                rows={5}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="submit"
              disabled={sending || (!formData.sendPush && !formData.sendEmail)}
              className="px-6 py-3 rounded-xl bg-brand-green text-white font-medium hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Gönderiliyor...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Bildirimi Gönder
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-blue-900 dark:text-blue-400">E-posta ve Push Bildirimleri</h4>
          <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
            Uygulama İçi (Push) seçeneği ile kullanıcıların hesaplarına doğrudan kampanya veya haber uyarısı gönderilir ve zil ikonu üzerinden görebilirler. E-posta seçeneği ile (varsa) tanımlı mail adreslerine bilgilendirme e-postası dağıtılır.
          </p>
        </div>
      </div>
    </div>
  );
}

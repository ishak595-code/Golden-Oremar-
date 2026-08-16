import React, { useState } from 'react';
import { useData, Event } from '../context/DataContext';
import { Calendar, Plus, Edit, Trash2, MapPin, X, Image as ImageIcon, Users, Phone, Mail, Check } from 'lucide-react';

export function AdminEvents({ setActiveTab: setParentTab }: { setActiveTab?: (tab: string) => void }) {
  const { events, addEvent, updateEvent, deleteEvent, eventReservations, deleteEventReservation } = useData();
  const [activeTab, setActiveTab] = useState<'events' | 'reservations'>('events');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<Partial<Event>>({
    title: '', date: '', location: '', description: '', image: ''
  });
  const [toast, setToast] = useState<{message: string, visible: boolean}>({ message: '', visible: false });

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3000);
  };

  const handleOpenModal = (event?: Event) => {
    if (event) {
      setEditingEvent(event);
      setFormData(event);
    } else {
      setEditingEvent(null);
      setFormData({
        title: '', date: '', location: '', description: '', 
        image: 'https://picsum.photos/seed/event/800/600'
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (editingEvent) {
      updateEvent(editingEvent.id, formData);
      showToast('Etkinlik başarıyla güncellendi.');
    } else {
      addEvent({ id: Date.now(), ...formData as Event });
      showToast('Etkinlik başarıyla eklendi.');
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
        <button 
          onClick={() => setActiveTab('events')}
          className={`pb-3 px-4 font-medium transition-colors border-b-2 ${activeTab === 'events' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Etkinlikler
        </button>
        <button 
          onClick={() => setActiveTab('reservations')}
          className={`pb-3 px-4 font-medium transition-colors border-b-2 ${activeTab === 'reservations' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Rezervasyonlar
          {eventReservations.length > 0 && (
            <span className="ml-2 bg-brand-green text-white text-xs px-2 py-0.5 rounded-full">
              {eventReservations.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'events' && (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Etkinlik Yönetimi</h2>
            <button 
              onClick={() => handleOpenModal()}
              className="bg-brand-green text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-green-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Yeni Etkinlik Ekle
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map(event => (
              <div key={event.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden group">
                <div className="h-48 relative">
                  <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenModal(event)} className="p-2 bg-white dark:bg-gray-800 text-blue-600 rounded-full shadow-sm hover:bg-blue-50 dark:hover:bg-gray-700"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => deleteEvent(event.id)} className="p-2 bg-white dark:bg-gray-800 text-red-600 rounded-full shadow-sm hover:bg-red-50 dark:hover:bg-gray-700"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
                    <div className="text-white font-bold text-lg">{event.title}</div>
                    <div className="text-white/80 text-sm flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {event.date}
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start gap-2 text-gray-500 text-sm mb-3">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                    {event.location}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-3">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'reservations' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Etkinlik Rezervasyonları</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-sm">
                  <th className="p-4 font-medium">Kişi Bilgileri</th>
                  <th className="p-4 font-medium">Etkinlik</th>
                  <th className="p-4 font-medium">Kişi Sayısı</th>
                  <th className="p-4 font-medium">Kayıt Tarihi</th>
                  <th className="p-4 font-medium text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {eventReservations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400">
                      Henüz rezervasyon bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  eventReservations.map(res => {
                    const event = events.find(e => e.id === res.eventId);
                    return (
                      <tr key={res.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-gray-900 dark:text-white">{res.name}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                            <Mail className="w-3 h-3" /> {res.email}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                            <Phone className="w-3 h-3" /> {res.phone}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-gray-900 dark:text-white">{event?.title || 'Bilinmeyen Etkinlik'}</div>
                          <div className="text-sm text-gray-500">{event?.date}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                            <Users className="w-4 h-4 text-brand-gold" />
                            <span className="font-bold">{res.guests}</span> Kişi
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-500">
                          {new Date(res.date).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => deleteEventReservation(res.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Rezervasyonu Sil"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editingEvent ? 'Etkinliği Düzenle' : 'Yeni Etkinlik Ekle'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Etkinlik Adı</label>
                <input type="text" className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Tarih</label>
                  <input type="text" placeholder="Örn: 15 Eylül 2024" className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Konum</label>
                  <input type="text" className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Açıklama</label>
                <textarea rows={4} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none resize-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Görsel URL</label>
                <input type="text" className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none" value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">İptal</button>
              <button onClick={handleSave} className="px-6 py-3 rounded-xl font-bold bg-brand-green text-white hover:bg-green-800 transition-colors shadow-lg">Kaydet</button>
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
    </div>
  );
}

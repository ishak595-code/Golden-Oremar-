const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

const contactFormRegex = /(<form className="space-y-4" onSubmit={\(e\) => \{\s*e\.preventDefault\(\);\s*alert\("İletişim talebiniz alınmıştır. Size en kısa sürede dönüş yapılacaktır."\);\s*\(e\.target as HTMLFormElement\)\.reset\(\);\s*\}\}>)[\s\S]*?(<\/form>)/;

const newContactLogic = `<form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const name = (form.elements.namedItem('name') as HTMLInputElement).value;
            const email = (form.elements.namedItem('email') as HTMLInputElement).value;
            const subject = (form.elements.namedItem('subject') as HTMLInputElement).value;
            const message = (form.elements.namedItem('message') as HTMLTextAreaElement).value;

            try {
              // Veritabanına kaydet
              await addDoc(collection(db, 'messages'), {
                name,
                email,
                subject,
                message,
                timestamp: serverTimestamp(),
                status: 'unread'
              });
              
              // Email tetikleyici
              await addDoc(collection(db, 'mail'), {
                to: [contactInfo.email], // Adminin maili
                message: {
                  subject: \`Yeni İletişim Formu: \${subject}\`,
                  html: \`<p><strong>Gönderen:</strong> \${name} (\${email})</p><p><strong>Mesaj:</strong></p><p>\${message}</p>\`
                }
              });

              // Otomatik cevap email'i
              await addDoc(collection(db, 'mail'), {
                to: [email],
                message: {
                  subject: 'Talebiniz Alındı - Golden Oremar',
                  html: \`<p>Sayın \${name},</p><p>İletişim talebinizi aldık. En kısa sürede VIP ekibimiz sizinle iletişime geçecektir.</p><p>Gönderdiğiniz mesaj:<br><em>\${message}</em></p>\`
                }
              });

              alert("İletişim talebiniz başarıyla alınmıştır.");
              form.reset();
            } catch (error) {
              console.error("Message error:", error);
              alert("Mesajınız gönderilirken bir hata oluştu.");
            }
          }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ad Soyad</label>
              <input name="name" type="text" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0a1911] focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none transition-all" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">E-posta</label>
              <input name="email" type="email" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0a1911] focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none transition-all" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Konu</label>
              <input name="subject" type="text" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0a1911] focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none transition-all" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mesajınız</label>
              <textarea name="message" rows={4} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0a1911] focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none transition-all resize-none" required></textarea>
            </div>
            <button className="w-full py-4 bg-brand-gold text-white font-bold rounded-xl hover:bg-yellow-600 transition-colors shadow-lg shadow-brand-gold/20 flex items-center justify-center gap-2">
              <Send className="w-5 h-5" />
              Gönder
            </button>
          </form>`;

if (content.match(contactFormRegex)) {
  content = content.replace(contactFormRegex, newContactLogic);
  console.log("Contact form upgraded with Firestore and Mail.");
} else {
  console.log("Could not find contact form.");
}

fs.writeFileSync('src/App.tsx', content);


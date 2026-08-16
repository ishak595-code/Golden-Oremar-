const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const orderRegex = /(const orderRef = await addDoc\(collection\(db, 'orders'\), \{[\s\S]*?\}\);)/;

const newFeatures = `      // Backend Mail Extension Trigger
      await addDoc(collection(db, 'mail'), {
        to: Array.isArray(currentUser?.email) ? currentUser.email : [currentUser?.email || checkoutData.contact.email],
        message: {
          subject: 'Golden Oremar - Siparişiniz Alındı',
          html: \`<p>Sayın \${checkoutData.contact.fullName},</p><p>Siparişiniz başarıyla alındı. VIP Concierge ekibimiz işlemlerinizi başlatmıştır.</p>\`
        }
      });
      
      // Centralized Transaction Logging
      await addDoc(collection(db, 'system_logs'), {
        type: 'transaction',
        action: 'order_created',
        userId: currentUser?.uid || 'guest',
        timestamp: serverTimestamp(),
        metadata: {
           totalAmount: total,
           orderId: orderRef.id
        }
      });`;

if (content.match(orderRegex)) {
   content = content.replace(orderRegex, `$1\n\n${newFeatures}`);
   console.log("Added Backend Mail Integration and Logging");
} else {
   console.log("Could not find order insert");
}

fs.writeFileSync('src/App.tsx', content);

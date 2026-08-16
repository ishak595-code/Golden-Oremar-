const fs = require('fs');

let content = fs.readFileSync('src/context/DataContext.tsx', 'utf-8');

const returnMethodsRegex = /(const requestReturn = async \(id: string, reason: string\) => \{\};[\s]*const updateReturnStatus = async \(id: string, status: NonNullable<Order\['returnStatus'\]>\) => \{\};)/;

const implementedMethods = `  const requestReturn = async (id: string, reason: string) => {
    try {
      await updateDoc(doc(db, 'orders', id), {
        returnStatus: 'requested',
        returnReason: reason
      });
      console.log('Return requested');
      
      // Admin'e bildirim gonder
      await addDoc(collection(db, 'mail'), {
        to: ['admin@goldenoremar.com'], // Varsayilan admin mail'i, guncellenebilir
        message: {
          subject: \`Yeni İade Talebi: Sipariş #\${id}\`,
          html: \`<p>Sipariş #\${id} için iade talebi oluşturuldu.</p><p>Sebep: \${reason}</p>\`
        }
      });
    } catch (e) {
      console.error("Error requesting return: ", e);
    }
  };

  const updateReturnStatus = async (id: string, status: NonNullable<Order['returnStatus']>) => {
    try {
      await updateDoc(doc(db, 'orders', id), {
        returnStatus: status
      });
      console.log('Return status updated to', status);
    } catch (e) {
      console.error("Error updating return status: ", e);
    }
  };`;

if (content.match(returnMethodsRegex)) {
  content = content.replace(returnMethodsRegex, implementedMethods);
  console.log("Implemented requestReturn and updateReturnStatus");
} else {
  console.log("Could not find empty return methods");
}

fs.writeFileSync('src/context/DataContext.tsx', content);

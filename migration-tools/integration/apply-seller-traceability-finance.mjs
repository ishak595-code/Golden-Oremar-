import fs from 'node:fs';

const target = process.argv[2] || 'src/features/account/SellerPanel.tsx';
let source = fs.readFileSync(target, 'utf8');

const traceImport = "import ProducerTraceabilityPanel from '../producer-traceability/ProducerTraceabilityPanel';";
const financeImport = "import ProducerFinancePanel from '../producer-finance/ProducerFinancePanel';";

if (!source.includes(traceImport)) {
  const importEnd = source.lastIndexOf('\nimport ');
  if (importEnd < 0) throw new Error('SellerPanel import block not found; refusing unsafe patch.');
  const lineEnd = source.indexOf('\n', importEnd + 1);
  source = source.slice(0, lineEnd + 1) + traceImport + '\n' + financeImport + '\n' + source.slice(lineEnd + 1);
}

if (!source.includes('producerSubview')) {
  const signature = source.match(/export default function SellerPanel[\s\S]*?\}\)\s*\{/);
  if (!signature || signature.index == null) throw new Error('SellerPanel function signature not found; refusing unsafe patch.');
  const pos = signature.index + signature[0].length;
  source = source.slice(0, pos) + "\n const[producerSubview,setProducerSubview]=useState<'dashboard'|'traceability'|'finance'>('dashboard');" + source.slice(pos);
}

if (!source.includes("producerSubview==='traceability'")) {
  const marker = source.search(/if\s*\(\s*!overview\.producer\s*\)/);
  if (marker < 0) throw new Error('SellerPanel producer branch marker not found; refusing unsafe patch.');
  const block = " if(producerSubview==='traceability')return<ProducerTraceabilityPanel onBack={()=>setProducerSubview('dashboard')} onChanged={load}/>;\n if(producerSubview==='finance')return<ProducerFinancePanel onBack={()=>setProducerSubview('dashboard')}/>;\n ";
  source = source.slice(0, marker) + block + source.slice(marker);
}

if (!source.includes('Lot & İzlenebilirlik yönetimini aç')) {
  const compact = 'return<div className="space-y-5">';
  const spaced = 'return <div className="space-y-5">';
  let marker = source.lastIndexOf(compact);
  let token = compact;
  if (marker < 0) { marker = source.lastIndexOf(spaced); token = spaced; }
  if (marker < 0) throw new Error('SellerPanel dashboard return marker not found; refusing unsafe patch.');
  const pos = marker + token.length;
  const buttons = `\n  <div className="grid gap-3 sm:grid-cols-2">\n   <button onClick={()=>setProducerSubview('traceability')} className="min-h-16 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4 text-left">\n    <div className="font-bold">Lot & İzlenebilirlik</div><div className="mt-1 text-sm text-gray-500">Hasat, üretim, köy, parti olayları ve yayınlanan trace kodları</div>\n    <span className="mt-2 inline-block font-semibold text-brand-green">Lot & İzlenebilirlik yönetimini aç</span>\n   </button>\n   <button onClick={()=>setProducerSubview('finance')} className="min-h-16 rounded-2xl border border-brand-gold/30 bg-brand-gold/5 p-4 text-left">\n    <div className="font-bold">Finans Detayı</div><div className="mt-1 text-sm text-gray-500">Gerçek bakiye ve payout geçmişi</div>\n    <span className="mt-2 inline-block font-semibold text-brand-gold">Finans detaylarını aç</span>\n   </button>\n  </div>`;
  source = source.slice(0, pos) + buttons + source.slice(pos);
}

fs.writeFileSync(target, source);
console.log(`Seller traceability and finance integrated into ${target}`);

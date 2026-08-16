import fs from 'node:fs';

function replaceOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(from, to);
}

{
  const path='src/App.tsx';
  let source=fs.readFileSync(path,'utf8');
  source=replaceOnce(source,"import { Network } from '@capacitor/network';",'', 'Remove direct Network import');
  source=replaceOnce(source,"import { useDeviceTheme } from './features/appearance/useDeviceTheme';","import { useDeviceTheme } from './features/appearance/useDeviceTheme';import { useConnectivity } from './features/resilience/useConnectivity';",'Connectivity import');
  source=replaceOnce(source,'const { unreadCount, setUnreadCount } = useUnreadNotificationCount(!!currentUser);','const { unreadCount, setUnreadCount, refreshUnreadCount } = useUnreadNotificationCount(!!currentUser);\n  const { isOnline, restoreSequence } = useConnectivity();','Connectivity state');
  source=replaceOnce(source,'    let networkHandle: { remove: () => Promise<void> } | undefined;\n','', 'Remove native network handle');

  const networkStart=source.indexOf("    void Network.addListener('networkStatusChange'");
  if(networkStart<0)throw new Error('Old network listener not found');
  const networkEndMarker="    }).then(handle => {\n      if (disposed) void handle.remove();\n      else networkHandle = handle;\n    });\n\n";
  const networkEnd=source.indexOf(networkEndMarker,networkStart);
  if(networkEnd<0)throw new Error('Old network listener end not found');
  source=source.slice(0,networkStart)+source.slice(networkEnd+networkEndMarker.length);
  source=replaceOnce(source,'      if (networkHandle) void networkHandle.remove();\n','', 'Remove network cleanup');

  const fetchCartEffect='  useEffect(() => {\n    void fetchCart();\n  }, [currentUser]);';
  const reconnectEffect=`  useEffect(() => {\n    if (restoreSequence === 0) return;\n    showToast('İnternet bağlantısı geri geldi. Güncel veriler doğrulanıyor.');\n    if (currentUser) {\n      void fetchCart();\n      void refreshUnreadCount();\n    }\n  }, [restoreSequence, currentUser?.id]);\n\n${fetchCartEffect}`;
  source=replaceOnce(source,fetchCartEffect,reconnectEffect,'Reconnect refresh effect');

  const headerNeedle='      <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 shadow-sm transition-all duration-300" style={{ paddingTop: \'env(safe-area-inset-top, 0px)\' }}>\n        <div className="max-w-7xl mx-auto px-4 md:px-6 relative">';
  const headerReplacement='      <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 shadow-sm transition-all duration-300" style={{ paddingTop: \'env(safe-area-inset-top, 0px)\' }}>\n        {!isOnline ? <div role="status" aria-live="polite" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-100">Çevrimdışısınız. Son yüklenen bilgiler gösterilebilir; sepet, sipariş ve hesap değişiklikleri bağlantı geri gelene kadar tamamlanamaz.</div> : null}\n        <div className="max-w-7xl mx-auto px-4 md:px-6 relative">';
  source=replaceOnce(source,headerNeedle,headerReplacement,'Offline header banner');
  fs.writeFileSync(path,source);
}

{
  const path='src/features/catalog/useLiveHomeCatalog.ts';
  let source=fs.readFileSync(path,'utf8');
  source=replaceOnce(source,"import { getProducerFollowMetrics, getPublicHomeCatalog, listPublicCategories, publicCatalogUrl } from './api';","import { getProducerFollowMetrics, getPublicHomeCatalog, listPublicCategories, publicCatalogUrl } from './api';\nimport { NETWORK_RESTORED_EVENT } from '../resilience/useConnectivity';",'Home connectivity import');
  source=replaceOnce(source,"  const [error, setError] = useState('');","  const [error, setError] = useState('');\n  const [reloadSequence, setReloadSequence] = useState(0);\n\n  useEffect(() => {\n    const restore = () => setReloadSequence(value => value + 1);\n    window.addEventListener(NETWORK_RESTORED_EVENT, restore);\n    return () => window.removeEventListener(NETWORK_RESTORED_EVENT, restore);\n  }, []);",'Home restore listener');
  source=replaceOnce(source,"          setProducts([]);\n          setCategories([]);\n          setError(err?.message || 'Canlı katalog yüklenemedi.');","          setError(err?.message || 'Canlı katalog yüklenemedi.');",'Preserve last home data');
  source=replaceOnce(source,'  }, []);\n\n  return { products, categories, loading, error };','  }, [reloadSequence]);\n\n  return { products, categories, loading, error };','Home reload dependency');
  fs.writeFileSync(path,source);
}

console.log('Offline/reconnect resilience integrated.');

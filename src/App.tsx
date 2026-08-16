import React, { useState, useEffect, useCallback } from 'react';import { Capacitor } from '@capacitor/core';import { Haptics, ImpactStyle } from '@capacitor/haptics';import { App as CapApp } from '@capacitor/app';import { Network } from '@capacitor/network';import { X, Search, ShoppingCart, Heart, User, ChevronRight, Star, Bell, ArrowRight, Sun, Droplet, Gem, Flame, Home, Grid, Filter, Fish, Cherry, CheckCircle, Mic, SlidersHorizontal, ArrowDownUp, Box, Mountain, Calendar } from 'lucide-react';import { HERO_CATEGORIES } from './data';import { DataProvider, useData } from './context/DataContext';import { AdminPage } from './pages/AdminPage';import AccountCenter from './features/account/AccountCenter';import { useUnreadNotificationCount } from './features/account/useUnreadNotificationCount';import ProducerApplicationFlow from './features/producer-onboarding/ProducerApplicationFlow';import { usePublicStorefrontConfig } from './features/storefront/usePublicStorefrontConfig';import PublicInfoScreen from './features/storefront/PublicInfoScreen';import PublicHealthScreen from './features/content/PublicHealthScreen';import PublicEventsScreen from './features/engagement/PublicEventsScreen';import PublicContactScreen from './features/engagement/PublicContactScreen';import { useCatalogFilterOptions } from './features/catalog/useCatalogFilterOptions';import { useLiveHomeCatalog } from './features/catalog/useLiveHomeCatalog';import { listFavoriteReferences as serverFavoriteReferences, searchCatalog as serverCatalogSearch, toggleProductFavorite as serverToggleProductFavorite } from './features/catalog/api';import CategoryDirectoryScreen from './features/catalog/CategoryDirectoryScreen';import PublicProducerScreen from './features/catalog/PublicProducerScreen';import ProductDetailScreen from './features/catalog/ProductDetailScreen';import CatalogProductCard from './features/catalog/CatalogProductCard';import CatalogSearchResults from './features/catalog/CatalogSearchResults';import CatalogSearchOverlay from './features/catalog/CatalogSearchOverlay';import AuthScreen from './features/auth/AuthScreen';import PasswordRecoveryScreen from './features/auth/PasswordRecoveryScreen';import { useAuthRecoveryCoordinator } from './features/auth/useAuthRecoveryCoordinator';import { getAdminSessionStatus, signOutCurrentSession } from './features/auth/api';import { getCart as getServerCart, publicCatalogUrl as serverCatalogUrl, removeCartItem as removeServerCartItem, resolveDefaultVariant, setCartItem as setServerCartItem } from './features/cart/api';import CartCheckoutFlow from './features/cart/CartCheckoutFlow';import GiftOrderFlow from './features/gifts/GiftOrderFlow';import { syncNativeAppearance } from './native';import { query } from 'firebase/firestore';

// --- Types ---
type Tab = 'home' | 'categories' | 'cart' | 'account' | 'product-detail' | 'search-results' | 'producer-profile' | 'events' | 'health' | 'contact' | 'about' | 'admin';
const SUPPORTED_TABS = new Set<Tab>(['home','categories','cart','account','product-detail','search-results','producer-profile','events','health','contact','about','admin']);
const isSupportedTab = (value: string | null): value is Tab => !!value && SUPPORTED_TABS.has(value as Tab);
type AccountTab = 'profile' | 'addresses' | 'payments' | 'notifications' | 'settings' | 'feedback';

// --- Main App Component ---
function AppContent() {
  const { settings, updateSettings, addNotification, currentUser, setCurrentUser, products, recipes, productHealthInfo, blogPosts, staticContent, contactInfo, events, seedDatabase, heroCategories, homeSections } = useData();
  const [currentTab, setCurrentTab] = useState<Tab>('home');
  const [tabHistory, setTabHistory] = useState<Tab[]>(['home']);

  // URL Routing & SEO Sync (Added by System Architect)
  useEffect(() => {
    const applyUrlTab = () => {
      const params = new URLSearchParams(window.location.search);
      const rawTab = params.get('tab');
      const nextTab: Tab = isSupportedTab(rawTab) ? rawTab : 'home';
      setCurrentTab(previous => previous === nextTab ? previous : nextTab);
    };
    window.addEventListener('popstate', applyUrlTab);
    applyUrlTab();
    return () => window.removeEventListener('popstate', applyUrlTab);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') !== currentTab) {
      params.set('tab', currentTab);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }

    const tabTitles: Partial<Record<Tab, string>> = {
      home: 'Golden Oremar | Doğrulanmış Üreticilerden Köy Ürünleri',
      categories: 'Ürün Kategorileri | Golden Oremar',
      cart: 'Sepetim | Golden Oremar',
      account: 'Hesabım | Golden Oremar',
      admin: 'Yönetim | Golden Oremar',
    };
    const tabDescriptions: Partial<Record<Tab, string>> = {
      home: 'Doğrulanmış üreticilerden köy ve yöresel ürünleri keşfedin; ürün ve menşe bilgilerini şeffaf biçimde inceleyin.',
      categories: 'Golden Oremar ürün kategorilerini ve doğrulanmış üretici ürünlerini keşfedin.',
      cart: 'Sepetinizdeki ürün, varyant ve adetleri kontrol ederek güvenli sipariş akışına devam edin.',
      account: 'Sipariş, favori, mesaj, adres ve hesap ayarlarınızı yönetin.',
    };
    const title = tabTitles[currentTab] || 'Golden Oremar';
    const description = tabDescriptions[currentTab] || 'Golden Oremar köy ve yöresel ürünler pazaryeri.';

    document.title = title;

    const setMeta = (selector: string, attribute: 'name' | 'property', key: string, content: string) => {
      let element = document.querySelector<HTMLMetaElement>(selector);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    setMeta('meta[name="title"]', 'name', 'title', title);
    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  }, [currentTab]);

  const [accountView, setAccountView] = useState<string>('menu');
  const authRecovery = useAuthRecoveryCoordinator();
  const { unreadCount, setUnreadCount } = useUnreadNotificationCount(!!currentUser);

  useEffect(() => {
    if (!authRecovery.callbackHandled) return;
    setCurrentTab('account');
    setAccountView('menu');
    setTabHistory(previous => previous[previous.length - 1] === 'account' ? previous : [...previous, 'account']);
    if (!authRecovery.recoveryPending) authRecovery.acknowledgeCallback();
  }, [authRecovery.callbackHandled, authRecovery.recoveryPending, authRecovery.acknowledgeCallback]);

  const [adminSession, setAdminSession] = useState<{ checked: boolean; isAdmin: boolean; roles: string[] }>({ checked: false, isAdmin: false, roles: [] });
  const isAdminLoggedIn = adminSession.checked && adminSession.isAdmin;

  useEffect(() => {
    let active = true;
    if (!currentUser?.id) {
      setAdminSession({ checked: true, isAdmin: false, roles: [] });
      return () => { active = false; };
    }
    setAdminSession(previous => ({ ...previous, checked: false }));
    getAdminSessionStatus()
      .then(status => {
        if (active) setAdminSession({ checked: true, isAdmin: status.is_admin === true, roles: status.roles });
      })
      .catch(error => {
        console.error('Supabase admin session verification failed', error);
        if (active) setAdminSession({ checked: true, isAdmin: false, roles: [] });
      });
    return () => { active = false; };
  }, [currentUser?.id]);

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    if (!currentUser) {
      setFavorites([]);
      return () => { active = false; };
    }
    serverFavoriteReferences()
      .then((refs) => { if (active) setFavorites(refs); })
      .catch((error) => console.error('Supabase favorites hydration failed', error));
    return () => { active = false; };
  }, [currentUser]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductReference, setSelectedProductReference] = useState<string | null>(null);
  const [selectedProducerReference, setSelectedProducerReference] = useState<string | null>(null);
  const [searchCategorySlug, setSearchCategorySlug] = useState<string | null>(null);
  const [searchProducerId, setSearchProducerId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeOrigin, setActiveOrigin] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<string>('all');
  const [sortOption, setSortOption] = useState<string>('featured');
  const { categories: catalogFilterCategories, origins: catalogFilterOrigins } = useCatalogFilterOptions();
  
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isSortPanelOpen, setIsSortPanelOpen] = useState(false);

  // Voice Search states
  const [isListening, setIsListening] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const [voiceError, setVoiceError] = useState('');

  const processVoiceCommand = async (text: string) => {
    const rawText = text.toLowerCase().trim();
    const commandWords = ["sepete ekle", "sepetine ekle", "ekle", "satın al", "satin al"];
    let isCommand = false;
    let cleanProductQuery = text;

    for (const cmd of commandWords) {
      if (rawText.endsWith(cmd)) {
        isCommand = true;
        cleanProductQuery = text.substring(0, text.toLowerCase().lastIndexOf(cmd)).trim();
        break;
      }
      if (rawText.includes(cmd)) {
        isCommand = true;
        cleanProductQuery = text.replace(new RegExp(cmd, 'gi'), '').trim();
        break;
      }
    }

    if (isCommand && cleanProductQuery) {
      try {
        const result = await serverCatalogSearch({ query: cleanProductQuery, inStock: true, sort: 'relevance', limit: 5, offset: 0 });
        const matched = result.items?.[0];
        if (!matched) {
          setSpeechText('Aradığınız satılabilir ürün bulunamadı.');
          setVoiceError('Aradığınız satılabilir ürün bulunamadı.');
          setTimeout(() => setIsListening(false), 2200);
          return;
        }
        await addToCart({
          id: matched.id,
          slug: matched.slug,
          name: matched.name,
          variantId: matched.variant?.id,
        }, 1, true);
        setSpeechText(
          matched.name + ' sepetinize eklendi.'
        );
        showToast(matched.name + ' sepetinize eklendi.');
        setTimeout(() => setIsListening(false), 800);
      } catch (error: any) {
        const message = String(error?.message || 'Sesli ürün araması tamamlanamadı.');
        setVoiceError(message);
        setTimeout(() => setIsListening(false), 2500);
      }
      return;
    }

    setSearchQuery(text.trim());
    setSearchCategorySlug(null);
    setSearchProducerId(null);
    navigateToTab('search-results');
    showToast('Sesle aranan: "' + text.trim() + '"');
    setTimeout(() => setIsListening(false), 800);
  };

  const triggerVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsListening(true);
      setSpeechText('');
      setVoiceError('Bu cihazda tarayıcı sesli araması desteklenmiyor. Arama kutusunu kullanabilirsiniz.');
      setTimeout(() => setIsListening(false), 3500);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'tr-TR';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechText('');
        setVoiceError('');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        setSpeechText(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          setVoiceError('Mikrofon izni verilmedi. Lütfen tarayıcı ayarlarından mikrofona izin verin ya da uygulamayı sağ üstteki "Yeni Sekmede Aç" butonuyla açıp deneyin.');
        } else {
          setVoiceError('Ses anlaşılamadı, lütfen tekrar deneyin.');
        }
        setTimeout(() => {
          setIsListening(false);
        }, 5000);
      };

      recognition.onend = () => {
        setTimeout(() => {
          setIsListening((current) => {
            if (current) {
              setSpeechText((txt) => {
                if (txt && txt.trim()) {
                  processVoiceCommand(txt.trim());
                }
                return txt;
              });
            }
            return false;
          });
        }, 800);
      };

      (window as any)._currentRecognition = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start SpeechRecognition", err);
      setIsListening(false);
    }
  };

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [toast, setToast] = useState<{message: string, visible: boolean}>({ message: '', visible: false });
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftProduct, setGiftProduct] = useState<any>(null);
  const [healthTab, setHealthTab] = useState<'recipes' | 'health' | 'productHealth'>('recipes');
  const [recipeCategory, setRecipeCategory] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [selectedBlog, setSelectedBlog] = useState<any>(null);
  const [favoriteRecipes, setFavoriteRecipes] = useState<number[]>([]);
  const [favoriteBlogs, setFavoriteBlogs] = useState<number[]>([]);
  const [favoriteProductHealth, setFavoriteProductHealth] = useState<number[]>([]);
  const [favoriteEvents, setFavoriteEvents] = useState<string[]>([]);
  const [likedItems, setLikedItems] = useState<string[]>([]);
  const [followedVendors, setFollowedVendors] = useState<string[]>([]);

  const toggleFollowVendor = (vendorId: string) => {
    if (followedVendors.includes(vendorId)) {
      setFollowedVendors(followedVendors.filter(id => id !== vendorId));
      showToast('Mağaza takipten çıkarıldı.');
    } else {
      setFollowedVendors([...followedVendors, vendorId]);
      showToast('Mağaza takip ediliyor.');
    }
  };

  const toggleFavoriteEvent = (event: any) => {
    setFavoriteEvents(prev => 
      prev.includes(event.id) ? prev.filter(id => id !== event.id) : [...prev, event.id]
    );
    showToast(favoriteEvents.includes(event.id) ? 'Favorilerden çıkarıldı' : 'Favorilere eklendi');
  };

  const toggleLikeItem = (itemId: string) => {
    setLikedItems(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const navigateToTab = (tab: Tab) => {
    if (tab === 'admin' && !isAdminLoggedIn) {
      showToast(adminSession.checked ? 'Bu alan için doğrulanmış yönetici yetkisi gerekiyor.' : 'Yönetici yetkisi doğrulanıyor.');
      if (currentTab !== 'account') {
        setTabHistory(prev => [...prev, 'account']);
        setCurrentTab('account');
      }
      return;
    }
    if (tab !== currentTab) {
      setTabHistory(prev => [...prev, tab]);
      setCurrentTab(tab);
    }
  };

  const goBack = () => {
    if (currentTab === 'account' && accountView !== 'menu') {
      setAccountView('menu');
      return;
    }
    
    if (tabHistory.length > 1) {
      const newHistory = [...tabHistory];
      newHistory.pop(); // remove current
      const prevTab = newHistory[newHistory.length - 1];
      setTabHistory(newHistory);
      setCurrentTab(prevTab);
    } else {
      setCurrentTab('home');
    }
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let disposed = false;
    let appBackHandle: { remove: () => Promise<void> } | undefined;
    let networkHandle: { remove: () => Promise<void> } | undefined;

    void CapApp.addListener('backButton', () => {
      if (authRecovery.recoveryPending) {
        return;
      }
      if (isSearchFocused) {
        setIsSearchFocused(false);
        return;
      }
      if (showGiftModal) {
        setShowGiftModal(false);
        return;
      }
      if (isFilterPanelOpen) {
        setIsFilterPanelOpen(false);
        return;
      }
      if (isSortPanelOpen) {
        setIsSortPanelOpen(false);
        return;
      }
      if (currentTab === 'account' && accountView !== 'menu') {
        setAccountView('menu');
        return;
      }
      if (tabHistory.length > 1) {
        goBack();
        return;
      }
      void CapApp.exitApp();
    }).then(handle => {
      if (disposed) void handle.remove();
      else appBackHandle = handle;
    });

    void Network.addListener('networkStatusChange', status => {
      if (!status.connected) showToast('İnternet bağlantısı kesildi.');
    }).then(handle => {
      if (disposed) void handle.remove();
      else networkHandle = handle;
    });

    return () => {
      disposed = true;
      if (appBackHandle) void appBackHandle.remove();
      if (networkHandle) void networkHandle.remove();
    };
  }, [tabHistory, currentTab, accountView, isSearchFocused, showGiftModal, isFilterPanelOpen, isSortPanelOpen, authRecovery.recoveryPending]);


  const getAccountViewTitle = (view: string) => {
    switch (view) {
      case 'menu': return 'Hesabım';
      case 'orders': return 'Siparişlerim';
      case 'addresses': return 'Adreslerim';
      case 'payments': return 'Ödeme Yöntemleri';
      case 'notifications': return 'Bildirimler';
      case 'gifts': return 'Hediye Ettiklerim';
      case 'support': return 'Yardım & Destek';
      case 'contact': return 'İletişim';
      case 'about': return 'Hakkımızda';
      case 'settings': return 'Ayarlar';
      case 'policy-returns': return 'İade Politikası';
      case 'policy-privacy': return 'Gizlilik Politikası';
      case 'policy-terms': return 'Kullanım Koşulları';
      case 'vendor-apply': return 'Satıcı Ol';
      case 'vendor-dashboard': return 'Satıcı Paneli';
      default: return 'Hesabım';
    }
  };

  // Effects
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    void syncNativeAppearance(settings.theme).catch(error => {
      console.warn('Native appearance sync failed', error);
    });
  }, [settings.theme]);

  // Audio Helper
  const playNotificationSound = (soundType: string) => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    
    switch (soundType) {
      case 'village': // Chirp-like
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1500, now);
        osc.frequency.exponentialRampToValueAtTime(2000, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        
        // Second chirp
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1500, now + 0.15);
        osc2.frequency.exponentialRampToValueAtTime(2500, now + 0.25);
        gain2.gain.setValueAtTime(0.1, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.25);
        break;
        
      case 'drop': // Water drop
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
        
      case 'wind': // White noise-ish (simulated with low freq sine FM)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.5);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
        
      case 'bell': // Ding
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // A5
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1);
        osc.start(now);
        osc.stop(now + 1);
        break;
        
      default: // Standard beep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    }
  };

  // Helpers
  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  }, []);

  useEffect(() => {
    if (!authRecovery.error) return;
    showToast(authRecovery.error);
    authRecovery.clearError();
  }, [authRecovery.error, authRecovery.clearError, showToast]);

  useEffect(() => {
    if (currentTab === 'admin' && adminSession.checked && !adminSession.isAdmin) {
      setCurrentTab('account');
      setAccountView('home');
      showToast('Bu alan için doğrulanmış yönetici yetkisi gerekiyor.');
    }
  }, [currentTab, adminSession.checked, adminSession.isAdmin, showToast]);

  const applyServerCartSnapshot = (snapshot: any) => {
    const nextItems = (snapshot?.items || []).map((item: any) => ({
      id: item.productId,
      slug: item.slug,
      name: item.productName,
      price: Number(item.priceMinor || 0) / 100,
      image: serverCatalogUrl(item.imagePath),
      quantity: item.quantity,
      variantId: item.variantId,
      variantName: item.variantName,
      cartItemId: item.cartItemId,
      selectedOptions: item.selectedOptions || {},
      sellableQuantity: item.sellableQuantity,
      producer: item.producer,
      _serverCart: true,
    }));
    setCart(nextItems);
    return snapshot;
  };

  const fetchCart = async () => {
    try {
      const snapshot = await getServerCart();
      applyServerCartSnapshot(snapshot);
    } catch (err: any) {
      // Authentication migration is handled separately; never fall back to Firestore.
      if (!String(err?.message || '').includes('authentication_required')) {
        console.error('Failed to fetch Supabase cart', err);
      }
      setCart([]);
    }
  };

  useEffect(() => {
    void fetchCart();
  }, [currentUser]);

  const addToCart = async (product: any, quantity: number = 1, silent: boolean = false) => {
    if (Capacitor.isNativePlatform()) {
      try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (e) {}
    }
    try {
      const reference = product.slug || String(product.id);
      const existing = cart.find((item: any) => item.slug === product.slug || String(item.id) === String(product.id));
      let variantId = product.variantId || existing?.variantId;
      let selectedOptions = existing?.selectedOptions || {};
      if (!variantId) {
        const resolved = await resolveDefaultVariant(reference);
        variantId = resolved.variant.id;
        selectedOptions = resolved.variant.options || {};
      }
      const nextQuantity = Math.min(99, Math.max(1, Number(existing?.quantity || 0) + quantity));
      const snapshot = await setServerCartItem({ variantId, quantity: nextQuantity, selectedOptions });
      applyServerCartSnapshot(snapshot);
      if (!silent) showToast(`${product.name || product.title} özenle sepetinize eklendi!`);
    } catch (err: any) {
      const message = String(err?.message || 'Ürün sepete eklenemedi.');
      if (message.includes('authentication_required')) {
        showToast('Sepeti kaydetmek için hesabınıza giriş yapın.');
        navigateToTab('account');
        return;
      }
      showToast(message.includes('insufficient_stock') ? 'Bu ürün için yeterli stok kalmadı.' : message);
    }
  };

  const updateCartQuantity = async (productId: string | number, delta: number) => {
    const item = cart.find((row: any) => String(row.id) === String(productId));
    if (!item?.variantId) return;
    try {
      const nextQuantity = Math.max(0, Math.min(99, Number(item.quantity || 1) + delta));
      const snapshot = await setServerCartItem({ variantId: item.variantId, quantity: nextQuantity, selectedOptions: item.selectedOptions || {} });
      applyServerCartSnapshot(snapshot);
    } catch (err: any) {
      showToast(String(err?.message || 'Sepet güncellenemedi.'));
    }
  };

  const removeFromCart = async (productId: string | number) => {
    const item = cart.find((row: any) => String(row.id) === String(productId));
    if (!item?.cartItemId) return;
    try {
      const snapshot = await removeServerCartItem(item.cartItemId);
      applyServerCartSnapshot(snapshot);
      showToast('Ürün sepetten çıkarıldı.');
    } catch (err: any) {
      showToast(String(err?.message || 'Ürün sepetten çıkarılamadı.'));
    }
  };

  const toggleFavorite = async (product: any) => {
    if (Capacitor.isNativePlatform()) {
      try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (e) {}
    }
    if (!currentUser) {
      showToast('Favorileri kaydetmek için hesabınıza giriş yapın.');
      navigateToTab('account');
      return;
    }
    try {
      const result = await serverToggleProductFavorite(product.slug || product.legacyId || product.id);
      const reference = String(result?.productReference || product.legacyId || product.id);
      setFavorites((previous) => result?.isFavorite
        ? (previous.includes(reference) ? previous : [...previous, reference])
        : previous.filter((id) => id !== reference));
      showToast(result?.isFavorite ? String(product.name || 'Ürün') + ' favorilerinize eklendi.' : String(product.name || 'Ürün') + ' favorilerinizden çıkarıldı.');
    } catch (error: any) {
      showToast(String(error?.message || 'Favori işlemi tamamlanamadı.'));
    }
  };

  const toggleFavoriteRecipe = (recipe: any) => {
    if (favoriteRecipes.includes(recipe.id)) {
      setFavoriteRecipes(favoriteRecipes.filter(id => id !== recipe.id));
      showToast(`${recipe.title} favorilerden çıkarıldı.`);
    } else {
      setFavoriteRecipes([...favoriteRecipes, recipe.id]);
      showToast(`${recipe.title} favorilere eklendi.`);
    }
  };

  const toggleFavoriteBlog = (blog: any) => {
    if (favoriteBlogs.includes(blog.id)) {
      setFavoriteBlogs(favoriteBlogs.filter(id => id !== blog.id));
      showToast(`${blog.title} favorilerden çıkarıldı.`);
    } else {
      setFavoriteBlogs([...favoriteBlogs, blog.id]);
      showToast(`${blog.title} favorilere eklendi.`);
    }
  };

  const toggleFavoriteProductHealth = (info: any) => {
    if (favoriteProductHealth.includes(info.productId)) {
      setFavoriteProductHealth(favoriteProductHealth.filter(id => id !== info.productId));
      showToast(`${info.title} favorilerden çıkarıldı.`);
    } else {
      setFavoriteProductHealth([...favoriteProductHealth, info.productId]);
      showToast(`${info.title} favorilere eklendi.`);
    }
  };

  const handleShareArticle = (article: any) => {
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.summary,
        url: window.location.href,
      }).catch(() => showToast('Paylaşım iptal edildi.'));
    } else {
      showToast('Link kopyalandı!');
    }
  };

  const handleProductClick = (product: any) => {
    const reference = product?.slug || product?.legacyId || String(product?.id || '');
    if (!reference) {
      showToast('Ürün referansı bulunamadı.');
      return;
    }
    setSelectedProduct(product);
    setSelectedProductReference(reference);
    navigateToTab('product-detail');
    window.scrollTo(0, 0);
  };

  const openGiftModal = (product: any) => {
    if (!currentUser) {
      setGiftProduct(product);
      showToast('Hediye siparişi için hesabınıza giriş yapın.');
      navigateToTab('account');
      return;
    }
    setGiftProduct(product);
    setShowGiftModal(true);
  };

  const handleShare = (product: any) => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: product.description,
        url: window.location.href,
      }).catch(() => showToast('Paylaşım iptal edildi.'));
    } else {
      showToast('Link kopyalandı!');
    }
  };

  // Render Content
  const renderContent = () => {
    if (currentTab === 'product-detail' && (selectedProductReference || selectedProduct)) {
      const productReference = selectedProductReference || selectedProduct?.slug || selectedProduct?.legacyId || String(selectedProduct?.id || '');
      return (
        <ProductDetailScreen
          reference={productReference}
          authenticated={!!currentUser}
          favoriteReferences={favorites}
          onFavoriteChanged={(reference: string, isFavorite: boolean) => setFavorites((previous) => isFavorite
            ? (previous.includes(reference) ? previous : [...previous, reference])
            : previous.filter((item) => item !== reference))}
          onBack={goBack}
          onLoginRequired={() => { showToast('Bu işlem için hesabınıza giriş yapın.'); navigateToTab('account'); }}
          onCartChanged={fetchCart}
          onGift={(reference) => {
            if (!currentUser) {
              showToast('Hediye siparişi için hesabınıza giriş yapın.');
              navigateToTab('account');
              return;
            }
            setGiftProduct({ id: reference, slug: reference });
            setShowGiftModal(true);
          }}
          onProducer={(_producerId, producerSlug) => {
            setSelectedProducerReference(producerSlug);
            navigateToTab('producer-profile');
          }}
        />
      );
    }

    if (currentTab === 'producer-profile' && selectedProducerReference) {
      return (
        <PublicProducerScreen
          reference={selectedProducerReference}
          authenticated={!!currentUser}
          onBack={goBack}
          onLoginRequired={() => { showToast('Bu işlem için hesabınıza giriş yapın.'); navigateToTab('account'); }}
          onOpenConversation={(conversationId) => { setAccountView(`messages:${conversationId}`); navigateToTab('account'); }}
          onOpenProduct={(slug) => {
            setSelectedProduct(null);
            setSelectedProductReference(slug);
            navigateToTab('product-detail');
          }}
          onAddToCart={async (product, quantity) => {
            await addToCart(product, quantity);
          }}
        />
      );
    }

    if (currentTab === 'search-results') {
      return (
        <CatalogSearchResults
          query={searchQuery}
          categorySlug={searchCategorySlug}
          producerId={searchProducerId}
          onBack={goBack}
          onOpenProduct={(slug) => {
            setSelectedProduct(null);
            setSelectedProductReference(slug);
            navigateToTab('product-detail');
          }}
          onAddToCart={async (item) => {
            await addToCart({
              id: item.id,
              slug: item.slug,
              name: item.name,
              variantId: item.variant?.id,
            }, 1);
          }}
        />
      );
    }

    if (currentTab === 'account') {
      if (authRecovery.recoveryPending) {
        return (
          <PasswordRecoveryScreen
            onCompleted={() => {
              authRecovery.finishRecovery();
              setAccountView('menu');
              showToast('Şifreniz güvenle güncellendi.');
            }}
            onCancelled={() => {
              authRecovery.finishRecovery();
              setCurrentUser(null);
              setAccountView('menu');
              showToast('Şifre sıfırlama işlemi iptal edildi.');
            }}
          />
        );
      }

      if (!currentUser) {
        return <AuthScreen title="Golden Oremar Hesabı" onAuthenticated={() => setAccountView('menu')} />;
      }

      if (accountView === 'vendor-apply') {
        return <ProducerApplicationFlow currentUser={currentUser} onBack={() => setAccountView('menu')} />;
      }

      return (
        <AccountCenter
          requestedView={accountView}
          theme={settings.theme}
          onThemeChange={(nextTheme) => updateSettings({ theme: nextTheme })}
          onBack={goBack}
          onOpenProduct={(slug) => {
            setSelectedProduct(null);
            setSelectedProductReference(slug);
            navigateToTab('product-detail');
          }}
          onOpenProducer={(slug) => {
            setSelectedProducerReference(slug);
            navigateToTab('producer-profile');
          }}
          onStartGift={() => navigateToTab('home')}
          onOpenContact={() => navigateToTab('contact')}
          onOpenHealth={() => navigateToTab('health')}
          onOpenEvents={() => navigateToTab('events')}
          onOpenAdmin={() => navigateToTab('admin')}
          onOpenSellerApplication={() => setAccountView('vendor-apply')}
          onUnreadNotificationCountChange={setUnreadCount}
          onOpenNotificationAction={(url, metadata) => {
            if (url?.includes('/messages/')) {
              const conversationId = metadata?.conversationId || url.split('/messages/')[1]?.split(/[?#/]/)[0] || '';
              setAccountView(conversationId ? `messages:${conversationId}` : 'messages');
            }
            else if (metadata?.orderId) setAccountView(`orders:${metadata.orderId}`);
            else if (url?.includes('producer')) setAccountView('seller');
            else if (url?.includes('order')) setAccountView('orders');
          }}
        />
      );
    }

    if (currentTab === 'cart') {
      if (!currentUser) {
        return <AuthScreen title="Sepetinizi kullanmak için hesabınıza giriş yapın." description="Sepetiniz, stok rezervasyonunuz ve siparişiniz hesabınıza güvenli şekilde bağlanır." />;
      }

      return (
        <CartCheckoutFlow
          onBack={() => navigateToTab('home')}
          onOpenAddresses={() => { navigateToTab('account'); setAccountView('addresses'); }}
          onOrderCreated={() => {
            setCart([]);
            setAccountView('orders');
          }}
        />
      );
    }

    if (currentTab === 'categories') {
      return (
        <CategoryDirectoryScreen
          onOpenProduct={(slug) => {
            setSelectedProduct(null);
            setSelectedProductReference(slug);
            navigateToTab('product-detail');
          }}
          onAddToCart={async (item) => {
            await addToCart({ id: item.id, slug: item.slug, name: item.name, variantId: item.variant?.id }, 1);
          }}
        />
      );
    }

    if (currentTab === 'events') {
      return <PublicEventsScreen onBack={goBack} currentUser={currentUser} />;
    }

    if (currentTab === 'health') {
      return (
        <PublicHealthScreen
          onBack={goBack}
          authenticated={!!currentUser}
          locale={currentUser?.locale || 'tr'}
          onLoginRequired={() => { showToast('İçerikleri favoriye kaydetmek için hesabınıza giriş yapın.'); navigateToTab('account'); }}
          onOpenProduct={(slug) => {
            setSelectedProduct(null);
            setSelectedProductReference(slug);
            navigateToTab('product-detail');
          }}
        />
      );
    }

    if (currentTab === 'contact') {
      return <PublicContactScreen onBack={goBack} currentUser={currentUser} locale={currentUser?.locale || 'tr'} />;
    }

    if (currentTab === 'about') {
      return <PublicInfoScreen page="about" locale={currentUser?.locale || 'tr'} onBack={goBack} />;
    }


    return (
      <HomeSection 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onProductClick={handleProductClick}
        onAddToCart={addToCart}
        onToggleFavorite={toggleFavorite}
        favorites={favorites}
        onShare={handleShare}
        onGift={openGiftModal}
        setCurrentTab={navigateToTab}
        showToast={showToast}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        activeOrigin={activeOrigin}
        setActiveOrigin={setActiveOrigin}
        priceRange={priceRange}
        setPriceRange={setPriceRange}
        sortOption={sortOption}
        setSortOption={setSortOption}
      />
    );
  };

  return (
      currentTab === 'admin' && isAdminLoggedIn ? (
        <AdminPage 
          onBack={goBack}
          onLogout={async () => { 
            await signOutCurrentSession();
            setCurrentUser(null);
            setAdminSession({ checked: true, isAdmin: false, roles: [] }); 
            navigateToTab('home'); 
          }} 
        />
      ) : (
        <div className="min-h-screen bg-brand-main text-brand-text font-sans pb-28 md:pb-0">
          {/* Header */}
          {currentTab !== 'admin' && (
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 shadow-sm transition-all duration-300" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 relative">
          {/* Mobile Layout: Single sleek, high-efficiency horizontal bar */}
          <div className="md:hidden flex h-16 items-center gap-3 py-1 animate-in fade-in slide-in-from-top-1 duration-300">
            {/* Elegant Logo Container in the left corner */}
            <button 
              onClick={() => navigateToTab('home')} 
              className="shrink-0 group relative focus:outline-none" 
              aria-label="Golden Oremar Logo"
            >
              <div className="w-10 h-10 flex items-center justify-center overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-750 shadow-[0_2px_8px_rgba(0,0,0,0.06)] group-hover:scale-105 active:scale-95 transition-all p-1">
                <img src={settings.logoUrl || '/logo.svg'} alt="Golden Oremar Logo" className="w-full h-full object-contain" />
              </div>
            </button>

            {/* Expansive, Sleek Center Search Bar with absolute 16px layouts & target optimization */}
            <div className="flex-1 min-w-0 relative">
              {/* Sol İç Kenar: Büyüteç İkonu (fixed, left: 16px, color: #A0AEC0) */}
              <div className="absolute inset-y-0 left-[16px] flex items-center pointer-events-none z-10">
                <Search className="h-[18px] w-[18px] text-[#A0AEC0] transition-colors" />
              </div>

              <input
                id="mobile-search-input"
                type="text"
                className="block w-full pl-[46px] pr-[46px] py-[14px] bg-gray-100 hover:bg-gray-200/40 dark:bg-[#16191E] dark:hover:bg-[#1d2127] border border-transparent rounded-xl text-xs text-brand-text placeholder-[#A0AEC0] focus:outline-none focus:ring-2 focus:ring-brand-gold/45 focus:bg-white dark:focus:bg-[#16191E] transition-all font-medium h-11"
                placeholder="Şifa dolusu doğal ürünler..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && searchQuery.trim()) {
                    event.preventDefault();
                    setSearchCategorySlug(null);
                    setSearchProducerId(null);
                    setIsSearchFocused(false);
                    navigateToTab('search-results');
                  }
                }}
              />

              {/* Sağ İç Kenar: Mikrofon veya Temizle (right: 16px) */}
              <div className="absolute inset-y-0 right-[16px] flex items-center z-10">
                {searchQuery ? (
                  <button 
                    onClick={() => setSearchQuery('')} 
                    className="p-1 text-[#A0AEC0] hover:text-brand-gold transition-colors focus:outline-none"
                    aria-label="Aramayı Temizle"
                  >
                    <X className="w-[18px] h-[18px]" />
                  </button>
                ) : (
                  <button 
                    onClick={triggerVoiceSearch} 
                    className="p-1 text-[#A0AEC0] hover:text-brand-gold transition-all active:scale-90 focus:outline-none"
                    aria-label="Sesli Arama"
                  >
                    <Mic className="w-[18px] h-[18px]" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Actions (Notifications & Cart) */}
            <div className="flex items-center gap-1 shrink-0">
              <button 
                onClick={() => { navigateToTab('account'); setAccountView('notifications'); }} 
                className="relative p-2 text-gray-500 dark:text-gray-440 hover:text-brand-gold hover:bg-gray-100/70 dark:hover:bg-gray-800 rounded-full transition-all focus:outline-none group"
                aria-label={unreadCount > 0 ? `Bildirimler, ${unreadCount} okunmamış` : 'Bildirimler'}
              >
                <Bell className="w-[1.3rem] h-[1.3rem] group-hover:scale-105 transition-transform" />
                {unreadCount > 0 && (
                  <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full shadow-md ring-1.5 ring-white dark:ring-gray-950 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => navigateToTab('cart')} 
                className="relative p-2 text-gray-500 dark:text-gray-440 hover:text-brand-gold hover:bg-gray-100/70 dark:hover:bg-gray-800 rounded-full transition-all focus:outline-none group"
                aria-label="Sepetim"
              >
                <ShoppingCart className="w-[1.3rem] h-[1.3rem] group-hover:scale-105 transition-transform" />
                {cart.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-brand-gold text-white text-[8px] font-black flex items-center justify-center rounded-full shadow-md ring-1.5 ring-white dark:ring-gray-950 animate-bounce duration-1000">
                    {cart.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Desktop Layout: Single horizontal row */}
          <div className="hidden md:flex h-20 items-center justify-between gap-8 animate-in fade-in slide-in-from-top-1 duration-300">
            {/* Elegant Logo Container in the far left corner */}
            <button 
              onClick={() => navigateToTab('home')} 
              className="shrink-0 group relative focus:outline-none" 
              aria-label="Golden Oremar Logo"
            >
              <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-750 shadow-[0_3px_10px_rgba(0,0,0,0.05)] group-hover:scale-105 active:scale-95 transition-all p-1.5">
                <img src={settings.logoUrl || '/logo.svg'} alt="Golden Oremar Logo" className="w-full h-full object-contain" />
              </div>
            </button>

            {/* Desktop Center Web Search with absolute 16px layouts & target optimization */}
            <div className="flex-1 max-w-lg relative z-50">
              <div className="relative group/search">
                {/* Sol İç Kenar: Büyüteç İkonu (fixed, left: 16px, color: #A0AEC0) */}
                <div className="absolute inset-y-0 left-[16px] flex items-center pointer-events-none z-10">
                  <Search className="h-5 w-5 text-[#A0AEC0] transition-colors" />
                </div>

                <input
                  id="unified-search-input"
                  type="text"
                  className="block w-full pl-[48px] pr-[48px] py-[14px] bg-gray-100 hover:bg-gray-200/40 dark:bg-[#16191E] dark:hover:bg-[#1d2127] border border-transparent rounded-xl text-sm text-brand-text placeholder-[#A0AEC0] focus:outline-none focus:ring-2 focus:ring-brand-gold/45 focus:bg-white dark:focus:bg-[#16191E] transition-all shadow-inner focus:shadow-md font-medium h-[46px]"
                  placeholder="Şifa arayın: Karakovan Balı, Köy Tereyağı, Organik Işkın..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && searchQuery.trim()) {
                    event.preventDefault();
                    setSearchCategorySlug(null);
                    setSearchProducerId(null);
                    setIsSearchFocused(false);
                    navigateToTab('search-results');
                  }
                }}
                />

                {/* Sağ İç Kenar: Mikrofon veya Temizle (right: 16px) */}
                <div className="absolute inset-y-0 right-[16px] flex items-center z-10">
                  {searchQuery ? (
                    <button 
                      onClick={() => setSearchQuery('')} 
                      className="p-1 text-[#A0AEC0] hover:text-brand-gold transition-colors focus:outline-none" 
                      aria-label="Aramayı Temizle"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  ) : (
                    <button 
                      onClick={triggerVoiceSearch} 
                      className="p-1 text-[#A0AEC0] hover:text-brand-gold transition-all active:scale-90 focus:outline-none" 
                      aria-label="Sesli Arama"
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <button 
                onClick={() => { navigateToTab('account'); setAccountView('notifications'); }} 
                className="relative p-3 text-gray-500 dark:text-gray-450 hover:text-brand-gold hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full transition-all group focus:outline-none"
                aria-label={unreadCount > 0 ? `Bildirimler, ${unreadCount} okunmamış` : 'Bildirimler'}
              >
                <Bell className="w-[1.45rem] h-[1.45rem] group-hover:scale-105 transition-transform" />
                {unreadCount > 0 && (
                  <span aria-hidden="true" className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black flex items-center justify-center rounded-full shadow-md ring-2 ring-white dark:ring-gray-900 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => navigateToTab('cart')} 
                className="relative p-3 text-gray-500 dark:text-gray-450 hover:text-brand-gold hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full transition-all group focus:outline-none"
                aria-label="Sepetim"
              >
                <ShoppingCart className="w-[1.45rem] h-[1.45rem] group-hover:scale-105 transition-transform" />
                {cart.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-brand-gold text-white text-[9px] font-black flex items-center justify-center rounded-full shadow-md ring-2 ring-white dark:ring-gray-900 shadow-sm">
                    {cart.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Compact Filter and Sort Row triggers (Section 4) */}
          {currentTab === 'home' && (
            <div className="flex items-center gap-3 pb-3 pt-0.5 border-t border-gray-100/30 dark:border-gray-850 animate-in fade-in slide-in-from-top-1 duration-300">
              {/* Sol Buton: Filtrele */}
              <button
                onClick={() => setIsFilterPanelOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gray-50 hover:bg-gray-100 dark:bg-[#16191E] dark:hover:bg-[#1c2026] text-xs font-semibold text-brand-text border border-gray-150 dark:border-gray-800 rounded-xl transition-all shadow-sm active:scale-98"
              >
                <SlidersHorizontal className="w-4 h-4 text-brand-gold" />
                <span>{(activeFilter || activeOrigin || priceRange !== 'all') ? 'Filtreli' : 'Filtrele'}</span>
              </button>

              {/* Sağ Buton: Sırala: Önerilen */}
              <button
                onClick={() => setIsSortPanelOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gray-50 hover:bg-gray-100 dark:bg-[#16191E] dark:hover:bg-[#1c2026] text-xs font-semibold text-brand-text border border-gray-150 dark:border-gray-800 rounded-xl transition-all shadow-sm active:scale-98"
              >
                <ArrowDownUp className="w-4 h-4 text-brand-gold" />
                <span>Sırala: {
                  sortOption === 'price-asc' ? 'En Düşük Fiyat' :
                  sortOption === 'price-desc' ? 'En Yüksek Fiyat' :
                  sortOption === 'rating' ? 'En Popüler' : 'Önerilen'
                }</span>
              </button>
            </div>
          )}

                    {/* Server-backed catalog search suggestions */}
          <CatalogSearchOverlay
            query={searchQuery}
            open={isSearchFocused}
            onQueryChange={setSearchQuery}
            onProduct={(slug) => {
              setSelectedProduct(null);
              setSelectedProductReference(slug);
              setIsSearchFocused(false);
              navigateToTab('product-detail');
            }}
            onProducer={(_producerId, producerSlug) => {
              setSelectedProducerReference(producerSlug);
              setIsSearchFocused(false);
              navigateToTab('producer-profile');
            }}
            onCategory={(slug, label) => {
              setSearchCategorySlug(slug);
              setSearchProducerId(null);
              setSearchQuery(label);
              setIsSearchFocused(false);
              navigateToTab('search-results');
            }}
            onAllResults={(value) => {
              setSearchQuery(value);
              setSearchCategorySlug(null);
              setSearchProducerId(null);
              setIsSearchFocused(false);
              navigateToTab('search-results');
            }}
          /></div>
      </header>
      )}

      {/* Main Content */}
      <main>
        {renderContent()}
      </main>

      {/* Bottom Navigation (Mobile) */}
      {currentTab !== 'product-detail' && currentTab !== 'admin' && (
      <div className="md:hidden fixed z-[60] left-4 right-4 flex justify-around items-center h-[68px] rounded-3xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] px-2 transition-all" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <BottomNavButton icon={Home} label="Ana Sayfa" active={currentTab === 'home'} onClick={() => navigateToTab('home')} />
        <BottomNavButton icon={Grid} label="Kategoriler" active={currentTab === 'categories'} onClick={() => navigateToTab('categories')} />
        <BottomNavButton icon={Heart} label="Favoriler" active={currentTab === 'account' && accountView === 'favorites'} onClick={() => { navigateToTab('account'); setAccountView('favorites'); }} />
        <BottomNavButton icon={ShoppingCart} label="Sepetim" active={currentTab === 'cart'} onClick={() => navigateToTab('cart')} badge={cart.length} />
        <BottomNavButton icon={User} label="Hesabım" active={currentTab === 'account' && accountView !== 'favorites'} onClick={() => { navigateToTab('account'); setAccountView('menu'); }} badge={unreadCount} />
      </div>
      )}

      {/* Real Gift Order Flow */}
      {showGiftModal && giftProduct && (
        <GiftOrderFlow
          productReference={giftProduct.slug || String(giftProduct.id)}
          onClose={() => setShowGiftModal(false)}
          onCreated={() => {
            showToast('Hediye siparişiniz oluşturuldu ve ödeme doğrulaması bekliyor.');
            setShowGiftModal(false);
            navigateToTab('account');
            setAccountView('gifts');
          }}
        />
      )}

      {/* Voice Search (Microphone Popup) Bottom Sheet */}
      {isListening && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          {/* Overlay closer */}
          <div className="absolute inset-0" onClick={() => setIsListening(false)} />
          
          <div className="relative w-full max-w-lg bg-[#111418] rounded-t-[24px] border-t border-gray-800 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] p-6 pb-12 flex flex-col items-center gap-6 animate-slide-up select-none z-10 transition-all duration-300">
            {/* Minimal drag handle */}
            <div className="w-12 h-1 bg-gray-700 rounded-full" />
            
            {/* Header action closer */}
            <button 
              onClick={() => setIsListening(false)}
              className="absolute top-5 right-5 p-1 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Scale/pulse ringing silver & gold effect */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              {/* Outer pulsing ring 1 */}
              <div className="absolute inset-0 rounded-full border border-brand-gold/25 animate-ping duration-1500 opacity-75" />
              {/* Outer pulsing ring 2 */}
              <div className="absolute -inset-4 rounded-full border border-gray-400/20 animate-ping duration-2000 opacity-50" />
              
              {/* Glow background */}
              <div className="absolute inset-2 bg-gradient-to-br from-brand-gold/10 to-transparent blur-xl rounded-full" />
              
              {/* Main Microphone Button */}
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-[#16191E] to-[#20252e] flex items-center justify-center border border-brand-gold/40 shadow-[0_0_20px_rgba(212,175,55,0.15)]">
                <Mic className="w-8 h-8 text-brand-gold animate-pulse" />
              </div>
            </div>

            {/* Text description */}
            <div className="text-center space-y-2 w-full px-4">
              <h3 className="text-base font-bold text-white tracking-wide">Sizi dinliyoruz...</h3>
              <p className="text-sm font-semibold text-[#CBD5E0] min-h-[3rem] px-4 py-2 bg-gray-900/40 rounded-xl border border-gray-850/50 break-words leading-relaxed max-h-32 overflow-y-auto font-mono">
                {speechText || "Doğal ürünlerimizin adını fısıldayın..."}
              </p>
              {voiceError && (
                <p className="text-xs text-red-500 font-medium animate-pulse">{voiceError}</p>
              )}
            </div>
            
            {/* Helpful instructions */}
            <div className="text-center text-[11px] text-gray-500 uppercase tracking-widest font-semibold mt-2">
              Örnek: "Karakovan Balı ekle"
            </div>
          </div>
        </div>
      )}

      {/* Advanced Filter Sheet */}
      {isFilterPanelOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0" onClick={() => setIsFilterPanelOpen(false)} />
          
          <div className="relative w-full max-w-lg bg-[#111418] rounded-t-[24px] border-t border-gray-800 p-6 pb-12 flex flex-col gap-6 animate-slide-up z-10 text-white">
            <div className="w-12 h-1 bg-gray-700 mx-auto rounded-full" />
            <button 
              onClick={() => setIsFilterPanelOpen(false)}
              className="absolute top-5 right-5 p-1 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-brand-gold" /> Gelişmiş Filtreleme
              </h3>
              <p className="text-xs text-gray-400">Aradığınız şifayı kolayca konumlandırın.</p>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {/* Category Filter */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Kategori</h4>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => setActiveFilter(null)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${!activeFilter ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:text-white'}`}
                  >
                    Tüm Kategoriler
                  </button>
                  {catalogFilterCategories.map((cat: any) => (
                    <button 
                      key={cat.id}
                      onClick={() => setActiveFilter(cat.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${activeFilter === cat.name ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:text-white'}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Origin / Köken Filter */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Köken / Üretim Yeri</h4>
                <div className="flex flex-wrap gap-2">
                  {['Tümü', ...catalogFilterOrigins].map((origin) => {
                    const originKey = origin === 'Tümü' ? null : origin;
                    return (
                      <button 
                        key={origin}
                        onClick={() => setActiveOrigin(originKey)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${activeOrigin === originKey ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:text-white'}`}
                      >
                        {origin}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Price Range Filter */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Fiyat Aralığı</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Tümü', value: 'all' },
                    { label: '0 ₺ - 250 ₺', value: '0-250' },
                    { label: '250 ₺ - 500 ₺', value: '250-500' },
                    { label: '500 ₺ +', value: '500-plus' }
                  ].map((range) => (
                    <button 
                      key={range.value}
                      onClick={() => setPriceRange(range.value)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${priceRange === range.value ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:text-white'}`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button 
                onClick={() => {
                  setActiveFilter(null);
                  setActiveOrigin(null);
                  setPriceRange('all');
                  setIsFilterPanelOpen(false);
                }}
                className="flex-1 py-3 rounded-xl border border-gray-800 text-xs text-center font-bold text-gray-400 hover:text-white transition-all bg-gray-900/30"
              >
                Sıfırla
              </button>
              <button 
                onClick={() => setIsFilterPanelOpen(false)}
                className="flex-1 py-3 rounded-xl bg-brand-gold hover:bg-brand-gold/90 text-xs text-center font-bold text-black transition-all"
              >
                Uygula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Sorting Sheet */}
      {isSortPanelOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0" onClick={() => setIsSortPanelOpen(false)} />
          
          <div className="relative w-full max-w-lg bg-[#111418] rounded-t-[24px] border-t border-gray-800 p-6 pb-12 flex flex-col gap-6 animate-slide-up z-10 text-white">
            <div className="w-12 h-1 bg-gray-700 mx-auto rounded-full" />
            <button 
              onClick={() => setIsSortPanelOpen(false)}
              className="absolute top-5 right-5 p-1 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowDownUp className="w-4 h-4 text-brand-gold" /> Akıllı Sıralama
              </h3>
              <p className="text-xs text-gray-400">Ürünleri dilediğiniz öncelikte sıralayın.</p>
            </div>

            <div className="flex flex-col gap-2">
              {[
                { label: 'Önerilen Sürüm', value: 'featured' },
                { label: 'En Popüler / En Çok Oy Alanlar', value: 'rating' },
                { label: 'Fiyat: Düşükten Yükseğe', value: 'price-asc' },
                { label: 'Fiyat: Yüksekten Düşüğe', value: 'price-desc' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setSortOption(opt.value);
                    setIsSortPanelOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm font-semibold flex items-center justify-between transition-all ${sortOption === opt.value ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-gray-800/80 bg-gray-900/50 text-gray-400 hover:text-white'}`}
                >
                  <span>{opt.label}</span>
                  {sortOption === opt.value && <div className="w-2 h-2 rounded-full bg-brand-gold shadow-[0_0_8px_rgba(212,175,55,1)]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.visible && (
        <div className="fixed left-1/2 -translate-x-1/2 bg-brand-green text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[100] animate-in fade-in zoom-in duration-300 pointer-events-none" style={{ top: 'calc(4rem + env(safe-area-inset-top))' }}>
          <CheckCircle className="w-5 h-5 text-brand-gold" />
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
        </div>
      )
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}

function BottomNavButton({ icon: Icon, label, active, onClick, badge }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`relative flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 ${active ? 'text-brand-gold scale-110' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
    >
      <div className={`relative flex items-center justify-center transition-transform duration-300 ${active ? '-translate-y-1' : ''}`}>
        <Icon className={`w-6 h-6 transition-all duration-300 ${active ? 'fill-current' : 'stroke-[1.5]'}`} />
        
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm border border-white dark:border-gray-900 pointer-events-none">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
        
        {active && (
          <span className="absolute -bottom-3 w-1 h-1 bg-brand-gold rounded-full shadow-[0_0_8px_rgba(212,175,55,0.8)]" />
        )}
      </div>
      <span className={`text-[9px] font-bold tracking-wide transition-all duration-300 ${active ? 'opacity-100 translate-y-0.5' : 'opacity-70'}`}>{label}</span>
      {active && (
        <div className="absolute inset-0 bg-brand-gold/5 blur-md rounded-full -z-10" />
      )}
    </button>
  );
}

function HomeSection({ searchQuery, setSearchQuery, onProductClick, onAddToCart, onToggleFavorite, favorites, onShare, onGift, setCurrentTab, showToast, ...props }: any) {
  const { staticContent, heroCategories, homeSections, salesReadiness, error: storefrontConfigError } = usePublicStorefrontConfig('tr');
  const storefrontSalesBlocked = salesReadiness?.status === 'blocked_pending_business_identity';
  const { products, categories: liveCategories, loading: liveCatalogLoading, error: liveCatalogError } = useLiveHomeCatalog();
  const interfaceData = staticContent.interface;
  
  // Use passed props or fallback to internal states if not provided (flexible and robust)
  const [localActiveFilter, setLocalActiveFilter] = useState<string | null>(null);
  const [localActiveOrigin, setLocalActiveOrigin] = useState<string | null>(null);
  const [localPriceRange, setLocalPriceRange] = useState<string>('all');
  const [localSortOption, setLocalSortOption] = useState<string>('featured');

  const activeFilter = 'activeFilter' in props ? props.activeFilter : localActiveFilter;
  const setActiveFilter = 'setActiveFilter' in props ? props.setActiveFilter : setLocalActiveFilter;
  const activeOrigin = 'activeOrigin' in props ? props.activeOrigin : localActiveOrigin;
  const setActiveOrigin = 'setActiveOrigin' in props ? props.setActiveOrigin : setLocalActiveOrigin;
  const priceRange = 'priceRange' in props ? props.priceRange : localPriceRange;
  const setPriceRange = 'setPriceRange' in props ? props.setPriceRange : setLocalPriceRange;
  const sortOption = 'sortOption' in props ? props.sortOption : localSortOption;
  const setSortOption = 'setSortOption' in props ? props.setSortOption : setLocalSortOption;

  const filteredProducts = [...products].reverse().filter(p => {
    if (p.is_approved === false) return false;
    const matchesSearch = p.name?.toLowerCase().includes(searchQuery?.toLowerCase()) || 
                          p.category?.toLowerCase().includes(searchQuery?.toLowerCase()) ||
                          p.tags.some((t: string) => t?.toLowerCase().includes(searchQuery?.toLowerCase()));
    
    const matchesFilter = activeFilter ? p.categorySlug === activeFilter : true;

    // Origin / Üretim Yeri Filtreleme
    const matchesOrigin = activeOrigin ? (p.origin && p.origin.toLowerCase().includes(activeOrigin.toLowerCase())) : true;

    // Fiyat Aralığı Filtreleme
    const matchesPrice = priceRange === 'all' ? true :
                         priceRange === '0-250' ? (p.price >= 0 && p.price <= 250) :
                         priceRange === '250-500' ? (p.price > 250 && p.price <= 500) :
                         priceRange === '500-plus' ? (p.price > 500) : true;

    return matchesSearch && matchesFilter && matchesOrigin && matchesPrice;
  }).sort((a, b) => {
    if (sortOption === 'price-asc') return a.price - b.price;
    if (sortOption === 'price-desc') return b.price - a.price;
    if (sortOption === 'rating') return b.rating - a.rating;
    return 0; // featured (default order, which is now reversed from data.ts)
  });

  const handleHeroClick = (targetCategory: string) => {
    setActiveFilter(targetCategory);
    // Scroll to products
    const productsSection = document.getElementById('products');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth' });
    }
    showToast(`Kategori seçildi: ${targetCategory}`);
  };

  const featuredProductNames: string[] = [];
  const naturalProductNames: string[] = [];
  const seasonalProductNames: string[] = [];
  const bestSellerProductNames: string[] = [];
  const newArrivalProductNames: string[] = [];

  const getProductsByNames = (_names: string[], _fallbackCategory: string, homeSectionKey: string) => {
    let matched = homeSectionKey === 'featured'
      ? products.filter((product: any) => product.is_featured || product.homeSection === 'featured')
      : homeSectionKey === 'pre_order'
        ? products.filter((product: any) => product.preOrder)
        : products.filter((product: any) => product.homeSection === homeSectionKey);
    const unique = new Map<string, any>();
    matched.forEach((item: any) => unique.set(String(item.id), item));
    return Array.from(unique.values()).slice(0, 12);
  };

  return (
    <>
      {storefrontConfigError ? <div role="alert" className="mx-auto mt-4 max-w-7xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{storefrontConfigError}</div> : null}
      {storefrontSalesBlocked ? <div role="status" className="mx-auto mt-4 max-w-7xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Ürünleri keşfedebilirsiniz. Canlı satış, işletme ve destek kimliği tamamlanana kadar ödeme tarafında kontrollü tutulur.</div> : null}
      {liveCatalogError ? <div role="alert" className="mx-auto mt-4 max-w-7xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{liveCatalogError}</div> : null}
      {liveCatalogLoading ? <div role="status" aria-live="polite" className="mx-auto mt-4 max-w-7xl rounded-xl border p-3 text-center text-sm text-gray-500">Canlı ürün kataloğu yükleniyor…</div> : null}
      {/* Search Options (Filter) */}
      {searchQuery && (
        <div className="sticky top-16 md:top-20 z-30 px-4 py-3 bg-brand-main/95 backdrop-blur-md shadow-sm border-b border-gray-100 dark:border-gray-800">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Filter className="w-4 h-4" />
              <span className="font-bold">Filtrele:</span>
            </div>
            <select 
              value={sortOption} 
              onChange={(e) => setSortOption(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 border-none rounded-lg px-3 py-1 text-sm font-medium outline-none cursor-pointer text-brand-text"
            >
              <option value="featured">Önerilen</option>
              <option value="price-asc">En Düşük Fiyat</option>
              <option value="price-desc">En Yüksek Fiyat</option>
              <option value="rating">En Çok Değerlendirilen</option>
            </select>
          </div>
        </div>
      )}

      {/* Hero Section (Only if not searching) */}
      {!searchQuery && (
        <section className="px-4 pt-4 pb-8 max-w-7xl mx-auto">
          {!activeFilter ? (
            <>
              {/* Quick Categories (Prestigious UI with Avatars) */}
              <div className="flex gap-4 overflow-x-auto pb-4 pt-2 hide-scrollbar snap-x mb-8" aria-label="Hızlı Kategoriler" role="region">
                {liveCategories.filter((c: any) => ['bal-sifa', 'sut-sarkuteri', 'et-balik', 'meyve-sebze'].includes(c.id)).map((category: any) => {
                  const Icon = { Fish, Droplet, Cherry, Box, Mountain, Gem, Sun }[category.icon as any] || Star;
                  
                  // Find up to 3 products belonging to this category for the avatars
                  const catProducts = products.filter((p: any) => p.categorySlug === category.id).slice(0, 3);

                  return (
                    <button
                      key={category.id}
                      onClick={() => handleHeroClick(category.id)}
                      className="group relative flex-shrink-0 w-64 md:w-72 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-[28px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-100 dark:border-gray-800 hover:border-brand-gold/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgb(0,0,0,0.3)] text-left snap-center overflow-hidden flex flex-col justify-between"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none"></div>
                      <div className="flex justify-between items-start mb-6 relative">
                        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center group-hover:bg-brand-gold/10 group-hover:scale-110 transition-all duration-500">
                           <Icon className="w-6 h-6 text-brand-gold" />
                        </div>
                        {catProducts.length > 0 && (
                          <div className="flex -space-x-2.5">
                             {catProducts.map((p, idx) => (
                               <div key={idx} className="relative z-[1] hover:z-[2]">
                                 <img src={p.image} className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-gray-800 shadow-sm transition-transform duration-300 hover:scale-110" alt="" />
                               </div>
                             ))}
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <h3 className="font-serif font-bold text-gray-900 dark:text-white text-lg leading-tight mb-2 group-hover:text-brand-gold transition-colors">{category.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 md:line-clamp-1">{category.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* New Sections: Products of the Week & Seasonal */}
              <div className="mb-16 space-y-16">
                {homeSections.filter(s => s.active !== false).map((section, idx) => {
                  let activeProductNames: string[] = [];
                  let fallbackCat = '';
                  if (section.id === 'featured') { activeProductNames = featuredProductNames; fallbackCat = 'Bal'; }
                  else if (section.id === 'natural') { activeProductNames = naturalProductNames; fallbackCat = 'Süt'; }
                  else if (section.id === 'seasonal') { activeProductNames = seasonalProductNames; fallbackCat = 'Dağ'; }
                  else if (section.id === 'best_sellers') { activeProductNames = bestSellerProductNames; fallbackCat = 'Süt'; }
                  else if (section.id === 'new_arrivals') { activeProductNames = newArrivalProductNames; fallbackCat = 'Kiler'; }
                  
                  const displayProducts = section.id === 'offers' 
                    ? (products.filter(p => p.homeSection === 'offers' && p.is_approved !== false).length > 0 ? products.filter(p => p.homeSection === 'offers' && p.is_approved !== false) : products.filter(p => p.originalPrice && p.is_approved !== false)).slice(0, 4)
                    : getProductsByNames(activeProductNames, fallbackCat, section.id);

                  if (displayProducts.length === 0 && section.id !== 'pre_order') return null;

                  return (
                    <React.Fragment key={section.id}>
                      {idx === 1 && (
                        <div className="bg-brand-gold/10 dark:bg-brand-gold/5 rounded-3xl p-6 md:p-10 border border-brand-gold/20">
                          <div className="flex flex-col lg:flex-row gap-8 items-center">
                            <div className="flex-1 space-y-4">
                              <div className="text-brand-gold font-bold tracking-widest uppercase text-xs">Günün Fırsatı</div>
                              <h2 className="text-3xl md:text-4xl font-serif text-brand-green dark:text-white">Bugünün Önerisi</h2>
                              <p className="text-gray-600 dark:text-gray-400 text-lg">
                                Golden Oremar'ın en seçkin ürünlerinden biri bugün sizin için özel olarak seçildi. Doğallığı ve lezzetiyle sofranıza değer katacak.
                              </p>
                            </div>
                            <div className="w-full lg:w-1/2 xl:w-1/3">
                              {(() => {
                                const suggestedProduct = products.find(p => p.name.includes("Fahrettin'in Sütten Kesilmiş Oğlağı")) || products[0];
                                return suggestedProduct ? (
                                  <CatalogProductCard 
                                    product={suggestedProduct} 
                                    onClick={() => onProductClick(suggestedProduct)}
                                    onAddToCart={onAddToCart}
                                    onToggleFavorite={() => onToggleFavorite(suggestedProduct)}
                                    isFavorite={favorites.includes(String(suggestedProduct.legacyId || suggestedProduct.id))}
                                    onShare={() => onShare(suggestedProduct)}
                                    onGift={() => onGift(suggestedProduct)}
                                  />
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>
                      )}

                      {section.id === 'seasonal' ? (
                        <div className="bg-green-50 dark:bg-green-900/10 rounded-3xl p-6 md:p-10 border border-green-100 dark:border-green-900/30 relative overflow-hidden">
                          <div className="absolute top-0 right-0 -mt-10 -mr-10 text-green-200/50 dark:text-green-800/20">
                            <Sun className="w-64 h-64" aria-hidden="true" />
                          </div>
                          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                            <div>
                              <div className="text-brand-gold font-bold tracking-widest uppercase text-xs mb-3">Sınırlı Üretim</div>
                              <h2 className="text-3xl md:text-5xl font-serif text-brand-green dark:text-white mb-4">
                                {section.title}
                              </h2>
                              <p className="text-gray-600 dark:text-gray-400 max-w-xl text-lg">
                                Golden Oremar'ın uyanışıyla gelen taze şifalı otlar, ilk sağım sütler ve doğanın en nadide hediyeleri.
                              </p>
                            </div>
                          </div>
                          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {displayProducts.map(product => (
                              <CatalogProductCard 
                                key={product.id} 
                                product={product} 
                                onClick={() => onProductClick(product)}
                                onAddToCart={onAddToCart}
                                onToggleFavorite={() => onToggleFavorite(product)}
                                isFavorite={favorites.includes(String(product.legacyId || product.id))}
                                onShare={() => onShare(product)}
                                onGift={() => onGift(product)}
                              />
                            ))}
                          </div>
                        </div>
                      ) : section.id === 'offers' ? (
                        <div className="bg-red-50 dark:bg-red-900/10 rounded-3xl p-6 md:p-10 border border-red-100 dark:border-red-900/30">
                          <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl md:text-3xl font-serif text-red-600 dark:text-red-400 flex items-center gap-3">
                              <Flame className="w-6 h-6 text-red-500" aria-hidden="true" /> {section.title}
                            </h2>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {displayProducts.map(product => (
                              <CatalogProductCard 
                                key={product.id} 
                                product={product} 
                                onClick={() => onProductClick(product)}
                                onAddToCart={onAddToCart}
                                onToggleFavorite={() => onToggleFavorite(product)}
                                isFavorite={favorites.includes(String(product.legacyId || product.id))}
                                onShare={() => onShare(product)}
                                onGift={() => onGift(product)}
                              />
                            ))}
                          </div>
                        </div>
                      ) : section.id === 'pre_order' ? (
                        <div>
                          <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl md:text-3xl font-serif text-[#c29c29] flex items-center gap-3">
                              <Calendar className="w-6 h-6 text-[#c29c29]" aria-hidden="true" /> {section.title}
                            </h2>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {products.filter(p => p.preOrder).slice(0, 4).map(product => (
                              <CatalogProductCard 
                                key={product.id} 
                                product={product} 
                                onClick={() => onProductClick(product)}
                                onAddToCart={onAddToCart}
                                onToggleFavorite={() => onToggleFavorite(product)}
                                isFavorite={favorites.includes(String(product.legacyId || product.id))}
                                onShare={() => onShare(product)}
                                onGift={() => onGift(product)}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl md:text-3xl font-serif text-brand-green dark:text-brand-gold flex items-center gap-3">
                              <Star className="w-6 h-6 text-brand-gold" aria-hidden="true" /> {section.title}
                            </h2>
                          </div>
                          {idx % 2 === 0 ? (
                            <div className="flex gap-6 overflow-x-auto pb-8 hide-scrollbar snap-x">
                              {displayProducts.map(product => (
                                <div key={product.id} className="min-w-[280px] md:min-w-[320px] snap-center">
                                  <CatalogProductCard 
                                    product={product} 
                                    onClick={() => onProductClick(product)}
                                    onAddToCart={onAddToCart}
                                    onToggleFavorite={() => onToggleFavorite(product)}
                                    isFavorite={favorites.includes(String(product.legacyId || product.id))}
                                    onShare={() => onShare(product)}
                                    onGift={() => onGift(product)}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                              {displayProducts.slice(0,4).map(product => (
                                <CatalogProductCard 
                                  key={product.id} 
                                  product={product} 
                                  onClick={() => onProductClick(product)}
                                  onAddToCart={onAddToCart}
                                  onToggleFavorite={() => onToggleFavorite(product)}
                                  isFavorite={favorites.includes(String(product.legacyId || product.id))}
                                  onShare={() => onShare(product)}
                                  onGift={() => onGift(product)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
                  
                  {/* Tüm Ürünleri Gör Butonu */}
                  <div className="mt-12 text-center">
                    <button 
                      onClick={() => {
                        document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                      }} 
                      className="inline-flex items-center justify-center gap-2 bg-brand-green text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-green-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
                    >
                      Tüm Ürünleri Keşfet <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
            </>
          ) : (
            <div className="mb-8 flex items-center justify-between bg-brand-card p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveFilter(null)} className="p-2 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-800 rounded-full">
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest">Seçilen Kategori</div>
                  <div className="text-xl font-serif font-bold text-brand-green dark:text-brand-gold">
                    {HERO_CATEGORIES.find(c => c.targetCategory === activeFilter)?.title || 'Kategori'}
                  </div>
                </div>
              </div>
              <button onClick={() => setActiveFilter(null)} className="text-sm text-red-500 font-bold hover:underline">
                Filtreyi Temizle
              </button>
            </div>
          )}
        </section>
      )}

      {/* Products Grid */}
      <section id="products" className="px-4 max-w-7xl mx-auto mb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h2 className="text-2xl md:text-3xl font-serif text-brand-green dark:text-brand-gold">
            {searchQuery ? `"${searchQuery}" Sonuçları` : (activeFilter ? 'Seçili Ürünler' : 'Öne Çıkan Koleksiyon')}
          </h2>
          
          {/* Sorting Controls */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">Sırala:</span>
            <select 
              value={sortOption} 
              onChange={(e) => setSortOption(e.target.value)}
              className="bg-brand-card border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-brand-gold cursor-pointer"
            >
              <option value="featured">Önerilen</option>
              <option value="price-asc">En Düşük Fiyat</option>
              <option value="price-desc">En Yüksek Fiyat</option>
              <option value="rating">En Çok Değerlendirilen</option>
            </select>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-lg text-gray-500 dark:text-gray-400 mb-4">Bu kategoride henüz ürün bulunmuyor.</p>
            <button onClick={() => { setSearchQuery(''); setActiveFilter(null); }} className="text-brand-gold font-bold hover:underline">Tüm Ürünleri Göster</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {filteredProducts.map(product => (
              <CatalogProductCard 
                key={product.id} 
                product={product} 
                onClick={() => onProductClick(product)}
                onAddToCart={onAddToCart}
                onToggleFavorite={() => onToggleFavorite(product)}
                isFavorite={favorites.includes(String(product.legacyId || product.id))}
                onShare={() => onShare(product)}
                onGift={() => onGift(product)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

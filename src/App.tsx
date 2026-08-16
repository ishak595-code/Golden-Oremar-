import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App as CapApp } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { 
  X, Search, ShoppingCart, Heart, User, 
  ChevronRight, ChevronDown, ChevronLeft, Star, Share2, Gift, 
  MapPin, CreditCard, Bell, Settings, LogOut, 
  Plus, Trash2, ThumbsUp, Check, ArrowRight, ShieldCheck, 
  Zap, Truck, Leaf, Sun, Droplet, Gem, Flame, 
  MessageCircle, Mail, Phone, Globe, Home, Grid,
  Filter, Fish, Cherry, Wheat, CheckCircle, Store,
  Mic, SlidersHorizontal, ArrowDownUp,
  Box, Mountain, Utensils, Snowflake, Calendar, 
  Activity, FileText, HelpCircle, Shield, Minus, Package, Clock, CheckCircle2, Info, Lock, Users, Sparkles, Eye, EyeOff, Facebook, Apple, Instagram, Twitter, RefreshCw, BookOpen, Coffee, Send, MoreVertical, MessageSquare, AlertTriangle
} from 'lucide-react';
import { CATEGORIES, PRODUCTS, REVIEWS, HERO_CATEGORIES, EVENTS, HEALTH_GUIDES, CONTACT_INFO } from './data';
import { DataProvider, useData } from './context/DataContext';
import { AdminPage } from './pages/AdminPage';
import { db } from './firebase';
import VendorOnboarding from './pages/VendorOnboarding';
import AccountCenter from './features/account/AccountCenter';
import ProducerApplicationFlow from './features/producer-onboarding/ProducerApplicationFlow';
import { usePublicStorefrontConfig } from './features/storefront/usePublicStorefrontConfig';
import PublicInfoScreen from './features/storefront/PublicInfoScreen';
import PublicHealthScreen from './features/content/PublicHealthScreen';
import PublicEventsScreen from './features/engagement/PublicEventsScreen';
import PublicContactScreen from './features/engagement/PublicContactScreen';
import { useCatalogFilterOptions } from './features/catalog/useCatalogFilterOptions';
import { useLiveHomeCatalog } from './features/catalog/useLiveHomeCatalog';
import { listFavoriteReferences as serverFavoriteReferences, searchCatalog as serverCatalogSearch, toggleProductFavorite as serverToggleProductFavorite } from './features/catalog/api';
import CategoryDirectoryScreen from './features/catalog/CategoryDirectoryScreen';
import PublicProducerScreen from './features/catalog/PublicProducerScreen';
import ProductDetailScreen from './features/catalog/ProductDetailScreen';
import CatalogSearchResults from './features/catalog/CatalogSearchResults';
import CatalogSearchOverlay from './features/catalog/CatalogSearchOverlay';
import AuthScreen from './features/auth/AuthScreen';
import { getCart as getServerCart, publicCatalogUrl as serverCatalogUrl, removeCartItem as removeServerCartItem, resolveDefaultVariant, setCartItem as setServerCartItem } from './features/cart/api';
import CartCheckoutFlow from './features/cart/CartCheckoutFlow';
import GiftOrderFlow from './features/gifts/GiftOrderFlow';
import { doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp, deleteDoc, getDocs, query, where } from 'firebase/firestore';

// --- Types ---
type Tab = 'home' | 'categories' | 'favorites' | 'cart' | 'account' | 'product-detail' | 'search-results' | 'producer-profile' | 'events' | 'health' | 'contact' | 'about' | 'admin' | 'vendor-store';
type AccountTab = 'profile' | 'addresses' | 'payments' | 'notifications' | 'settings' | 'feedback';

// --- Main App Component ---
function AppContent() {
  const { settings, updateSettings, notifications, markNotificationAsRead, addNotification, currentUser, setCurrentUser, products, recipes, productHealthInfo, blogPosts, staticContent, contactInfo, events, seedDatabase, heroCategories, homeSections } = useData();
  const [currentTab, setCurrentTab] = useState<Tab>('home');
  const [tabHistory, setTabHistory] = useState<Tab[]>(['home']);

  // URL Routing & SEO Sync (Added by System Architect)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tabFromUrl = params.get('tab');
      if (tabFromUrl && tabFromUrl !== currentTab) {
         setCurrentTab(tabFromUrl);
      }
    };
    window.addEventListener('popstate', handlePopState);
    
    // Initial check
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab');
    if (tabFromUrl && tabFromUrl !== currentTab) {
       setCurrentTab(tabFromUrl);
    }
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') !== currentTab) {
      params.set('tab', currentTab);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
      
      // Dinamik SEO / Başlık Yönetimi
      const tabTitles: Record<string, string> = {
        'home': 'Golden Oremar',
        'categories': 'Kategoriler | Golden Oremar',
        'cart': 'Sepetim | Golden Oremar',
        'profile': 'Hesabım | Golden Oremar',
        'admin': 'Yönetim | Golden Oremar',
        'vendor-store': 'Mağaza | Golden Oremar',
      };
            document.title = tabTitles[currentTab] || 'Golden Oremar | VIP Organik Ekosistem';
      
      // Dinamik Meta Tag'leri
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      
      const tabDescriptions: Record<string, string> = {
        'home': 'Golden Oremar ile doğrulanmış köy ürünleri, şifalı bitkiler ve seçkin doğa hasatları.',
        'categories': 'Oremar bölgesinden gelen özel bal, köy ürünleri ve doğal ürün kategorileri.',
        'cart': 'Özel siparişlerinizi ve Concierge teslimatlarınızı yönetin.',
        'profile': 'VIP müşteri profilinizi, geçmiş siparişlerinizi ve kişisel verilerinizi güvenle yönetin.',
      };
      
      metaDesc.setAttribute('content', tabDescriptions[currentTab] || 'Doğadan gelen en özel ürünler sadece sizin için özenle toplanır.');
      
      let metaOgTitle = document.querySelector('meta[property="og:title"]');
      if (!metaOgTitle) {
        metaOgTitle = document.createElement('meta');
        metaOgTitle.setAttribute('property', 'og:title');
        document.head.appendChild(metaOgTitle);
      }
      metaOgTitle.setAttribute('content', tabTitles[currentTab] || 'Golden Oremar');
    }
  }, [currentTab]);

  const [accountView, setAccountView] = useState<string>('menu');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  useEffect(() => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') {
      setIsAdminLoggedIn(true);
    } else {
      setIsAdminLoggedIn(false);
    }
  }, [currentUser]);

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
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
  const [showNotifications, setShowNotifications] = useState(false);
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
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack || tabHistory.length <= 1) {
          CapApp.exitApp();
        } else {
          goBack();
        }
      });

      Network.addListener('networkStatusChange', status => {
        if (!status.connected) {
          showToast('İnternet bağlantısı kesildi.');
        }
      });
    }

    return () => {
      if (Capacitor.isNativePlatform()) {
        CapApp.removeAllListeners();
        Network.removeAllListeners();
      }
    };
  }, [tabHistory, currentTab, accountView]);

  const unreadCount = notifications.filter(n => !n.read).length;

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
          onLoginRequired={() => { showToast('Üreticiyi takip etmek için hesabınıza giriş yapın.'); navigateToTab('account'); }}
          onOpenProduct={(slug) => {
            setSelectedProduct(null);
            setSelectedProductReference(slug);
            navigateToTab('product-detail');
          }}
          onAddToCart={async (product) => {
            await addToCart(product, 1);
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
          onOpenNotificationAction={(url) => {
            if (url?.includes('/messages/')) setAccountView('support');
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

    if (currentTab === 'vendor-store' && selectedVendor) {
      const producerReference = selectedVendor?.slug || String(selectedVendor?.id || '');
      if (!producerReference) {
        return <div role="alert" className="mx-auto max-w-5xl p-6">Üretici referansı bulunamadı.</div>;
      }
      return (
        <PublicProducerScreen
          reference={producerReference}
          authenticated={!!currentUser}
          onBack={goBack}
          onLoginRequired={() => { showToast('Bu işlem için hesabınıza giriş yapın.'); navigateToTab('account'); }}
          onOpenProduct={(slug) => {
            setSelectedProduct(null);
            setSelectedProductReference(slug);
            navigateToTab('product-detail');
          }}
          onAddToCart={async (item) => {
            await addToCart({ id: item.id, slug: item.slug, name: item.name, variantId: item.variantId }, 1);
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
      currentTab === 'admin' ? (
        <AdminPage 
          onBack={goBack}
          onLogout={async () => { 
            await fetch('/api/auth/logout', { method: 'POST' });
            setCurrentUser(null);
            setIsAdminLoggedIn(false); 
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
                aria-label="Bildirimler"
              >
                <Bell className="w-[1.3rem] h-[1.3rem] group-hover:scale-105 transition-transform" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full shadow-md ring-1.5 ring-white dark:ring-gray-950 animate-pulse">
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
                aria-label="Bildirimler"
              >
                <Bell className="w-[1.45rem] h-[1.45rem] group-hover:scale-105 transition-transform" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black flex items-center justify-center rounded-full shadow-md ring-2 ring-white dark:ring-gray-900 animate-pulse">
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


function NavButton({ label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`text-sm font-bold tracking-wide transition-colors relative py-2 ${active ? 'text-brand-gold' : 'text-brand-text hover:text-brand-gold'}`}
    >
      {label}
      {active && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-gold rounded-full"></span>}
    </button>
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
                                  <ProductCard 
                                    product={suggestedProduct} 
                                    onClick={() => onProductClick(suggestedProduct)}
                                    onAddToCart={() => onAddToCart(suggestedProduct)}
                                    onToggleFavorite={() => onToggleFavorite(suggestedProduct)}
                                    isFavorite={favorites.includes(suggestedProduct.id)}
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
                              <ProductCard 
                                key={product.id} 
                                product={product} 
                                onClick={() => onProductClick(product)}
                                onAddToCart={() => onAddToCart(product)}
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
                              <ProductCard 
                                key={product.id} 
                                product={product} 
                                onClick={() => onProductClick(product)}
                                onAddToCart={() => onAddToCart(product)}
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
                              <ProductCard 
                                key={product.id} 
                                product={product} 
                                onClick={() => onProductClick(product)}
                                onAddToCart={() => onAddToCart(product)}
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
                                  <ProductCard 
                                    product={product} 
                                    onClick={() => onProductClick(product)}
                                    onAddToCart={() => onAddToCart(product)}
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
                                <ProductCard 
                                  key={product.id} 
                                  product={product} 
                                  onClick={() => onProductClick(product)}
                                  onAddToCart={() => onAddToCart(product)}
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
              <ProductCard 
                key={product.id} 
                product={product} 
                onClick={() => onProductClick(product)}
                onAddToCart={() => onAddToCart(product)}
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

function ProductCard({ product, onClick, onAddToCart, onToggleFavorite, isFavorite, onShare, onGift, onLike, isLiked }: any) {
  const [quantity, setQuantity] = useState(1);
  const hoverImage = product.gallery ? product.gallery[1] : product.image.replace('/seed/', '/seed/gallery1-');

  // Determine badges
  const badges = [];
  if (product.rating > 4.8) badges.push({ text: "En Çok Satan", color: "bg-brand-green text-white" });
  if (product.tags.includes("Yeni")) badges.push({ text: "Yeni Hasat", color: "bg-brand-gold text-white" });
  if (product.stock < 20) badges.push({ text: "Sınırlı Üretim", color: "bg-red-500 text-white" });
  if (badges.length === 0) badges.push({ text: "Doğal Üretim", color: "bg-brand-earth text-white" });

  return (
    <div 
      className="group bg-brand-card rounded-3xl overflow-hidden border border-brand-gold/10 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-brand-gold/30 transition-all duration-300 relative flex flex-col h-full cursor-pointer active:scale-[0.98]"
      onClick={onClick}
      role="link"
      tabIndex={0}
    >
      {/* Image Area */}
      <div className="relative aspect-[4/5] overflow-hidden bg-brand-main p-3">
        <div className="w-full h-full rounded-2xl overflow-hidden relative border border-brand-gold/5">
          <img 
            src={product.image} 
            alt={product.name} 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />
          <img 
            src={hoverImage} 
            alt={`${product.name} alternate`} 
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 opacity-0 group-hover:opacity-100 group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300"></div>
          
          {/* Overlay Link Indicator */}
          <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="bg-brand-main text-brand-gold border border-brand-gold/30 px-6 py-3 rounded-full font-bold tracking-widest uppercase text-xs shadow-xl flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
              <span>Ürünü İncele</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
        
        {/* Badges */}
        <div className="absolute top-5 right-5 flex flex-col gap-2 z-20 items-end">
          {badges.slice(0, 2).map((badge, idx) => (
            <span key={idx} className={`${badge.color} text-[10px] font-bold px-3 py-1 rounded-full shadow-md tracking-wide uppercase`}>
              {badge.text}
            </span>
          ))}
        </div>

        {/* Favorite Button */}
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className={`absolute top-5 left-5 w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center shadow-sm transition-all z-30 ${isFavorite ? 'bg-brand-gold text-brand-main' : 'bg-brand-main/80 text-brand-muted hover:bg-brand-main hover:text-brand-gold'}`}
          title="Favorilere Ekle"
          aria-label={isFavorite ? "Favorilerden Çıkar" : "Favorilere Ekle"}
        >
          <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Content Area */}
      <div className="p-5 flex flex-col flex-grow relative z-30">
        <div className="text-[10px] font-bold tracking-widest text-brand-gold uppercase mb-2">{product.category}</div>
        <h3 className="text-lg font-serif font-bold text-brand-text mb-2 line-clamp-2 leading-snug">{product.name}</h3>
        
        <div className="flex items-center gap-1 mb-4" aria-label={`${product.rating} yıldız, ${product.reviews} değerlendirme`}>
          <div className="flex" aria-hidden="true">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`w-3.5 h-3.5 ${i < Math.floor(product.rating ?? 5) ? 'fill-brand-gold text-brand-gold' : 'text-brand-border'}`} />
            ))}
          </div>
          <span className="text-xs text-brand-muted ml-2 font-medium">({product.reviews !== undefined ? product.reviews : 0})</span>
        </div>

        <div className="flex flex-col mt-auto border-t border-brand-gold/10 pt-4 mb-5">
          {product.pricePrefix && (
            <span className="text-[10px] uppercase font-bold tracking-widest text-brand-gold/70 mb-1 block">
              {product.pricePrefix}
            </span>
          )}
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold font-serif text-brand-gold">{Number(product.price) || 0} ₺</span>
            {product.unit && <span className="text-xs text-brand-muted font-medium">/ {product.unit}</span>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-auto">
          <button 
            onClick={(e) => { e.stopPropagation(); onAddToCart(quantity); }}
            className={`flex-1 ${product.preOrder ? 'bg-[#134e2c] border border-brand-green/30' : 'bg-brand-gold'} ${product.preOrder ? 'text-white hover:bg-brand-green' : 'text-brand-main hover:bg-brand-green hover:text-white'} py-3 rounded-xl font-bold text-[11px] tracking-widest uppercase transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2`}
            aria-label={product.preOrder ? "Hemen Ön Sipariş Ver" : "Sepete Ekle"}
          >
            {product.preOrder ? <Calendar className="w-4 h-4" /> : <ShoppingCart className="w-5 h-5" />}
            {product.preOrder ? 'Hemen Ön Sipariş Ver' : 'Sepete Ekle'}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onGift(); }}
            className="w-12 h-[44px] flex-shrink-0 bg-brand-main/50 border border-brand-gold/30 text-brand-gold rounded-xl flex items-center justify-center hover:bg-brand-gold hover:text-brand-main transition-all active:scale-95 shadow-sm"
            aria-label="Hediye Et"
            title="Hediye Et"
          >
            <Gift className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductDetail({ product, onBack, onAddToCart, onToggleFavorite, isFavorite, onShare, onGift, onProductClick, favorites, onSelectVendor, onLike, isLiked, setCurrentTab }: any) {
  const { products, recipes, productHealthInfo } = useData();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [selectedImage, setSelectedImage] = useState(product.image);
  const [quantity, setQuantity] = useState(1);
  const [vendor, setVendor] = useState<any>(null);
  const [localSelectedRecipe, setLocalSelectedRecipe] = useState<any>(null);
  const [selectedWeightIdx, setSelectedWeightIdx] = useState(0);
  const [selectedCutIdx, setSelectedCutIdx] = useState(0);

  // Calculate dynamic price based on options
  const hasWeightOptions = product.weightOptions && product.weightOptions.length > 0;
  const hasCutOptions = product.cutOptions && product.cutOptions.length > 0;
  const basePrice = hasWeightOptions ? product.weightOptions[selectedWeightIdx].price : product.price;
  const cutPrice = hasCutOptions ? product.cutOptions[selectedCutIdx].price : 0;
  const finalPrice = basePrice + cutPrice;
  const originalPrice = hasWeightOptions ? product.weightOptions[selectedWeightIdx].originalPrice : product.originalPrice;

  useEffect(() => {
    let isMounted = true;
    const fetchVendor = async () => {
      const vId = product.vendorId || product.vendor_id;
      if (!vId || vId === 'admin') {
         if (isMounted) setVendor({ id: 'admin', storeName: 'Golden Oremar Resmi', fullName: 'Golden Oremar Yetkili Satıcı', is_verified: true, role: 'admin', rating: 5.0, address: 'Hakkari Yüksekova Oremar Yaylası', createdAt: '2023-01-01T00:00:00Z' });
      } else {
         try {
           const vDoc = await getDoc(doc(db, 'vendors', vId));
           if (vDoc.exists() && isMounted) {
             setVendor({ id: vDoc.id, ...vDoc.data(), rating: vDoc.data().rating || 4.8 });
           } else if (isMounted) {
             setVendor({ id: 'admin', storeName: 'Golden Oremar Resmi', fullName: 'Golden Oremar Yetkili Satıcı', is_verified: true, role: 'admin', rating: 5.0, address: 'Hakkari Yüksekova Oremar Yaylası' });
           }
         } catch (e) {
           console.error("Vendor fetch err:", e);
         }
      }
    };
    fetchVendor();
    return () => { isMounted = false; };
  }, [product]);

  useEffect(() => {
    setSelectedImage(product.image);
    setQuantity(1);
  }, [product]);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const relatedProducts = products.filter(p => p.is_approved !== false && p.category === product.category && p.id !== product.id);
  const productReviews = REVIEWS.filter(r => r.productId === product.id);
  const displayedReviews = showAllReviews ? productReviews : productReviews.slice(0, 3);

  const gallery = product.gallery || [
    product.image,
    product.image.replace('/seed/', '/seed/gallery1-'),
    product.image.replace('/seed/', '/seed/gallery2-'),
    product.image.replace('/seed/', '/seed/gallery3-')
  ];

  const handleLocalAddToCart = () => {
    // If user selected special options, we construct a custom cart item
    let customName = product.name;
    if (hasWeightOptions && selectedWeightIdx > 0) {
      customName += ` - ${product.weightOptions[selectedWeightIdx].label}`;
    }
    if (hasCutOptions && selectedCutIdx > 0) {
      customName += ` (${product.cutOptions[selectedCutIdx].label})`;
    }

    const customProduct = {
      ...product,
      // Need a slightly unique ID so it doesn't merge with a different variation of same product
      id: `${product.id}-${selectedWeightIdx}-${selectedCutIdx}`,
      name: customName,
      price: finalPrice,
      originalPrice: originalPrice
    };

    onAddToCart(customProduct, quantity);
  };

  return (
    <div className="min-h-screen bg-brand-main text-brand-text animate-in fade-in slide-in-from-bottom-4 pb-48">
      {/* Premium Sticky Header */}
      <div className="sticky top-0 z-50 bg-brand-main/80 backdrop-blur-xl border-b border-brand-gold/10 transition-all shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-brand-muted hover:text-brand-gold transition-colors font-medium group" aria-label="Ana Sayfaya Dön">
            <div className="w-10 h-10 rounded-full bg-brand-card flex items-center justify-center group-hover:bg-brand-gold/20 transition-colors border border-transparent group-hover:border-brand-gold/50">
              <ChevronLeft className="w-6 h-6 text-brand-gold" />
            </div>
            <span className="hidden sm:block text-brand-gold font-bold tracking-wide">Geri Dön</span>
          </button>
          <div className="font-serif font-bold text-lg text-brand-text truncate max-w-[200px] sm:max-w-md text-center">
            {product.name}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onShare} className="w-10 h-10 rounded-full bg-brand-card flex items-center justify-center text-brand-muted hover:bg-brand-gold/20 hover:text-brand-gold transition-colors border border-transparent hover:border-brand-gold/50" aria-label="Paylaş">
              <Share2 className="w-5 h-5 text-brand-gold" />
            </button>
            <button onClick={onToggleFavorite} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors border ${isFavorite ? 'bg-brand-gold/20 border-brand-gold text-brand-gold' : 'bg-brand-card border-transparent text-gray-400 hover:bg-brand-gold/10 hover:border-brand-gold/50 hover:text-brand-gold'}`} aria-label="Favori">
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-16">
          {/* Image Gallery */}
        <div className="space-y-4">
          <div className="aspect-square md:aspect-[4/5] w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-brand-card shadow-xl relative group border border-brand-gold/10">
            <img src={selectedImage} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
          </div>
          
          {/* Thumbnails */}
          <div className="flex gap-3 sm:grid sm:grid-cols-4 sm:gap-4 overflow-x-auto pb-2 hide-scrollbar snap-x">
            {gallery.map((img: string, idx: number) => (
              <button 
                key={idx}
                onClick={() => setSelectedImage(img)}
                className={`flex-shrink-0 w-20 h-20 sm:w-auto sm:h-auto sm:aspect-square rounded-xl overflow-hidden border-2 transition-all snap-center ${selectedImage === img ? 'border-brand-gold shadow-md scale-105 opacity-100' : 'border-transparent hover:border-brand-gold/50 opacity-60 hover:opacity-100'}`}
                aria-label={`${product.name} görseli ${idx + 1}`}
              >
                <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="bg-brand-gold/10 text-brand-gold border border-brand-gold/20 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase">
              {product.category}
            </span>
            {product.stock < 20 && (
              <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase flex items-center gap-1">
                <Zap className="w-3 h-3" /> Sınırlı Stok
              </span>
            )}
            {product.origin && (
              <span className="bg-brand-card border border-brand-border text-brand-text px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase flex items-center gap-1">
                <Mountain className="w-3 h-3 text-brand-gold" /> {product.origin}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-5xl font-serif text-brand-text mb-4 leading-tight font-medium tracking-wide">{product.name}</h1>
          
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-5 h-5 ${i < Math.floor(product.rating ?? 5) ? 'fill-brand-gold text-brand-gold' : 'text-gray-600'}`} />
              ))}
            </div>
            <span 
              onClick={() => {
                setOpenSection('reviews');
                // Scroll to reviews section
                setTimeout(() => {
                  const el = document.getElementById('reviews-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="text-brand-muted font-medium hover:text-brand-gold cursor-pointer transition-colors underline decoration-brand-gold/30 underline-offset-4"
            >
              {product.reviews !== undefined ? product.reviews : 0} Değerlendirme
            </span>
          </div>

          <div className="flex flex-col gap-1 mb-8 bg-brand-card p-5 rounded-2xl border border-brand-gold/10 w-fit">
            {product.pricePrefix && (
               <span className="text-xs uppercase font-bold tracking-widest text-brand-gold/70">
                 {product.pricePrefix}
               </span>
            )}
            <div className="flex items-end gap-3">
              <div className="text-4xl font-serif font-bold text-brand-gold">{finalPrice * quantity} ₺</div>
              {originalPrice && (
                <div className="text-xl text-brand-muted line-through mb-1">{originalPrice * quantity} ₺</div>
              )}
              {product.unit && quantity === 1 && (
                <div className="text-sm text-brand-muted mb-1.5 ml-1">/ {product.unit}</div>
              )}
            </div>
            {quantity > 1 && (
              <div className="text-xs text-brand-muted mt-1 uppercase tracking-wider">
                Birim Fiyat: {finalPrice} ₺ {product.unit && `/ ${product.unit}`}
              </div>
            )}
          </div>

          {/* Dynamic Options */}
          {product.preOrder && (
            <div className="mb-6 p-4 bg-brand-main/5 border border-brand-gold/30 rounded-xl">
              <div className="flex items-center gap-3 mb-2 text-brand-gold">
                <Calendar className="w-5 h-5" />
                <span className="font-bold text-sm tracking-widest uppercase">Hazırlık Süresi</span>
              </div>
              <p className="text-brand-text font-serif italic text-sm">{product.preOrderTime}</p>
            </div>
          )}

          {hasWeightOptions && (
            <div className="mb-6">
              <span className="font-bold text-brand-text block mb-3 text-sm tracking-widest uppercase">Miktar Seçimi</span>
              <div className="flex flex-wrap gap-2">
                {product.weightOptions.map((opt: any, idx: number) => (
                  <button 
                    key={idx}
                    onClick={() => setSelectedWeightIdx(idx)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${selectedWeightIdx === idx ? 'bg-brand-gold text-brand-main border-brand-gold' : 'border-brand-gold/40 text-brand-text hover:bg-brand-gold/10'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasCutOptions && (
            <div className="mb-6">
              <span className="font-bold text-brand-text block mb-3 text-sm tracking-widest uppercase">Kesim Seçeneği</span>
              <div className="flex flex-col gap-2">
                {product.cutOptions.map((opt: any, idx: number) => (
                  <button 
                    key={idx}
                    onClick={() => setSelectedCutIdx(idx)}
                    className={`px-4 py-3 rounded-xl text-sm font-medium border flex justify-between items-center transition-colors text-left ${selectedCutIdx === idx ? 'border-brand-gold bg-brand-gold/5 shadow-[0_0_15px_rgba(212,175,55,0.15)] ring-1 ring-brand-gold' : 'border-brand-gold/20 text-brand-text bg-brand-card hover:border-brand-gold/50'}`}
                  >
                    <span>{opt.label}</span>
                    <span className="text-brand-gold font-bold">{opt.price > 0 ? `+${opt.price} ₺` : 'Ücretsiz'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 mb-8">
            <span className="font-bold text-brand-text">Miktar</span>
            <div className="flex items-center justify-between bg-brand-card rounded-xl p-1 border border-brand-gold/20 w-32 shadow-sm">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-transparent text-brand-muted hover:text-brand-gold hover:bg-brand-main transition-colors"
                aria-label="Miktarı azalt"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-bold text-lg text-brand-text font-serif w-8 text-center" aria-live="polite">{quantity}</span>
              <button 
                onClick={() => setQuantity(Math.min(product.stock || 99, quantity + 1))}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-transparent text-brand-muted hover:text-brand-gold hover:bg-brand-main transition-colors"
                aria-label="Miktarı artır"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!product.preOrder && (
            <div className="flex items-center gap-4 text-sm text-brand-text mb-8 p-5 bg-brand-card rounded-2xl border border-brand-gold/10">
              <div className="w-10 h-10 rounded-full bg-brand-gold/10 flex items-center justify-center shrink-0 border border-brand-gold/20">
                <Truck className="w-5 h-5 text-brand-gold" />
              </div>
              <div>
                <div className="font-bold text-brand-gold mb-0.5">Hızlı Teslimat</div>
                <span>Şimdi sipariş ver, <span className="font-bold">yarın sabah</span> yayladan yola çıksın.</span>
              </div>
            </div>
          )}

          {product.preOrder && (
            <div className="flex items-center gap-4 text-sm text-brand-text mb-8 p-5 bg-[#134e2c]/30 rounded-2xl border border-[#134e2c]/50 relative overflow-hidden group">
              <div className="w-10 h-10 rounded-full bg-[#134e2c]/80 flex flex-shrink-0 items-center justify-center border border-[#134e2c]">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-[#2e9e5b] mb-0.5">Kişiye Özel Hizmet (Concierge)</div>
                <span className="text-brand-muted">{product.preOrderTime || "Siparişinizin alınmasıyla birlikte süreç başlatılır."} İşleminizin tüm aşamalarında uzman ekiplerimiz sizinle birebir iletişime geçecektir.</span>
              </div>
            </div>
          )}

          {/* Vendor Section */}
          {vendor && (
            <div className="mb-8 p-5 sm:p-6 bg-brand-card rounded-2xl border border-brand-gold/20 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 rounded-bl-[100px] -z-10 group-hover:scale-110 transition-transform duration-500"></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-brand-main border border-brand-gold/20 rounded-2xl flex items-center justify-center shadow-inner overflow-hidden shrink-0">
                    <Store className="w-6 h-6 text-brand-gold" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-brand-text flex items-center gap-2">
                      {vendor.storeName || vendor.fullName}
                      {vendor.is_verified && <ShieldCheck className="w-4 h-4 text-brand-gold" title="Onaylı Satıcı" />}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-brand-muted mt-1">
                      <Star className="w-4 h-4 fill-brand-gold text-brand-gold" />
                      <span className="font-medium text-brand-text">{Number(vendor.rating || 4.8).toFixed(1)}</span>
                      <span>·</span>
                      <MapPin className="w-3 h-3 text-brand-gold" />
                      <span className="truncate max-w-[120px] sm:max-w-[200px]">{vendor.address || 'Hakkari / Yüksekova'}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    onSelectVendor(vendor);
                  }}
                  className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-transparent border border-brand-gold/50 text-brand-gold hover:bg-brand-gold hover:text-brand-main transition-colors flex items-center gap-2 text-sm font-bold shrink-0"
                >
                  <span>Mağazaya Git</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Detailed Info Tabs / Accordions */}
          <div className="space-y-4">
            <AccordionItem title="Ürün Açıklaması" isOpen={openSection === 'description'} onClick={() => toggleSection('description')}>
              <div className="prose prose-sm max-w-none">
                <p className="text-brand-text/80 leading-relaxed text-base mb-2 font-serif italic border-l-4 border-brand-gold pl-4 py-1">
                  "{product.description}"
                </p>
              </div>
            </AccordionItem>

            <AccordionItem title="Hikayesi ve Yapım Süreci" isOpen={openSection === 'story'} onClick={() => toggleSection('story')}>
              <div className="flex flex-col gap-6">
                
                {product.story && (
                  <div className="relative p-6 bg-brand-main rounded-2xl border border-brand-gold/10 overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-brand-gold/5 rounded-bl-[100px] -z-10 group-hover:scale-110 transition-transform"></div>
                    <BookOpen pr-4 className="w-8 h-8 text-brand-gold/40 absolute top-4 right-4" />
                    <p className="text-brand-text/90 leading-relaxed text-base prose prose-sm dark:prose-invert italic border-l-2 border-brand-gold/50 pl-4">
                      {product.story}
                    </p>
                  </div>
                )}
                
                {product.features && product.features.length > 0 && (
                  <div>
                    <h4 className="font-bold text-brand-gold mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                       <ShieldCheck className="w-4 h-4" /> Öne Çıkan Özellikler
                    </h4>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {product.features?.map((f: string, i: number) => (
                        <li key={i} className="flex items-start gap-3 bg-brand-main p-4 rounded-xl border border-brand-gold/10 shadow-sm hover:border-brand-gold/30 transition-colors">
                          <CheckCircle className="w-5 h-5 text-brand-gold shrink-0 mt-0.5" /> 
                          <span className="text-sm font-medium text-brand-text leading-snug">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(product.producer || product.harvestMethod) && (
                  <div className="bg-brand-gold/5 p-6 rounded-2xl border border-brand-gold/20 flex flex-col sm:flex-row gap-6 mt-2">
                    {product.producer && (
                      <div className="flex-1">
                        <h4 className="font-bold text-brand-gold mb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                          <Users className="w-4 h-4" /> Üretici Bilgisi
                        </h4>
                        <p className="text-sm text-brand-text/90 font-medium leading-relaxed">{product.producer}</p>
                      </div>
                    )}
                    {product.harvestMethod && (
                      <div className="flex-1">
                        <h4 className="font-bold text-brand-gold mb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                          <Leaf className="w-4 h-4" /> Hasat / Yapım Metodu
                        </h4>
                        <p className="text-sm text-brand-text/90 font-medium leading-relaxed">{product.harvestMethod}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AccordionItem>
            {/* Health Info Section */}
            <AccordionItem title="Sağlık ve Faydalar" isOpen={openSection === 'health'} onClick={() => toggleSection('health')}>
              {(() => {
                const info = productHealthInfo?.find((i: any) => Number(i.productId) === Number(product.id) || i.title?.toLowerCase().includes(product.name?.toLowerCase()));
                return (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 bg-brand-gold/10 p-4 rounded-xl border border-brand-gold/20">
                      <Activity className="w-6 h-6 text-brand-gold shrink-0" />
                      <h4 className="font-bold text-brand-gold text-sm tracking-wide">Tıbbi Veriler Onaylı</h4>
                    </div>
                    <div>
                      <h5 className="font-bold text-brand-gold text-base mb-2">{info ? info.title : `${product.name} - Sağlığa Faydaları`}</h5>
                      <p className="text-brand-text/80 leading-relaxed text-sm">
                        {info ? info.content : `Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.`}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </AccordionItem>

            


            <AccordionItem title={`Müşteri Değerlendirmeleri (${product.reviews !== undefined ? product.reviews : 0})`} isOpen={openSection === 'reviews'} onClick={() => toggleSection('reviews')}>
              <div id="reviews-section" className="mb-6 flex items-center justify-between bg-brand-card p-6 rounded-2xl border border-brand-gold/10">
                <div className="flex flex-col items-center gap-1">
                  <div className="text-5xl font-serif font-bold text-brand-gold">{Number(product.rating ?? 5)?.toFixed(1)}</div>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.rating ?? 5) ? 'fill-brand-gold text-brand-gold' : 'text-brand-border'}`} />
                    ))}
                  </div>
                  <div className="text-xs text-brand-muted mt-1">{product.reviews !== undefined ? product.reviews : 0} Değerlendirme</div>
                </div>
                <div className="w-px h-16 bg-brand-border mx-4"></div>
                <div className="flex-1 flex flex-col items-center">
                  <div className="text-3xl font-serif font-bold text-brand-gold">%98</div>
                  <div className="text-sm text-brand-muted text-center leading-tight mt-1">Müşteri Memnuniyeti<br/>ve Tavsiye Oranı</div>
                </div>
              </div>
              <div className="space-y-4">
                {displayedReviews.length > 0 ? displayedReviews.map((review: any) => (
                  <div key={review.id} className="bg-brand-main rounded-2xl p-5 border border-brand-gold/10 hover:border-brand-gold/30 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-card border border-brand-gold/20 flex items-center justify-center text-brand-gold font-bold font-serif text-lg">
                          {review.user.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-brand-text flex items-center gap-2">
                            {review.user}
                            {review.verified && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-brand-gold bg-brand-gold/10 border border-brand-gold/20 px-2 py-0.5 rounded-full uppercase tracking-wider h-fit">
                                <CheckCircle className="w-3 h-3" /> Doğrulanmış
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-brand-muted">{review.date}</span>
                        </div>
                      </div>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-brand-gold text-brand-gold' : 'text-brand-border'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-brand-text/80 leading-relaxed text-sm pt-2">{review.text}</p>
                  </div>
                )) : (
                  <div className="text-center py-8 text-brand-muted italic bg-brand-card/50 rounded-2xl border border-brand-gold/10">Bu ürün için henüz değerlendirme yapılmamış. İlk değerlendiren siz olun!</div>
                )}
              </div>
              {productReviews.length > 3 && (
                <button onClick={() => setShowAllReviews(!showAllReviews)} className="mt-4 text-brand-gold font-bold hover:bg-brand-gold hover:text-white transition-colors w-full text-center py-3 bg-brand-card border border-brand-gold/30 rounded-xl">
                  {showAllReviews ? 'Daha Az Göster' : 'Tüm Değerlendirmeleri Gör'}
                </button>
              )}
            </AccordionItem>
            
            {/* Recipes Section */}
            {recipes?.some((recipe: any) => recipe.content?.toLowerCase().includes(product.name?.toLowerCase()) || recipe.title?.toLowerCase().includes(product.name?.toLowerCase())) && (
              <AccordionItem title="Tarifler ve Tüketim Önerileri" isOpen={openSection === 'recipes'} onClick={() => toggleSection('recipes')}>
                <div className="space-y-4">
                  {recipes.filter((recipe: any) => recipe.content?.toLowerCase().includes(product.name?.toLowerCase()) || recipe.title?.toLowerCase().includes(product.name?.toLowerCase())).map((recipe: any) => (
                    <div key={recipe.id} className="bg-brand-main p-4 rounded-xl border border-brand-gold/10 hover:border-brand-gold/30 transition-all group">
                      <div className="flex gap-4 items-center">
                        <img src={recipe.image || 'https://picsum.photos/seed/recipe1/200/200'} alt={recipe.title} className="w-16 h-16 object-cover rounded-lg shrink-0 border border-brand-gold/20" />
                        <div className="flex-1">
                          <h4 className="font-bold text-brand-text text-sm mb-1 group-hover:text-brand-gold transition-colors">{recipe.title}</h4>
                          <p className="text-brand-muted text-xs line-clamp-2 mb-2">{recipe.summary}</p>
                          <button 
                            onClick={() => setLocalSelectedRecipe(recipe)}
                            className="text-brand-gold font-bold text-xs hover:underline flex items-center gap-1"
                          >
                            Tarifi İncele <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionItem>
            )}

          </div>
        </div>
      </div>

      {/* Related Products */}
      <div className="border-t border-brand-gold/10 pt-16">
        <div className="mb-10 text-center sm:text-left">
          <h2 className="text-3xl font-serif text-brand-gold tracking-wide mb-3">Tamamlayıcı Ürünler</h2>
          <p className="text-brand-muted italic max-w-2xl font-serif text-lg mx-auto sm:mx-0">"Bu ürünle birlikte en çok tercih edilen, kalitesi onaylanmış diğer doğal hazinelerimiz."</p>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-12 hide-scrollbar snap-x px-4 sm:px-0 -mx-4 sm:mx-0">
          {relatedProducts.map(p => (
            <div key={p.id} className="min-w-[280px] w-[280px] snap-center">
              <ProductCard 
                product={p} 
                onClick={() => onProductClick(p)}
                onAddToCart={() => onAddToCart(p)}
                onToggleFavorite={() => onToggleFavorite(p)}
                isFavorite={favorites.includes(p.id)}
                onShare={onShare}
                onGift={() => onGift(p)}
              />
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* Sticky Mobile/Desktop Action Bar */}
      <div className="fixed bottom-[64px] sm:bottom-0 left-0 right-0 p-3 sm:p-4 bg-brand-main/95 backdrop-blur-xl border-t border-brand-gold/10 z-50 shadow-[0_-10px_40px_-15px_rgba(212,175,55,0.2)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-6">
          
          <div className="hidden md:flex flex-col gap-1 px-4">
            {product.pricePrefix && (
              <span className="text-[10px] uppercase font-bold tracking-widest text-brand-gold/70">
                {product.pricePrefix}
              </span>
            )}
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold text-brand-gold font-serif">{finalPrice * quantity} ₺</span>
              <div className="h-10 w-px bg-brand-gold/20"></div>
            </div>
          </div>
          
          <div className="flex flex-wrap w-full md:flex-1 gap-2 sm:gap-3">
            <button 
              onClick={() => onGift(product)}
              className="flex items-center justify-center gap-2 px-4 bg-brand-main/50 border border-brand-gold/30 text-brand-gold py-3 sm:py-3.5 rounded-xl hover:bg-brand-gold hover:text-brand-main transition-all shrink-0 shadow-sm active:scale-95"
              aria-label="Hediye Et"
              title="Hediye Et"
            >
              <Gift className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>

            {product.preOrder ? (
              <button 
                onClick={() => { handleLocalAddToCart(); setCurrentTab('cart'); }}
                className="flex-1 bg-gradient-to-r from-brand-gold to-[#c29c29] text-brand-main py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm tracking-widest uppercase hover:opacity-90 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                aria-label="Hemen Ön Sipariş Ver"
              >
                <Calendar className="w-5 h-5" />
                HEMEN ÖN SİPARİŞ VER
              </button>
            ) : (
              <>
                <button 
                  onClick={handleLocalAddToCart}
                  className="flex-1 bg-brand-gold text-brand-main py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm tracking-widest uppercase hover:bg-brand-green hover:text-white transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
                  aria-label="Sepete Ekle"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Sepete Ekle
                </button>

                <button 
                  onClick={() => { handleLocalAddToCart(); setCurrentTab('cart'); }}
                  className="flex-[1.2] lg:flex-1 bg-gradient-to-r from-brand-green to-[#134e2c] border border-brand-green/20 text-white py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm tracking-widest uppercase hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg"
                  aria-label="Hemen Satın Al"
                >
                  <Zap className="w-4 h-4 ml-[-4px]" />
                  HEMEN AL
                </button>
              </>
            )}
          </div>

        </div>
      </div>

      {localSelectedRecipe && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-brand-card rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-8 animate-in zoom-in-95 relative">
            <button onClick={() => setLocalSelectedRecipe(null)} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
              <X className="w-5 h-5" />
            </button>
            <img src={localSelectedRecipe.image} alt={localSelectedRecipe.title} className="w-full h-64 object-cover" />
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-3 py-1 bg-brand-gold/10 text-brand-gold text-xs font-bold rounded-full uppercase tracking-wider">
                  {localSelectedRecipe.category || 'Tarif'}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-brand-gold mb-3 leading-tight">{localSelectedRecipe.title}</h2>
              <p className="text-brand-muted italic mb-6 border-l-4 border-brand-gold pl-4">{localSelectedRecipe.summary}</p>
              
              <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-brand-text/80">
                {localSelectedRecipe.content.split('Hazırlanışı:').map((part: string, idx: number) => {
                  if (idx === 0) {
                    return (
                      <div key={idx} className="mb-6">
                        <h4 className="font-bold text-brand-gold flex items-center gap-2 mb-3">
                          <Box className="w-5 h-5" /> Malzemeler
                        </h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {part.replace('Malzemeler:', '').split(',').map((item: string, i: number) => (
                            <li key={i}>{item.trim()}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  } else {
                    return (
                      <div key={idx} className="mb-6 bg-brand-main p-5 rounded-xl border border-brand-gold/10">
                        <h4 className="font-bold text-brand-gold flex items-center gap-2 mb-3">
                          <CheckCircle2 className="w-5 h-5" /> Hazırlanışı ve Faydaları
                        </h4>
                        <p className="leading-relaxed text-brand-text/80">{part.trim()}</p>
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function AccordionItem({ title, isOpen, onClick, children }: any) {
  return (
    <div className="border border-brand-gold/10 rounded-2xl overflow-hidden bg-brand-card shadow-sm transition-all duration-300">
      <button 
        onClick={onClick} 
        className={`w-full flex items-center justify-between p-5 bg-transparent hover:bg-brand-gold/5 transition-colors group ${isOpen ? 'border-b border-brand-gold/10' : ''}`}
      >
        <span className="font-serif text-lg font-bold text-brand-text group-hover:text-brand-gold transition-colors">{title}</span>
        <div className={`p-1 rounded-full transition-colors shrink-0 ${isOpen ? 'bg-brand-gold text-brand-main' : 'bg-brand-main text-brand-gold group-hover:bg-brand-gold/20'}`}>
          <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <div 
        className="grid transition-all duration-300 ease-in-out" 
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
        aria-hidden={!isOpen}
      >
        <div className="overflow-hidden min-h-0">
          <div className={`p-5 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function CartSection({ cart, onRemove, onUpdateQuantity, onCheckout, navigateToTab }: any) {
  const total = cart.reduce((sum: number, item: any) => sum + ((Number(item.price) || 0) * (item.quantity || 1)), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-in fade-in">
      <div className="flex items-center gap-3 mb-8">
         <ShoppingCart className="w-8 h-8 text-brand-gold" />
         <h2 className="text-3xl font-serif text-brand-green dark:text-brand-gold">Sepetim ({cart.length})</h2>
      </div>
      
      {cart.length === 0 ? (
        <div className="text-center py-24 sm:py-32 bg-gradient-to-b from-white/50 to-transparent dark:from-gray-800/50 dark:to-transparent backdrop-blur-sm rounded-[2rem] border border-brand-gold/20 shadow-xl flex flex-col items-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 mix-blend-overlay"></div>
          <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-brand-gold/10 to-brand-gold/5 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(212,175,55,0.1)] border border-brand-gold/20 relative z-10">
             <ShoppingCart className="w-10 h-10 sm:w-16 sm:h-16 text-brand-gold drop-shadow-lg" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-serif text-brand-text mb-4 relative z-10">Sepetiniz Boş</h3>
          <p className="text-gray-500 dark:text-gray-400 font-serif text-base sm:text-lg mb-8 max-w-md relative z-10 px-4">
            Doğanın en özel şifaları keşfedilmeyi bekliyor. Kendinize ve sevdiklerinize iyilik yapmak için eşsiz lezzetlerimizi inceleyin.
          </p>
          <button 
            onClick={() => navigateToTab('home')}
            className="group relative px-8 py-4 bg-brand-green text-white rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(22,101,52,0.3)] transition-transform hover:-translate-y-1 relative z-10"
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-brand-gold/0 via-brand-gold/20 to-brand-gold/0 translate-x-[-100%] group-hover:animate-[shimmer_2s_infinite]"></div>
            <span className="relative flex items-center gap-2 font-bold tracking-wide">
              Eşsiz Ürünleri Keşfet <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3 items-start">
          <div className="lg:col-span-2 space-y-5">
            {cart.map((item: any) => (
              <div key={item.id} className="relative group bg-white dark:bg-gray-800 p-5 rounded-[1.5rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-brand-gold/30 transition-all duration-300 flex flex-col sm:flex-row gap-5 items-center overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none group-hover:bg-brand-gold/10 transition-colors"></div>
                
                <div className="relative">
                  <img src={item.image} className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-50 dark:border-gray-700" alt={item.name} />
                  {(item.quantity || 1) > 1 && (
                    <div className="absolute -top-2 -right-2 bg-brand-gold text-white text-[10px] uppercase font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-md">
                      x{item.quantity}
                    </div>
                  )}
                </div>
                
                <div className="flex-grow flex flex-col w-full text-center sm:text-left">
                  <h3 className="font-serif font-bold text-gray-900 dark:text-white text-lg mb-1 leading-tight group-hover:text-brand-gold transition-colors">{item.name || item.title}</h3>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">{item.category || "Golden Oremar Organik"}</div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-auto gap-4 sm:gap-0">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <span className="text-brand-green dark:text-brand-gold font-bold text-xl">{Number(item.price) || 0} ₺</span>
                      {(item.quantity || 1) > 1 && (
                        <span className="text-xs text-gray-400 line-through opacity-70">
                          {((Number(item.price) || 0) * (item.quantity || 1))} ₺
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-none border-gray-100 dark:border-gray-700 pt-3 sm:pt-0">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-1 shadow-inner relative z-10">
                        <button 
                          onClick={() => onUpdateQuantity(item.id, -1)}
                          disabled={(item.quantity || 1) <= 1}
                          className="p-2 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 rounded-lg disabled:opacity-30 transition-colors shadow-sm"
                          aria-label="Azalt"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-bold w-8 font-serif text-center text-brand-green dark:text-brand-gold">{Number(item.quantity) || 1}</span>
                        <button 
                          onClick={() => onUpdateQuantity(item.id, 1)}
                          className="p-2 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors shadow-sm"
                          aria-label="Artır"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <button 
                        onClick={() => onRemove(item.id)} 
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all relative z-10"
                        aria-label="Sepetten Çıkar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-8 rounded-[2rem] border border-brand-gold/20 h-fit sticky top-24 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
            <h3 className="font-serif text-2xl font-bold text-gray-900 dark:text-white mb-6 border-b border-gray-100 dark:border-gray-700 pb-4 flex items-center gap-2">
               <ShieldCheck className="w-6 h-6 text-brand-gold" />
               Sipariş Özeti
            </h3>
            
            <div className="space-y-4 mb-8 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-300 font-medium">
                <span>Ara Toplam</span>
                <span>{total} ₺</span>
              </div>
              <div className="flex justify-between items-center bg-brand-green/5 dark:bg-brand-gold/5 p-3 rounded-xl border border-brand-green/10 dark:border-brand-gold/10">
                <span className="text-brand-green dark:text-brand-gold font-bold flex items-center gap-2"><Truck className="w-4 h-4"/> Özel Soğuk Zincir Kargo</span>
                <span className="text-brand-green dark:text-brand-gold font-bold">Ücretsiz</span>
              </div>
            </div>
            
            <div className="flex justify-between items-end mb-8 border-t border-gray-100 dark:border-gray-700 pt-6">
              <span className="text-gray-500 dark:text-gray-400 font-medium pb-1">Genel Toplam</span>
              <span className="text-4xl font-serif font-bold text-brand-gold leading-none drop-shadow-sm">{total} ₺</span>
            </div>
            
            <button 
              onClick={onCheckout}
              className="w-full bg-gradient-to-r from-brand-gold to-yellow-600 text-white py-4 rounded-xl font-bold hover:shadow-[0_10px_30px_rgba(212,175,55,0.4)] hover:-translate-y-1 active:scale-95 transition-all text-lg flex items-center justify-center gap-2 relative overflow-hidden group shadow-md"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
              <span>Sepeti Onayla ve Öde</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <div className="mt-6 flex flex-col gap-3">
              <p className="text-center text-[11px] text-gray-400 uppercase tracking-widest flex items-center justify-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-gray-300" /> %100 Güvenli Alışveriş
              </p>
              <div className="flex justify-center gap-2 opacity-60">
                 <div className="w-8 h-5 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-[8px] font-bold">VISA</div>
                 <div className="w-8 h-5 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-[8px] font-bold">MC</div>
                 <div className="w-8 h-5 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-[8px] font-bold">3D</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FavoritesSection({ favorites, favoriteRecipes, favoriteBlogs, favoriteProductHealth, favoriteEvents, onProductClick, onAddToCart, onToggleFavorite, onToggleFavoriteRecipe, onToggleFavoriteBlog, onToggleFavoriteProductHealth, onToggleFavoriteEvent, onShare, onShareArticle, onGift, onLike, likedItems }: any) {
  const { products, recipes, blogPosts, productHealthInfo, events } = useData();
  const [activeTab, setActiveTab] = useState<'products' | 'recipes' | 'blogs' | 'productHealth' | 'events'>('products');
  const favProducts = products.filter(p => favorites.includes(p.id));
  const favRecipes = recipes.filter(r => favoriteRecipes.includes(r.id));
  const favBlogs = blogPosts.filter(b => favoriteBlogs.includes(b.id));
  const favProductHealth = productHealthInfo.filter(p => favoriteProductHealth.includes(p.productId));
  const favEvents = events.filter(e => favoriteEvents.includes(e.id));
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Heart className="w-8 h-8 text-brand-gold fill-current" />
          <h2 className="text-3xl font-serif text-brand-green dark:text-brand-gold">Favorilerim</h2>
        </div>
        
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => setActiveTab('products')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'products' ? 'bg-white dark:bg-gray-700 text-brand-green dark:text-brand-gold shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white dark:hover:text-gray-200'}`}
          >
            Ürünler ({favProducts.length})
          </button>
          <button 
            onClick={() => setActiveTab('recipes')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'recipes' ? 'bg-white dark:bg-gray-700 text-brand-green dark:text-brand-gold shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white dark:hover:text-gray-200'}`}
          >
            Tarifler ({favRecipes.length})
          </button>
          <button 
            onClick={() => setActiveTab('blogs')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'blogs' ? 'bg-white dark:bg-gray-700 text-brand-green dark:text-brand-gold shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white dark:hover:text-gray-200'}`}
          >
            Sağlık ({favBlogs.length})
          </button>
          <button 
            onClick={() => setActiveTab('productHealth')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'productHealth' ? 'bg-white dark:bg-gray-700 text-brand-green dark:text-brand-gold shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white dark:hover:text-gray-200'}`}
          >
            Ürün Bilgileri ({favProductHealth.length})
          </button>
          <button 
            onClick={() => setActiveTab('events')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'events' ? 'bg-white dark:bg-gray-700 text-brand-green dark:text-brand-gold shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white dark:hover:text-gray-200'}`}
          >
            Etkinlikler ({favEvents.length})
          </button>
        </div>
      </div>
      
      {activeTab === 'products' && (
        favProducts.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-lg text-gray-500 dark:text-gray-400">Henüz favori ürününüz yok.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {favProducts.map(p => (
              <ProductCard 
                key={p.id} 
                product={p} 
                onClick={() => onProductClick(p)}
                onAddToCart={() => onAddToCart(p)}
                onToggleFavorite={() => onToggleFavorite(p)}
                isFavorite={true}
                onShare={() => onShare(p)}
                onGift={() => onGift(p)}
                onLike={() => onLike(`product_${p.id}`)}
                isLiked={likedItems.includes(`product_${p.id}`)}
              />
            ))}
          </div>
        )
      )}
      
      {activeTab === 'recipes' && (
        favRecipes.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-lg text-gray-500 dark:text-gray-400">Henüz favori tarifiniz yok.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {favRecipes.map(recipe => (
              <div key={recipe.id} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm relative group hover:shadow-md transition-shadow">
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    onClick={() => onShareArticle(recipe)}
                    className="p-2 bg-gray-50 dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Paylaş"
                  >
                    <Share2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                  <button 
                    onClick={() => onToggleFavoriteRecipe(recipe)}
                    className="p-2 bg-gray-50 dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Favorilerden çıkar"
                  >
                    <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                  </button>
                </div>
                <div className="mb-4">
                  <span className="inline-block px-3 py-1 bg-brand-gold/10 text-brand-gold text-xs font-bold rounded-full mb-3">
                    {recipe.category || 'Tarif'}
                  </span>
                  <h4 className="text-xl font-bold text-brand-green dark:text-brand-gold mb-2 pr-16">{recipe.title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{recipe.summary}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{recipe.content}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <button 
                    onClick={() => onLike(`recipe_${recipe.id}`)}
                    className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${likedItems.includes(`recipe_${recipe.id}`) ? 'text-brand-gold' : 'text-gray-400 hover:text-brand-gold'}`}
                  >
                    <ThumbsUp className={`w-4 h-4 ${likedItems.includes(`recipe_${recipe.id}`) ? 'fill-brand-gold' : ''}`} />
                    {likedItems.includes(`recipe_${recipe.id}`) ? 'Beğendin' : 'Beğen'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === 'blogs' && (
        favBlogs.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-lg text-gray-500 dark:text-gray-400">Henüz favori sağlık yazınız yok.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {favBlogs.map(article => (
              <div key={article.id} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm relative group hover:shadow-md transition-shadow">
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    onClick={() => onShareArticle(article)}
                    className="p-2 bg-gray-50 dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Paylaş"
                  >
                    <Share2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                  <button 
                    onClick={() => onToggleFavoriteBlog(article)}
                    className="p-2 bg-gray-50 dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Favorilerden çıkar"
                  >
                    <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                  </button>
                </div>
                <div className="mb-4">
                  <span className="inline-block px-3 py-1 bg-brand-gold/10 text-brand-gold text-xs font-bold rounded-full mb-3">
                    Sağlık
                  </span>
                  <h4 className="text-xl font-bold text-brand-green dark:text-brand-gold mb-2 pr-16">{article.title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{article.summary}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{article.content}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <button 
                    onClick={() => onLike(`blog_${article.id}`)}
                    className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${likedItems.includes(`blog_${article.id}`) ? 'text-brand-gold' : 'text-gray-400 hover:text-brand-gold'}`}
                  >
                    <ThumbsUp className={`w-4 h-4 ${likedItems.includes(`blog_${article.id}`) ? 'fill-brand-gold' : ''}`} />
                    {likedItems.includes(`blog_${article.id}`) ? 'Beğendin' : 'Beğen'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === 'productHealth' && (
        favProductHealth.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-lg text-gray-500 dark:text-gray-400">Henüz favori ürün sağlık bilginiz yok.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {favProductHealth.map(info => (
              <div key={info.productId} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm relative group hover:shadow-md transition-shadow">
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    onClick={() => onShareArticle(info)}
                    className="p-2 bg-gray-50 dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Paylaş"
                  >
                    <Share2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                  <button 
                    onClick={() => onToggleFavoriteProductHealth(info)}
                    className="p-2 bg-gray-50 dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Favorilerden çıkar"
                  >
                    <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                  </button>
                </div>
                <div className="mb-4">
                  <span className="inline-block px-3 py-1 bg-brand-gold/10 text-brand-gold text-xs font-bold rounded-full mb-3">
                    Ürün Sağlık Bilgisi
                  </span>
                  <h4 className="text-xl font-bold text-brand-green dark:text-brand-gold mb-2 pr-16">{info.title}</h4>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{info.content}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <button 
                    onClick={() => onLike(`prod_health_${info.id}`)}
                    className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${likedItems.includes(`prod_health_${info.id}`) ? 'text-brand-gold' : 'text-gray-400 hover:text-brand-gold'}`}
                  >
                    <ThumbsUp className={`w-4 h-4 ${likedItems.includes(`prod_health_${info.id}`) ? 'fill-brand-gold' : ''}`} />
                    {likedItems.includes(`prod_health_${info.id}`) ? 'Beğendin' : 'Beğen'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === 'events' && (
        favEvents.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-lg text-gray-500 dark:text-gray-400">Henüz favori etkinliğiniz yok.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {favEvents.map(event => (
              <div key={event.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                <div className="relative h-48 overflow-hidden">
                  <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute top-3 right-3 flex flex-col gap-2">
                    <button onClick={() => onToggleFavoriteEvent(event)} className="p-2 bg-white dark:bg-gray-800/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full shadow-lg">
                      <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                    </button>
                    <button onClick={() => onShareArticle(event)} className="p-2 bg-white dark:bg-gray-800/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full shadow-lg">
                      <Share2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                </div>
                <div className="p-5">
                  <h4 className="font-bold text-brand-green dark:text-brand-gold mb-2 text-lg">{event.title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">{event.description}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-800">
                    <button 
                      onClick={() => onLike(`event_${event.id}`)}
                      className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${likedItems.includes(`event_${event.id}`) ? 'text-brand-gold' : 'text-gray-400 hover:text-brand-gold'}`}
                    >
                      <ThumbsUp className={`w-4 h-4 ${likedItems.includes(`event_${event.id}`) ? 'fill-brand-gold' : ''}`} />
                      {likedItems.includes(`event_${event.id}`) ? 'Beğendin' : 'Beğen'}
                    </button>
                    <span className="text-[10px] text-gray-400 font-medium">{event.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function EventsPage() {
  const { events, addEventReservation } = useData();
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', guests: 1 });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addEventReservation({
      eventId: selectedEvent.id,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      guests: formData.guests,
      date: new Date().toISOString()
    });
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setSelectedEvent(null);
      setFormData({ name: '', email: '', phone: '', guests: 1 });
    }, 3000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4">
      <h2 className="text-3xl font-serif text-brand-green dark:text-brand-gold mb-8 text-center">Etkinlik Takvimi</h2>
      <div className="grid gap-8">
        {events.map((event: any) => (
          <div key={event.id} className="bg-brand-card rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row group hover:border-brand-gold/50 transition-colors">
            <div className="md:w-1/3 h-48 md:h-auto relative overflow-hidden">
              <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute top-4 left-4 bg-brand-gold text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
                {event.date}
              </div>
            </div>
            <div className="p-6 md:w-2/3 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-brand-gold mb-2 text-sm font-bold uppercase tracking-wider">
                <MapPin className="w-4 h-4" />
                {event.location}
              </div>
              <h3 className="text-2xl font-bold text-brand-text mb-3">{event.title}</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">{event.description}</p>
              <button 
                onClick={() => setSelectedEvent(event)}
                className="self-start px-6 py-2 bg-brand-green text-white rounded-full text-sm font-bold hover:bg-brand-gold transition-colors shadow-md"
              >
                Kayıt Ol
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Etkinlik Kaydı</h3>
              <button onClick={() => setSelectedEvent(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6">
              {isSubmitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Kaydınız Alındı!</h4>
                  <p className="text-gray-600 dark:text-gray-400">Etkinlik detayları e-posta adresinize gönderilecektir.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="mb-6 p-4 bg-brand-green/5 rounded-xl border border-brand-green/20">
                    <h4 className="font-bold text-brand-green mb-1">{selectedEvent.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> {selectedEvent.date}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Ad Soyad</label>
                    <input required type="text" className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">E-posta</label>
                    <input required type="email" className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Telefon</label>
                    <input required type="tel" className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Kişi Sayısı</label>
                    <input required type="number" min="1" max="10" className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900" value={formData.guests} onChange={e => setFormData({...formData, guests: parseInt(e.target.value) || 1})} />
                  </div>
                  <button type="submit" className="w-full py-3 bg-brand-green text-white rounded-xl font-bold hover:bg-green-800 transition-colors mt-4">
                    Kaydı Tamamla
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HealthPage({ onShare, favoriteBlogs, onToggleFavoriteBlog }: any) {
  const { blogPosts } = useData();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4">
      <h2 className="text-3xl font-serif text-brand-green dark:text-brand-gold mb-8 text-center">Sağlık & Yaşam</h2>
      <div className="grid gap-8">
        {blogPosts.map((guide: any) => (
          <div key={guide.id} className="bg-brand-card rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800 group hover:border-brand-gold/50 transition-colors relative">
            <div className="absolute top-4 right-4 flex gap-2 z-10">
              <button 
                onClick={() => onShare(guide)}
                className="p-2 bg-white dark:bg-gray-800/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-full shadow-sm hover:bg-white dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                aria-label="Paylaş"
              >
                <Share2 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
              <button 
                onClick={() => onToggleFavoriteBlog(guide)}
                className="p-2 bg-white dark:bg-gray-800/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-full shadow-sm hover:bg-white dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                aria-label={favoriteBlogs.includes(guide.id) ? "Favorilerden çıkar" : "Favorilere ekle"}
              >
                <Heart className={`w-5 h-5 ${favoriteBlogs.includes(guide.id) ? 'fill-red-500 text-red-500' : 'text-gray-700 dark:text-gray-300'}`} />
              </button>
            </div>
            <div className="h-64 relative overflow-hidden">
              <img src={guide.image} alt={guide.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <div className="text-brand-gold text-xs font-bold mb-1">{guide.date}</div>
                <h3 className="text-2xl font-bold text-white">{guide.title}</h3>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-300 mb-4 font-medium italic border-l-4 border-brand-gold pl-4">
                {guide.summary}
              </p>
              <div className="text-gray-600 dark:text-gray-400 leading-relaxed">
                {expandedId === guide.id ? guide.content : `${guide.content.substring(0, 150)}...`}
                <button 
                  onClick={() => setExpandedId(expandedId === guide.id ? null : guide.id)}
                  className="mt-6 text-brand-gold font-bold flex items-center gap-2 hover:gap-3 transition-all"
                >
                  {expandedId === guide.id ? 'Daha Az Göster' : 'Devamını Oku'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactPage() {
  const { contactInfo } = useData();
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4">
      <h2 className="text-3xl font-serif text-brand-green dark:text-brand-gold mb-8 text-center">İletişim</h2>
      
      <div className="grid md:grid-cols-2 gap-8">
        {/* Contact Info */}
        <div className="space-y-6">
          <a
            href={contactInfo.mapUrl || "https://maps.google.com/?q=Hakkari+Yüksekova+Dağlıca+Yeşiltaş+köyü"}
            target="_blank" rel="noopener noreferrer"
            className="block bg-brand-card p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:border-brand-gold/50 transition-colors group cursor-pointer"
          >
            <h3 className="text-xl font-bold text-brand-text mb-4 flex items-center gap-2 group-hover:text-brand-gold transition-colors">
              <MapPin className="w-5 h-5 text-brand-gold" /> Adres
            </h3>
            <p className="text-gray-600 dark:text-gray-300 font-medium leading-relaxed">{contactInfo.address}</p>
          </a>
          
          <a 
            href={`tel:${contactInfo.phone?.replace(/\s/g, '')}`}
            className="block bg-brand-card p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:border-brand-gold/50 transition-colors group cursor-pointer"
          >
            <h3 className="text-xl font-bold text-brand-text mb-4 flex items-center gap-2 group-hover:text-brand-gold transition-colors">
              <Phone className="w-5 h-5 text-brand-gold" /> Telefon
            </h3>
            <p className="text-gray-600 dark:text-gray-300 font-medium text-lg tracking-wider">{contactInfo.phone}</p>
          </a>

          {(contactInfo as any).whatsapp && (
            <a 
              href={`https://wa.me/${(contactInfo as any).whatsapp.replace(/\D/g, '')}`}
              target="_blank" rel="noopener noreferrer"
              className="block bg-brand-card p-6 rounded-2xl border border-green-200 dark:border-green-900 shadow-sm hover:border-green-500 transition-colors group cursor-pointer"
            >
              <h3 className="text-xl font-bold text-brand-text mb-4 flex items-center gap-2 group-hover:text-green-500 transition-colors">
                <MessageCircle className="w-5 h-5 text-green-500" /> Müşteri Hizmetleri (7/24 WhatsApp)
              </h3>
              <p className="text-gray-600 dark:text-gray-300 font-medium text-lg tracking-wider">{(contactInfo as any).whatsapp}</p>
            </a>
          )}

          <a 
            href={`mailto:${contactInfo.email}`}
            className="block bg-brand-card p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:border-brand-gold/50 transition-colors group cursor-pointer"
          >
            <h3 className="text-xl font-bold text-brand-text mb-4 flex items-center gap-2 group-hover:text-brand-gold transition-colors">
              <Mail className="w-5 h-5 text-brand-gold" /> E-posta
            </h3>
            <p className="text-gray-600 dark:text-gray-300 font-medium text-lg">{contactInfo.email}</p>
          </a>

          <div className="bg-brand-card p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="text-xl font-bold text-brand-text mb-2 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-brand-gold" /> Bizi Takip Edin
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">En yeni hasatlarımızdan, kampanyalardan ve doğal yaşam önerilerimizden haberdar olmak için topluluğumuza katılın.</p>
            <div className="flex flex-wrap gap-4">
              {contactInfo.social.instagram && (
                <a href={contactInfo.social.instagram} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-pink-50 dark:hover:bg-pink-900/20 hover:text-pink-600 transition-colors group">
                  <svg className="w-6 h-6 fill-current text-gray-600 dark:text-gray-400 group-hover:text-pink-600" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm3.98-10.105a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z"/></svg>
                </a>
              )}
              {contactInfo.social.facebook && (
                <a href={contactInfo.social.facebook} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors group">
                   <svg className="w-6 h-6 fill-current text-gray-600 dark:text-gray-400 group-hover:text-blue-600" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
                </a>
              )}
              {contactInfo.social.twitter && (
                 <a href={contactInfo.social.twitter} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors group">
                    <svg className="w-6 h-6 fill-current text-gray-600 dark:text-gray-400 group-hover:text-black dark:group-hover:text-white" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 3.82H5.078z"/></svg>
                 </a>
              )}
              {contactInfo.social.youtube && (
                 <a href={contactInfo.social.youtube} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group">
                    <svg className="w-6 h-6 fill-current text-gray-600 dark:text-gray-400 group-hover:text-red-500" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                 </a>
              )}
              {contactInfo.social.tiktok && (
                 <a href={contactInfo.social.tiktok} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors group">
                    <svg className="w-6 h-6 fill-current text-gray-600 dark:text-gray-400 group-hover:text-black dark:group-hover:text-white" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
                 </a>
              )}
              {(contactInfo.social as any).linkedin && (
                 <a href={(contactInfo.social as any).linkedin} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 transition-colors group">
                    <svg className="w-6 h-6 fill-current text-gray-600 dark:text-gray-400 group-hover:text-blue-700" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                 </a>
              )}
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-brand-card p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg h-fit">
          <h3 className="text-xl font-bold text-brand-text mb-6">Bize Ulaşın</h3>
          <form className="space-y-4" onSubmit={async (e) => {
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
                  subject: `Yeni İletişim Formu: ${subject}`,
                  html: `<p><strong>Gönderen:</strong> ${name} (${email})</p><p><strong>Mesaj:</strong></p><p>${message}</p>`
                }
              });

              // Otomatik cevap email'i
              await addDoc(collection(db, 'mail'), {
                to: [email],
                message: {
                  subject: 'Talebiniz Alındı - Golden Oremar',
                  html: `<p>Sayın ${name},</p><p>İletişim talebinizi aldık. En kısa sürede VIP ekibimiz sizinle iletişime geçecektir.</p><p>Gönderdiğiniz mesaj:<br><em>${message}</em></p>`
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
          </form>
        </div>
      </div>
    </div>
  );
}

function AboutPage() {
  const { staticContent } = useData();
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4">
      <h2 className="text-3xl font-serif text-brand-green dark:text-brand-gold mb-8 text-center">{staticContent.about.title}</h2>
      <div className="bg-brand-card border border-gray-200 dark:border-gray-800 p-8 rounded-2xl shadow-lg prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: staticContent.about.content }}></div>
    </div>
  );
}

function VendorStorePage({ vendor, onBack, onProductClick, onAddToCart, onToggleFavorite, favorites, onShare, onGift, followedVendors, toggleFollowVendor }: any) {
  const { products, addNotification, currentUser } = useData();
  const [showMenu, setShowMenu] = useState(false);
  const [showModal, setShowModal] = useState<'report' | 'contact' | 'review' | null>(null);
  const [modalText, setModalText] = useState('');
  const [modalRating, setModalRating] = useState(5);
  const [toast, setToast] = useState('');
  
  const vendorProducts = products.filter(p => (p.vendorId === vendor.id || p.vendor_id === vendor.id || (vendor.id === 'admin' && (!p.vendorId && !p.vendor_id))) && p.is_approved !== false);
  const isFollowed = followedVendors?.includes(vendor.id);

  const handleModalSubmit = () => {
    if (showModal === 'contact') {
       addNotification({
         userId: vendor.id,
         message: `${currentUser?.name || 'Bir kullanıcı'} size mesaj gönderdi: "${modalText}"`,
         type: 'message'
       });
       setToast('Mesajınız satıcıya iletildi.');
    } else if (showModal === 'report') {
       addNotification({
         userId: 'super_admin', // generic string that could be picked up later, or notify admins
         message: `${vendor.storeName || vendor.name} mağazası şikayet edildi: ${modalText}`,
         type: 'alert'
       });
       setToast('Şikayetiniz sistem yöneticilerine iletildi.');
    } else if (showModal === 'review') {
       setToast('Değerlendirmeniz için teşekkür ederiz!');
    } else {
       setToast('İşleminiz başarıyla kaydedildi.');
    }

    setTimeout(() => setToast(''), 3000);
    setShowModal(null);
    setModalText('');
    setShowMenu(false);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 pb-24 bg-brand-main">
      <div className="bg-brand-main/80 backdrop-blur-xl border-b border-brand-gold/10 transition-all sticky top-0 z-40" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="w-10 h-10 rounded-full bg-brand-card flex items-center justify-center hover:bg-brand-gold/20 hover:text-brand-gold transition-colors text-brand-muted border border-transparent hover:border-brand-gold/50" aria-label="Geri">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="font-serif font-bold text-lg text-brand-text truncate">
              {vendor.storeName || vendor.fullName}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => {
              if (navigator.share) {
                navigator.share({ title: vendor.storeName, url: window.location.href });
              }
            }} className="w-10 h-10 rounded-full bg-brand-card flex items-center justify-center text-brand-muted hover:bg-brand-gold/20 hover:text-brand-gold transition-colors border border-transparent hover:border-brand-gold/50" aria-label="Paylaş">
              <Share2 className="w-5 h-5 text-brand-gold" />
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="w-10 h-10 rounded-full bg-brand-card flex items-center justify-center text-brand-muted hover:bg-brand-gold/20 hover:text-brand-gold transition-colors border border-transparent hover:border-brand-gold/50"
              >
                <MoreVertical className="w-5 h-5 text-brand-gold" />
              </button>
              {showMenu && (
                <div className="absolute top-12 right-0 w-48 bg-brand-card border border-brand-gold/20 shadow-xl rounded-xl overflow-hidden z-50">
                  <button onClick={() => { setShowModal('contact'); setShowMenu(false); }} className="w-full text-left px-4 py-3 flex items-center gap-2 text-sm text-brand-text hover:bg-brand-gold/10 transition-colors">
                    <MessageSquare className="w-4 h-4 text-brand-gold" /> Mağazaya Soru Sor
                  </button>
                  <button onClick={() => { setShowModal('review'); setShowMenu(false); }} className="w-full text-left px-4 py-3 flex items-center gap-2 text-sm text-brand-text hover:bg-brand-gold/10 transition-colors border-t border-brand-gold/5">
                    <Star className="w-4 h-4 text-brand-gold" /> Mağazayı Değerlendir
                  </button>
                  <button onClick={() => { setShowModal('report'); setShowMenu(false); }} className="w-full text-left px-4 py-3 flex items-center gap-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors border-t border-brand-gold/5">
                    <AlertTriangle className="w-4 h-4" /> Mağazayı Şikayet Et
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-brand-card rounded-3xl mb-12 border border-brand-gold/20 shadow-lg relative overflow-hidden flex flex-col">
          {/* Cover Image Area */}
          <div className="h-48 md:h-64 relative bg-brand-main w-full overflow-hidden">
            {vendor.coverImage ? (
              <img src={vendor.coverImage} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-green/80 to-brand-earth/80">
                {/* Fallback pattern */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-gold via-transparent to-transparent"></div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-brand-card via-transparent to-transparent opacity-80"></div>
          </div>

          <div className="p-6 sm:p-10 flex flex-col md:flex-row items-center md:items-start gap-8 -mt-20 z-10">
            <div className="w-32 h-32 md:w-40 md:h-40 bg-brand-main border-4 border-brand-card rounded-full flex items-center justify-center shadow-2xl shrink-0 relative overflow-hidden">
              {vendor.profileImage ? (
                <img src={vendor.profileImage} alt={vendor.storeName || vendor.fullName} className="w-full h-full object-cover" />
              ) : (
                <Store className="w-12 h-12 md:w-16 md:h-16 text-brand-gold" />
              )}
              {vendor.is_verified && <div className="absolute bottom-2 right-2 bg-brand-main p-1 rounded-full border border-brand-gold/20 shadow-lg"><ShieldCheck className="w-5 h-5 text-brand-gold" title="Onaylı Satıcı" /></div>}
            </div>
            <div className="text-center md:text-left flex-1 mt-4 md:mt-0">
              <h1 className="text-3xl md:text-4xl font-serif text-brand-gold font-bold mb-3 flex items-center justify-center md:justify-start gap-2">
                {vendor.storeName || vendor.fullName}
              </h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-brand-text/80 mb-5">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-brand-gold/10 rounded-full border border-brand-gold/20">
                  <Star className="w-4 h-4 fill-brand-gold text-brand-gold" />
                  <span className="font-bold text-brand-gold">{Number(vendor.rating || 4.8).toFixed(1)}</span> Değerlendirme
                </div>
                <div className="flex items-center gap-1.5 text-brand-muted">
                  <MapPin className="w-4 h-4 text-brand-gold" /> {vendor.address || 'Hakkari / Yüksekova'}
                </div>
                {vendor.phone && (
                  <div className="flex items-center gap-1.5 text-brand-muted">
                    <Phone className="w-4 h-4 text-brand-gold" /> {vendor.phone}
                  </div>
                )}
                {vendor.email && (
                  <div className="flex items-center gap-1.5 text-brand-muted">
                    <Mail className="w-4 h-4 text-brand-gold" /> <a href={`mailto:${vendor.email}`} className="hover:text-brand-gold transition-colors">{vendor.email}</a>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-brand-muted">
                  <Package className="w-4 h-4 text-brand-gold" /> {vendorProducts.length} Ürün
                </div>
              </div>
              <p className="text-brand-text/70 max-w-2xl mx-auto md:mx-0 font-serif italic mb-6 leading-relaxed">
                "{vendor.about || 'Golden Oremar platformunda güvenilir satıcı. En taze ve doğal ürünleri sizlerle buluşturmaktan gurur duyarız.'}"
              </p>
              <div className="flex justify-center md:justify-start">
                <button 
                  onClick={() => toggleFollowVendor(vendor.id)}
                  className={`px-8 py-3 rounded-full font-bold text-sm tracking-wider uppercase transition-all flex items-center gap-2 border ${
                    isFollowed 
                    ? 'bg-brand-main text-brand-gold border-brand-gold shadow-sm' 
                    : 'bg-brand-gold text-brand-main border-transparent hover:bg-[#b59325] shadow-md'
                  }`}
                >
                  {isFollowed ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Takip Ediliyor
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4" />
                      Takip Et
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-8 pb-4 border-b border-brand-gold/10">
          <h2 className="text-2xl font-serif text-brand-gold font-bold flex items-center gap-2">
            <Package className="w-6 h-6" /> Mağazanın Ürünleri
          </h2>
        </div>

        <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-8 hide-scrollbar snap-x -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {vendorProducts.map((product) => (
             <div key={product.id} className="min-w-[260px] w-[260px] sm:min-w-0 sm:w-auto snap-center">
               <ProductCard 
                 product={product} 
                 onClick={() => onProductClick(product)} 
                 onAddToCart={onAddToCart}
                 onToggleFavorite={onToggleFavorite}
                 isFavorite={favorites.includes(String(product.legacyId || product.id))}
                 onShare={() => onShare(product)}
                 onGift={() => onGift(product)}
               />
             </div>
          ))}
          {vendorProducts.length === 0 && (
            <div className="col-span-full py-16 text-center text-brand-muted bg-brand-card/50 rounded-2xl border border-brand-gold/10">
              Bu mağazada henüz ürün bulunmamaktadır.
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-brand-card rounded-3xl w-full max-w-md p-6 shadow-2xl transition-all">
            <h3 className="text-xl font-bold text-brand-gold mb-4 flex items-center gap-2">
              {showModal === 'contact' && <><MessageSquare className="w-5 h-5" /> Mağazaya Soru Sor</>}
              {showModal === 'review' && <><Star className="w-5 h-5" /> Mağazayı Değerlendir</>}
              {showModal === 'report' && <><AlertTriangle className="w-5 h-5 text-red-500" /> Mağazayı Şikayet Et</>}
            </h3>

            {showModal === 'review' && (
              <div className="flex items-center gap-2 mb-4 justify-center">
                {[1, 2, 3, 4, 5].map(star => (
                   <button key={star} onClick={() => setModalRating(star)}>
                     <Star className={`w-8 h-8 ${modalRating >= star ? 'fill-brand-gold text-brand-gold' : 'text-gray-300 dark:text-gray-600'}`} />
                   </button>
                ))}
              </div>
            )}

            <textarea 
              value={modalText}
              onChange={(e) => setModalText(e.target.value)}
              placeholder={
                showModal === 'contact' ? 'Mesajınızı buraya yazın...' :
                showModal === 'review' ? 'Değerlendirmenizi yazın...' :
                'Şikayet sebebinizi detaylıca açıklayın...'
              }
              className="w-full p-4 bg-brand-main border border-brand-gold/20 rounded-xl mb-4 h-32 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-all resize-none text-brand-text"
            />

            <div className="flex gap-4">
              <button 
                onClick={() => { setShowModal(null); setModalText(''); }}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-brand-muted hover:text-brand-text rounded-xl font-bold transition-colors"
              >
                İptal
              </button>
              <button 
                onClick={handleModalSubmit}
                disabled={!modalText.trim() && showModal !== 'review'}
                className={`flex-1 px-4 py-3 text-white rounded-xl font-bold transition-colors shadow-lg ${
                  showModal === 'report' ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-green hover:bg-green-800'
                } disabled:opacity-50`}
              >
                Gönder
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-fade-in">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="font-medium text-sm">{toast}</span>
        </div>
      )}
    </div>
  );
}

function CategoriesPage({ onProductClick, onAddToCart, onToggleFavorite, favorites, onShare, onGift }: any) {
  const { products, categories } = useData();
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<string>('featured');
  const productsRef = useRef<HTMLDivElement>(null);

  const handleCategorySelect = (catName: string | null) => {
    setSelectedCat(catName);
    if (window.innerWidth < 1024 && productsRef.current) {
      setTimeout(() => {
        productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const filtered = (selectedCat ? products.filter(p => p.category === selectedCat && p.is_approved !== false) : products.filter(p => p.is_approved !== false)).sort((a, b) => {
    if (sortOption === 'price-asc') return a.price - b.price;
    if (sortOption === 'price-desc') return b.price - a.price;
    if (sortOption === 'rating') return b.rating - a.rating;
    return 0;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4">
        <h2 className="text-4xl md:text-5xl font-serif text-brand-green dark:text-brand-gold mb-4">Koleksiyonlarımız</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-lg">Doğanın en saf halini sofralarınıza taşıyan özenle seçilmiş ürünlerimiz.</p>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Categories (Responsive) */}
        <div className="lg:w-1/4 shrink-0">
          <div className="sticky top-24 bg-white dark:bg-gray-800 rounded-3xl p-4 lg:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="hidden lg:flex text-lg font-bold text-gray-900 dark:text-white mb-6 items-center gap-2">
              <Filter className="w-5 h-5 text-brand-gold" /> Kategoriler
            </h3>
            <div className="flex lg:flex-col gap-3 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide snap-x">
              <button 
                onClick={() => handleCategorySelect(null)}
                className={`snap-start shrink-0 lg:w-full text-left px-5 py-3 lg:px-4 rounded-xl transition-all duration-300 font-medium flex items-center justify-between group ${!selectedCat ? 'bg-brand-green text-white shadow-md' : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <Grid className={`w-5 h-5 ${!selectedCat ? 'text-brand-gold' : 'text-gray-400 group-hover:text-brand-gold'}`} />
                  <span className="whitespace-nowrap">Tüm Ürünler</span>
                </span>
                <span className={`inline-flex items-center justify-center text-xs px-2 py-0.5 rounded-full min-w-[24px] ${!selectedCat ? 'bg-white text-brand-green lg:bg-white/20 lg:text-white' : 'bg-brand-green/10 text-brand-green lg:bg-gray-100 dark:lg:bg-gray-700 lg:text-gray-500 dark:lg:text-gray-400 font-bold lg:font-normal'}`}>
                  {products.length}
                </span>
              </button>
              
              {categories.map(cat => {
                const count = products.filter(p => p.category === cat.name).length;
                const Icon = { Sun, Droplet, Mountain, Box, Fish, Cherry, Coffee, Gem }[cat.icon as any] || Star;
                return (
                  <button 
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.name)}
                    className={`snap-start shrink-0 lg:w-full text-left px-5 py-3 lg:px-4 rounded-xl transition-all duration-300 font-medium flex items-center justify-between gap-2 group ${selectedCat === cat.name ? 'bg-brand-green text-white shadow-md' : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                  >
                    <span className="flex items-center gap-3 whitespace-nowrap">
                      <Icon className={`w-5 h-5 ${selectedCat === cat.name ? 'text-brand-gold' : 'text-gray-400 group-hover:text-brand-gold'}`} />
                      <span className="whitespace-nowrap">{cat.name}</span>
                    </span>
                    <span className={`inline-flex items-center justify-center text-xs px-2 py-0.5 rounded-full min-w-[24px] ${selectedCat === cat.name ? 'bg-white text-brand-green' : 'bg-brand-green/10 text-brand-green lg:bg-gray-100 dark:lg:bg-gray-700 lg:text-gray-500 dark:lg:text-gray-400 font-bold lg:font-normal'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Products Area */}
        <div className="lg:w-3/4" ref={productsRef}>
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="text-gray-500 dark:text-gray-400 font-medium">
              <span className="text-brand-green dark:text-brand-gold font-bold">{filtered.length}</span> ürün listeleniyor
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Sırala:</span>
              <select 
                value={sortOption} 
                onChange={(e) => setSortOption(e.target.value)}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:border-brand-gold cursor-pointer"
              >
                <option value="featured">Önerilen</option>
                <option value="price-asc">En Düşük Fiyat</option>
                <option value="price-desc">En Yüksek Fiyat</option>
                <option value="rating">En Çok Değerlendirilen</option>
              </select>
            </div>
          </div>

          {/* Products Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-24 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 shadow-sm">
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-6" />
              <h3 className="text-2xl font-serif text-gray-900 dark:text-white mb-2">Ürün Bulunamadı</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">Bu kategoride henüz ürün bulunmuyor veya aradığınız kriterlere uygun ürün yok.</p>
              <button 
                onClick={() => setSelectedCat(null)} 
                className="bg-brand-green text-white px-6 py-3 rounded-xl font-bold hover:bg-green-800 transition-colors shadow-lg"
              >
                Tüm Ürünleri Göster
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
              {filtered.map(p => (
                <ProductCard 
                  key={p.id} 
                  product={p} 
                  onClick={() => onProductClick(p)}
                  onAddToCart={() => onAddToCart(p)}
                  onToggleFavorite={() => onToggleFavorite(p)}
                  isFavorite={favorites.includes(p.id)}
                  onShare={() => onShare(p)}
                  onGift={() => onGift(p)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { PRODUCTS, CATEGORIES, EVENTS, HEALTH_GUIDES, STATIC_CONTENT, HERO_CATEGORIES, CONTACT_INFO } from '../data';
import { RECIPES, HEALTH_ARTICLES, PRODUCT_HEALTH_INFO } from '../data/healthData';
import { auth, db } from '../firebase';
import { supabase } from '../lib/supabase';
import { buildCurrentUserFromSession, getAdminSessionStatus } from '../features/auth/api';
import { collection, doc, onSnapshot, query, where, getDocs, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Types
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice: number;
  category: string;
  tags: string[];
  reviews: number;
  rating: number;
  stock: number;
  image: string;
  gallery?: string[];
  story: string;
  features: string[];
  producer: string;
  origin?: string;
  unit?: string;
  weight?: number;
  weightOptions?: string[] | { label: string, price: number }[];
  cutOptions?: string[] | { label: string }[];
  preOrder?: boolean;
  preOrderTime?: string;
  pricePrefix?: string;
  categoryId?: string;
  video?: string;
  section?: string;
  homeSection?: string;
  vendor_id?: string | null;
  is_approved?: boolean;
  is_active?: boolean;
  is_rejected?: boolean;
  rejection_reason?: string | null;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  image: string;
  targetCategory?: string;
  is_active?: boolean;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  image: string;
}

export interface EventReservation {
  id: string;
  eventId: string;
  name: string;
  email: string;
  phone: string;
  guests: number;
  date: string;
}

export interface BlogPost {
  id: string;
  title: string;
  summary: string;
  content: string;
  image: string;
  date: string;
  category?: string;
}

export interface Order {
  id: string;
  customer: string;
  date: string;
  status: 'pending' | 'payment_pending_escrow' | 'shipped' | 'delivered' | 'completed' | 'cancelled';
  total: number;
  items: any[];
  returnStatus?: 'Requested' | 'Approved' | 'Rejected' | 'Completed';
  returnReason?: string;
  vendorId?: string;
  userId?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'vendor' | 'super_admin';
  status: 'active' | 'blocked';
  joinDate: string;
  vendor_id?: string | null;
}

export interface VendorApplication {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  store_name: string;
  phone: string;
  address: string;
  tax_info: string;
  bank_info: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  date: string;
  read: boolean;
  type: 'order' | 'system' | 'marketing';
}

export interface AppSettings {
  theme: 'light' | 'dark';
  siteName: string;
  logoUrl?: string;
  maintenanceMode: boolean;
}

export interface ProductHealthInfo {
  id: string;
  productId: string;
  title: string;
  content: string;
}

interface DataContextType {
  products: Product[];
  categories: Category[];
  events: Event[];
  eventReservations: EventReservation[];
  blogPosts: BlogPost[];
  recipes: BlogPost[];
  healthArticles: BlogPost[];
  productHealthInfo: ProductHealthInfo[];
  orders: Order[];
  users: User[];
  vendorApplications: VendorApplication[];
  notifications: Notification[];
  staticContent: typeof STATIC_CONTENT;
  contactInfo: typeof CONTACT_INFO;
  settings: AppSettings;
  heroCategories: any[];
  homeSections: any[];
  updateHeroCategories: (categories: any[]) => void;
  updateHomeSections: (sections: any[]) => void;
  
  // Actions
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, category: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  
  addEvent: (event: Omit<Event, 'id'>) => void;
  updateEvent: (id: string, event: Partial<Event>) => void;
  deleteEvent: (id: string) => void;
  addEventReservation: (reservation: Omit<EventReservation, 'id'>) => void;
  deleteEventReservation: (id: string) => void;

  addBlogPost: (post: Omit<BlogPost, 'id'>) => void;
  updateBlogPost: (id: string, post: Partial<BlogPost>) => void;
  deleteBlogPost: (id: string) => void;

  addRecipe: (post: Omit<BlogPost, 'id'>) => void;
  updateRecipe: (id: string, post: Partial<BlogPost>) => void;
  deleteRecipe: (id: string) => void;

  updateProductHealthInfo: (productId: string, info: Partial<ProductHealthInfo>) => void;

  updateOrder: (id: string, status: Order['status']) => void;
  requestReturn: (id: string, reason: string) => void;
  updateReturnStatus: (id: string, status: NonNullable<Order['returnStatus']>) => void;
  
  updateUserStatus: (id: string, status: User['status']) => void;
  updateUserRole: (id: string, role: User['role']) => void;
  deleteUser: (id: string) => void;

  updateVendorApplicationStatus: (id: string, userId: string, status: 'approved' | 'rejected') => void;

  addNotification: (notification: Omit<Notification, 'id' | 'date' | 'read'>) => void;
  markNotificationAsRead: (id: string) => void;

  updateStaticContent: (section: keyof typeof STATIC_CONTENT, content: any) => void;
  updateContactInfo: (info: typeof CONTACT_INFO) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  seedDatabase: () => Promise<void>;
  currentUser: any;
  setCurrentUser: (user: any) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode; initialCurrentUser?: any }> = ({ children, initialCurrentUser = null }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventReservations, setEventReservations] = useState<EventReservation[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [recipes, setRecipes] = useState<BlogPost[]>([]);
  const [healthArticles, setHealthArticles] = useState<BlogPost[]>([]);
  const [productHealthInfo, setProductHealthInfo] = useState<ProductHealthInfo[]>([]);
  const [heroCategories, setHeroCategories] = useState<any[]>(HERO_CATEGORIES);
  const [homeSections, setHomeSections] = useState<any[]>([
    { id: 'featured', title: 'En Çok Tercih Edilenler', active: true },
    { id: 'pre_order', title: 'Kişiye Özel Ön Siparişler', active: true },
    { id: 'natural', title: 'Doğal Seçimler', active: true },
    { id: 'seasonal', title: 'Mevsimin Hasadı', active: true },
    { id: 'best_sellers', title: 'En Çok Satanlar', active: true },
    { id: 'new_arrivals', title: 'Yeni Gelen Ürünler', active: true },
    { id: 'offers', title: 'Özel Fırsatlar', active: true }
  ]);
  const [staticContent, setStaticContent] = useState(STATIC_CONTENT);
  const [contactInfo, setContactInfo] = useState(CONTACT_INFO);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [vendorApplications, setVendorApplications] = useState<VendorApplication[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    siteName: 'Oremar',
    logoUrl: '',
    maintenanceMode: false,
  });
  const [currentUser, setCurrentUser] = useState<any>(initialCurrentUser);
  const [isAuthReady, setIsAuthReady] = useState(Boolean(initialCurrentUser));
  const [isPrivilegedAdminSession, setIsPrivilegedAdminSession] = useState(false);

  useEffect(() => {
    let active = true;
    let hydrationSequence = 0;

    const hydrateSession = async (session: any) => {
      const sequence = ++hydrationSequence;
      if (!session?.user) {
        if (active && sequence === hydrationSequence) {
          setCurrentUser(null);
          setIsAuthReady(true);
        }
        return;
      }
      try {
        const nextUser = await buildCurrentUserFromSession(session);
        if (active && sequence === hydrationSequence) setCurrentUser(nextUser);
      } catch (error) {
        console.error('Supabase session hydration failed', error);
        if (active && sequence === hydrationSequence) setCurrentUser(null);
      } finally {
        if (active && sequence === hydrationSequence) setIsAuthReady(true);
      }
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Supabase initial session failed', error);
        if (active) setIsAuthReady(true);
        return;
      }
      void hydrateSession(data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Run backend profile/role hydration after the auth callback returns.
      setTimeout(() => { void hydrateSession(session); }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!currentUser?.id) {
      setIsPrivilegedAdminSession(false);
      return () => { active = false; };
    }
    getAdminSessionStatus()
      .then(status => { if (active) setIsPrivilegedAdminSession(status.is_admin === true); })
      .catch(error => {
        console.error('Supabase privileged admin verification failed', error);
        if (active) setIsPrivilegedAdminSession(false);
      });
    return () => { active = false; };
  }, [currentUser?.id]);

  const isFirstLoadProducts = useRef(true);
  const isFirstLoadOrders = useRef(true);

  useEffect(() => {
    if (!isAuthReady) return;

    isFirstLoadProducts.current = true;
    isFirstLoadOrders.current = true;
    const legacyAdminContentMode = isPrivilegedAdminSession;

    // Listen to Products
    let unsubProducts = () => {};
    if (legacyAdminContentMode) {
    unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setRecipes(RECIPES);
      setHealthArticles(HEALTH_ARTICLES);
      const prods: Product[] = [];
      
      if (!isFirstLoadProducts.current && currentUser && (isPrivilegedAdminSession || currentUser.role === 'vendor')) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'modified') {
            const data = change.doc.data();
            if (data.stock <= 5 && data.stock > 0) {
              addNotification({
                userId: currentUser.uid,
                message: `${data.title} ürününün stoğu azaldı (${data.stock} adet kaldı).`,
                type: 'system'
              });
            } else if (data.stock === 0) {
              addNotification({
                userId: currentUser.uid,
                message: `${data.title} ürününün stoğu tamamen tükendi.`,
                type: 'system'
              });
            }
          }
        });
      }
      isFirstLoadProducts.current = false;

      snapshot.forEach(doc => {
        const data = doc.data();
        prods.push({
          id: doc.id,
          name: data.title,
          description: data.description,
          price: data.price,
          originalPrice: data.discount_price || data.price,
          category: data.category || data.categoryId || 'Diğer',
          tags: data.tags || [],
          reviews: data.reviews || 0,
          rating: data.rating || 0,
          stock: data.stock || 0,
          image: data.image,
          gallery: data.gallery || [],
          story: data.story || '',
          features: data.features || [],
          producer: data.producer || '',
          origin: data.origin || '',
          unit: data.unit || 'adet',
          weight: data.weight || 0,
          video: data.video || '',
          section: data.section || 'regular',
          homeSection: data.homeSection,
          vendor_id: data.vendorId || null,
          is_approved: data.is_approved,
          is_active: data.is_active,
          preOrder: data.preOrder || false,
          preOrderTime: data.preOrderTime || '',
          cutOptions: data.cutOptions || [],
          weightOptions: data.weightOptions || []
        });
      });
      if (prods.length > 0) {
        setProducts(prods);
      } else {
        const localFallback = PRODUCTS.map(p => ({
            id: String(p.id),
            name: p.name,
            description: p.description,
            price: p.price,
            originalPrice: p.price,
            category: p.category,
            tags: p.tags || [],
            reviews: p.reviews || 0,
            rating: p.rating || 5,
            stock: p.stock || 50,
            image: p.image,
            gallery: (p as any).gallery || [],
            story: (p as any).story || '',
            features: (p as any).features || [],
            producer: (p as any).producer || '',
            origin: (p as any).origin || '',
            unit: (p as any).unit || 'adet',
            weight: (p as any).weight || 0,
            video: (p as any).video || '',
            section: (p as any).section || 'regular',
            homeSection: (p as any).homeSection || '',
            vendor_id: 'admin',
            vendorId: 'admin',
            is_approved: true,
            is_active: true,
            preOrder: (p as any).preOrder || false,
            preOrderTime: (p as any).preOrderTime || '',
            cutOptions: (p as any).cutOptions || [],
            weightOptions: (p as any).weightOptions || []
        }));
        setProducts(localFallback as unknown as Product[]);
      }

      // Auto seed requires admin role, we won't run it here natively anymore 
      // Users can use "Veritabanını Sıfırla" in Admin menu instead.
      if (prods.length > 0 && (isPrivilegedAdminSession)) {
        const hasAddedV9 = localStorage.getItem('hasAddedMissingProducts_V9');
        if (!hasAddedV9) {
           localStorage.setItem('hasAddedMissingProducts_V9', 'true');
           const existingNames = prods.map(p => p.name);
           const missing = PRODUCTS.filter(p => !existingNames.includes(p.name));
           if (missing.length > 0) {
             missing.forEach(async (m) => {
               try {
                 await addDoc(collection(db, 'products'), {
                    ...m,
                    title: m.name,
                    categoryId: m.category,
                    vendorId: 'admin',
                    is_approved: true,
                    is_active: true,
                    createdAt: new Date().toISOString()
                 });
               } catch (e) {
                 console.error("Error adding missing product automatically", e);
               }
             });
           }
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    }

    // Listen to Categories
    let unsubCategories = () => {};
    if (legacyAdminContentMode) {
    unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const cats: Category[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        cats.push({
          id: doc.id,
          name: data.name,
          description: data.description,
          image: data.image,
          icon: data.icon,
          targetCategory: data.targetCategory,
          is_active: data.is_active
        });
      });
      setCategories(cats);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'categories');
    });

    }

    // Listen to Orders based on role
    let unsubOrders = () => {};
    if (legacyAdminContentMode) {
      let q = query(collection(db, 'orders'));
      if (currentUser.role === 'user') {
        q = query(collection(db, 'orders'), where('userId', '==', currentUser.uid));
      } else if (currentUser.role === 'vendor') {
        q = query(collection(db, 'orders'), where('vendorId', '==', currentUser.uid));
      }
      
      unsubOrders = onSnapshot(q, (snapshot) => {
        const ords: Order[] = [];
        
        if (!isFirstLoadOrders.current && currentUser && (isPrivilegedAdminSession || currentUser.role === 'vendor')) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              addNotification({
                userId: currentUser.uid,
                message: `Yeni bir sipariş alındı. Tutar: ${data.totalPrice} ₺`,
                type: 'order'
              });
            }
          });
        }
        isFirstLoadOrders.current = false;

        snapshot.forEach(doc => {
          const data = doc.data();
          ords.push({
            id: doc.id,
            customer: data.userId, // Ideally fetch user name
            date: data.createdAt,
            status: data.status,
            total: data.totalPrice,
            items: data.items || [],
            vendorId: data.vendorId,
            userId: data.userId
          });
        });
        setOrders(ords);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'orders');
      });
    }

    // Listen to Users if admin
    let unsubUsers = () => {};
    let unsubVendorApps = () => {};
    if (currentUser) {
      if (isPrivilegedAdminSession) {
        unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
          const usrs: User[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            usrs.push({
              id: doc.id,
              name: data.name,
              email: data.email,
              role: data.role,
              status: data.status || 'active',
              joinDate: data.createdAt
            });
          });
          setUsers(usrs);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'users');
        });

        unsubVendorApps = onSnapshot(collection(db, 'vendor_applications'), (snapshot) => {
          const apps: VendorApplication[] = [];
          snapshot.forEach(doc => {
            apps.push({ id: doc.id, ...doc.data() } as VendorApplication);
          });
          setVendorApplications(apps);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'vendor_applications');
        });
      } else {
        const q = query(collection(db, 'vendor_applications'), where('userId', '==', currentUser.uid));
        unsubVendorApps = onSnapshot(q, (snapshot) => {
          const apps: VendorApplication[] = [];
          snapshot.forEach(doc => {
            apps.push({ id: doc.id, ...doc.data() } as VendorApplication);
          });
          setVendorApplications(apps);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'vendor_applications(user)');
        });
      }
    }

    // Listen to Notifications
    let unsubNotifications = () => {};
    if (currentUser) {
      const q = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid));
      unsubNotifications = onSnapshot(q, (snapshot) => {
        const notifs: Notification[] = [];
        snapshot.forEach(doc => {
          notifs.push({ id: doc.id, ...doc.data() } as Notification);
        });
        

        // Sort by date descending
        notifs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setNotifications(notifs);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'notifications');
      });
    }

    // Listen to Recipes
    let unsubRecipes = () => {};
    if (legacyAdminContentMode) {
    unsubRecipes = onSnapshot(collection(db, 'recipes'), (snapshot) => {
      const recs: BlogPost[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        recs.push({ id: doc.id, ...data } as BlogPost);
      });
      if (recs.length > 0) setRecipes(recs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'recipes');
    });

    }

    // Listen to Blog Posts
    let unsubBlogPosts = () => {};
    if (legacyAdminContentMode) {
    unsubBlogPosts = onSnapshot(collection(db, 'blogPosts'), (snapshot) => {
      const posts: BlogPost[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        posts.push({ id: doc.id, ...data } as BlogPost);
      });
      if (posts.length > 0) setBlogPosts(posts);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'blogPosts');
    });

    }

    // Listen to Product Health Info
    let unsubProductHealthInfo = () => {};
    if (legacyAdminContentMode) {
    unsubProductHealthInfo = onSnapshot(collection(db, 'productHealthInfo'), (snapshot) => {
      const infos: ProductHealthInfo[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        infos.push({ id: doc.id, ...data } as ProductHealthInfo);
      });
      if (infos.length > 0) setProductHealthInfo(infos);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'productHealthInfo');
    });

    }

    // Listen to Events
    let unsubEvents = () => {};
    if (legacyAdminContentMode) {
    unsubEvents = onSnapshot(collection(db, 'events'), (snapshot) => {
      const evts: Event[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        evts.push({ id: doc.id, ...data } as Event);
      });
      setEvents(evts);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'events');
    });

    }

    // Listen to Static Content
    let unsubStaticContent = () => {};
    if (legacyAdminContentMode) {
    unsubStaticContent = onSnapshot(doc(db, 'settings', 'staticContent'), (docSnap) => {
      if (docSnap.exists()) {
        setStaticContent(docSnap.data() as typeof STATIC_CONTENT);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/staticContent');
    });

    }

    let unsubHeroCategories = () => {};
    if (legacyAdminContentMode) {
    unsubHeroCategories = onSnapshot(doc(db, 'settings', 'heroCategories'), (docSnap) => {
      if (docSnap.exists()) {
        setHeroCategories(docSnap.data().items || []);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/heroCategories');
    });

    }

    let unsubHomeSections = () => {};
    if (legacyAdminContentMode) {
    unsubHomeSections = onSnapshot(doc(db, 'settings', 'homeSections'), (docSnap) => {
      if (docSnap.exists()) {
        setHomeSections(docSnap.data().items || []);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/homeSections');
    });

    }

    // Listen to Contact Info
    let unsubContactInfo = () => {};
    if (legacyAdminContentMode) {
    unsubContactInfo = onSnapshot(doc(db, 'settings', 'contactInfo'), (docSnap) => {
      if (docSnap.exists()) {
        setContactInfo(docSnap.data() as typeof CONTACT_INFO);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/contactInfo');
    });

    }

    // Listen to General Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(prev => ({ ...prev, ...docSnap.data() as Partial<AppSettings> }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/general');
    });

    return () => {
      unsubProducts();
      unsubCategories();
      unsubOrders();
      unsubUsers();
      unsubVendorApps();
      unsubNotifications();
      unsubRecipes();
      unsubBlogPosts();
      unsubProductHealthInfo();
      unsubEvents();
      unsubStaticContent();
      unsubHeroCategories();
      unsubHomeSections();
      unsubContactInfo();
      unsubSettings();
    };
  }, [isAuthReady, currentUser, isPrivilegedAdminSession]);

  // Actions
  const addProduct = async (product: Omit<Product, 'id'>) => {
    try {
      const isApproved = isPrivilegedAdminSession;
      await addDoc(collection(db, 'products'), {
        ...product,
        title: product.name,
        categoryId: product.category,
        vendorId: currentUser?.id,
        vendor_id: currentUser?.id,
        is_approved: isApproved,
        is_active: true,
        createdAt: new Date().toISOString()
      });

      if (!isApproved) {
         try {
            const adminQuery = query(collection(db, 'users'), where('role', 'in', ['admin', 'super_admin']));
            const adminDocs = await getDocs(adminQuery);
            adminDocs.forEach(adminDoc => {
               addNotification({
                  userId: adminDoc.id,
                  message: `Yeni Ürün Onayı: Bir satıcı (${currentUser?.name || 'Bilinmeyen'}) "${product.name}" adlı ürünü onaya gönderdi.`,
                  type: 'system'
               });
            });
         } catch (notifyErr) {
            console.error("Error notifying admins:", notifyErr);
         }
      }
    } catch (e) {
      console.error("Error adding product", e);
    }
  };

  const updateProduct = async (id: string, product: Partial<Product>) => {
    try {
      const mappedUpdate: any = { ...product };
      if (product.name) mappedUpdate.title = product.name;
      if (product.category) mappedUpdate.categoryId = product.category;
      await updateDoc(doc(db, 'products', id), mappedUpdate);

      // Low stock notification
      if (product.stock !== undefined && product.stock <= 10) {
        const existingProduct = products.find(p => p.id === id);
        if (existingProduct) {
          const vendorId = existingProduct.vendor_id || 'admin';
          
          if (vendorId !== 'admin') {
            addNotification({
              userId: vendorId,
              message: `Kritik Stok Uyarısı: ${existingProduct.name} ürününden sadece ${product.stock} adet kaldı.`,
              type: 'system'
            });
          }

          // Notify admins if we have permission to fetch them
          if (currentUser && isPrivilegedAdminSession) {
            try {
              const adminQuery = query(collection(db, 'users'), where('role', 'in', ['admin', 'super_admin']));
              const adminDocs = await getDocs(adminQuery);
              adminDocs.forEach(adminDoc => {
                addNotification({
                  userId: adminDoc.id,
                  message: `Kritik Stok Uyarısı: ${existingProduct.name} ürününden sadece ${product.stock} adet kaldı.`,
                  type: 'system'
                });
              });
            } catch (err) {
              console.error("Failed to notify admins:", err);
            }
          }
        }
      }
    } catch (e) {
      console.error("Error updating product", e);
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (e) {
      console.error("Error deleting product", e);
    }
  };

  const addCategory = async (category: Omit<Category, 'id'>) => {
    try {
      await addDoc(collection(db, 'categories'), {
        ...category,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error adding category", e);
    }
  };

  const updateCategory = async (id: string, category: Partial<Category>) => {
    try {
      await updateDoc(doc(db, 'categories', id), category);
    } catch (e) {
      console.error("Error updating category", e);
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (e) {
      console.error("Error deleting category", e);
    }
  };

  async function seedDatabase() {
    try {
      console.log("Seeding database...");
      
      // Clear existing products
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const deletePromises = productsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      
      const categoriesSnapshot = await getDocs(collection(db, 'categories'));
      const deleteCategoriesPromises = categoriesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      
      const recipesSnapshot = await getDocs(collection(db, 'recipes'));
      const deleteRecipesPromises = recipesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      
      const blogSnapshot = await getDocs(collection(db, 'blogPosts'));
      const deleteBlogPromises = blogSnapshot.docs.map(doc => deleteDoc(doc.ref));

      const healthInfoSnapshot = await getDocs(collection(db, 'productHealthInfo'));
      const deleteHealthInfoPromises = healthInfoSnapshot.docs.map(doc => deleteDoc(doc.ref));

      await Promise.all([
        ...deletePromises, 
        ...deleteCategoriesPromises, 
        ...deleteRecipesPromises, 
        ...deleteBlogPromises,
        ...deleteHealthInfoPromises
      ]);
      console.log(`Deleted existing data.`);
      
      // Seed products
      for (const p of PRODUCTS) {
        await addDoc(collection(db, 'products'), {
          title: p.name,
          description: p.description,
          price: p.price,
          stock: p.stock || 50,
          is_approved: true,
          is_active: true,
          createdAt: new Date().toISOString(),
          discount_price: (p as any).originalPrice || p.price,
          categoryId: p.category || 'Belirtilmemiş',
          tags: p.tags || [],
          reviews: p.reviews || 0,
          rating: p.rating || 5,
          image: p.image || '',
          gallery: (p as any).gallery || [],
          story: (p as any).story || '',
          features: (p as any).features || [],
          producer: (p as any).producer || '',
          origin: (p as any).origin || '',
          unit: (p as any).unit || 'adet',
          weight: (p as any).weight || 0,
          video: (p as any).video || '',
          section: (p as any).section || 'regular',
          homeSection: (p as any).homeSection || '',
          preOrder: (p as any).preOrder || false,
          preOrderTime: (p as any).preOrderTime || '',
          cutOptions: (p as any).cutOptions || [],
          weightOptions: (p as any).weightOptions || [],
          vendorId: currentUser?.uid || 'admin'
        });
      }
      
      // Seed categories
      for (const c of CATEGORIES) {
        await addDoc(collection(db, 'categories'), {
          name: c.name,
          description: c.description,
          icon: c.icon,
          image: c.image,
          targetCategory: (c as any).targetCategory || '',
          is_active: true,
          createdAt: new Date().toISOString()
        });
      }
      
      // Seed recipes
      for (const r of RECIPES) {
        await addDoc(collection(db, 'recipes'), { ...r, createdAt: new Date().toISOString() });
      }
      
      // Seed health articles
      for (const h of HEALTH_ARTICLES) {
        await addDoc(collection(db, 'blogPosts'), { ...h, createdAt: new Date().toISOString() });
      }
      
      // Seed product health info
      for (const phi of PRODUCT_HEALTH_INFO) {
        await addDoc(collection(db, 'productHealthInfo'), { ...phi, createdAt: new Date().toISOString() });
      }
      
      // Seed static content
      await setDoc(doc(db, 'settings', 'staticContent'), STATIC_CONTENT);
      
      // Seed contact info
      await setDoc(doc(db, 'settings', 'contactInfo'), CONTACT_INFO);
      
      // Seed events
      for (const e of EVENTS) {
        await addDoc(collection(db, 'events'), { ...e, createdAt: new Date().toISOString() });
      }
      
      console.log("Database seeded successfully!");
    } catch (error) {
      console.error("Error seeding database:", error);
    }
  };

  const addEvent = async (event: Omit<Event, 'id'>) => {
    try {
      await addDoc(collection(db, 'events'), { ...event, createdAt: serverTimestamp() });
    } catch (e) {
      console.error("Error adding event", e);
    }
  };
  
  const updateEvent = async (id: string, event: Partial<Event>) => {
    try {
      await updateDoc(doc(db, 'events', id), event);
    } catch (e) {
      console.error("Error updating event", e);
    }
  };
  
  const deleteEvent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'events', id));
    } catch (e) {
      console.error("Error deleting event", e);
    }
  };
  const addEventReservation = async (reservation: Omit<EventReservation, 'id'>) => {
    try {
      await addDoc(collection(db, 'event_reservations'), { ...reservation, createdAt: serverTimestamp() });
    } catch (e) {
      console.error("Error adding event reservation", e);
    }
  };
  const deleteEventReservation = async (id: string) => {};
  const addBlogPost = async (post: Omit<BlogPost, 'id'>) => {
    try {
      await addDoc(collection(db, 'blogPosts'), { ...post, createdAt: serverTimestamp() });
    } catch (e) {
      console.error("Error adding blog post", e);
    }
  };

  const updateBlogPost = async (id: string, post: Partial<BlogPost>) => {
    try {
      await updateDoc(doc(db, 'blogPosts', id), post);
    } catch (e) {
      console.error("Error updating blog post", e);
    }
  };

  const deleteBlogPost = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'blogPosts', id));
    } catch (e) {
      console.error("Error deleting blog post", e);
    }
  };

  const addRecipe = async (post: Omit<BlogPost, 'id'>) => {
    try {
      await addDoc(collection(db, 'recipes'), { ...post, createdAt: serverTimestamp() });
    } catch (e) {
      console.error("Error adding recipe", e);
    }
  };

  const updateRecipe = async (id: string, post: Partial<BlogPost>) => {
    try {
      await updateDoc(doc(db, 'recipes', id), post);
    } catch (e) {
      console.error("Error updating recipe", e);
    }
  };

  const deleteRecipe = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'recipes', id));
    } catch (e) {
      console.error("Error deleting recipe", e);
    }
  };

  const updateProductHealthInfo = async (productId: string, info: Partial<ProductHealthInfo>) => {
    try {
      const q = query(collection(db, 'productHealthInfo'), where('productId', '==', productId));
      const snaps = await getDocs(q);
      if (!snaps.empty) {
        await updateDoc(doc(db, 'productHealthInfo', snaps.docs[0].id), info);
      } else {
        await addDoc(collection(db, 'productHealthInfo'), { ...info, productId, createdAt: serverTimestamp() });
      }
    } catch (e) {
      console.error("Error updating product health info", e);
    }
  };

  const updateOrder = async (id: string, status: Order['status'], trackingNumber?: string) => {
    try {
      const updateData: any = { status };
      if (trackingNumber) updateData.trackingNumber = trackingNumber;
      await updateDoc(doc(db, 'orders', id), updateData);
    } catch (e) {
      console.error("Error updating order", e);
    }
  };

    const requestReturn = async (id: string, reason: string) => {
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
          subject: `Yeni İade Talebi: Sipariş #${id}`,
          html: `<p>Sipariş #${id} için iade talebi oluşturuldu.</p><p>Sebep: ${reason}</p>`
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
  };
  
  const updateUserStatus = async (id: string, status: User['status']) => {
    try {
      await updateDoc(doc(db, 'users', id), { status });
    } catch (e) {
      console.error("Error updating user status", e);
    }
  };

  const updateUserRole = async (id: string, role: User['role']) => {
    try {
      await updateDoc(doc(db, 'users', id), { role });
    } catch (e) {
      console.error("Error updating user role", e);
    }
  };

  const deleteUser = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (e) {
      console.error("Error deleting user", e);
    }
  };

  const updateVendorApplicationStatus = async (id: string, userId: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'vendor_applications', id), { status });
      if (status === 'approved') {
        await updateDoc(doc(db, 'users', userId), { role: 'vendor' });
        
        // Find the application details to create the vendor profile
        const app = vendorApplications.find(a => a.id === id);
        if (app) {
          await setDoc(doc(db, 'vendors', userId), {
            userId: app.userId,
            fullName: app.userName,
            email: app.userEmail,
            storeName: app.store_name,
            phone: app.phone,
            address: app.address,
            tcNo: app.tax_info,
            bank_info: app.bank_info,
            documentUrl: (app as any).documentUrl || null,
            idUrl: (app as any).idUrl || null,
            status: 'active',
            is_active: true,
            commission_rate: 10,
            is_verified: true,
            balance: 0,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      console.error("Error updating vendor application", e);
    }
  };

  const addNotification = async (notification: Omit<Notification, 'id' | 'date' | 'read'>) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notification,
        date: new Date().toISOString(),
        read: false
      });
    } catch (e) {
      console.error("Error adding notification", e);
    }
  };

  const markNotificationAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) {
      console.error("Error marking notification as read", e);
    }
  };

  const updateStaticContent = async (section: keyof typeof STATIC_CONTENT, content: any) => {
    try {
      await updateDoc(doc(db, 'settings', 'staticContent'), {
        [section]: content
      });
    } catch (e) {
      console.error("Error updating static content", e);
    }
  };

  const updateContactInfo = async (info: typeof CONTACT_INFO) => {
    try {
      await setDoc(doc(db, 'settings', 'contactInfo'), info);
    } catch (e) {
      console.error("Error updating contact info", e);
    }
  };

  const updateHeroCategories = async (categories: any[]) => {
    try {
      await setDoc(doc(db, 'settings', 'heroCategories'), { items: categories });
    } catch (e) {
      console.error("Error updating hero categories", e);
    }
  };

  const updateHomeSections = async (sections: any[]) => {
    try {
      await setDoc(doc(db, 'settings', 'homeSections'), { items: sections });
    } catch (e) {
      console.error("Error updating home sections", e);
    }
  };
  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      setSettings(prev => ({ ...prev, ...newSettings }));
      await setDoc(doc(db, 'settings', 'general'), newSettings, { merge: true });
    } catch (e) {
      console.error("Error updating settings", e);
    }
  };

  return (
    <DataContext.Provider value={{
      products, categories, events, eventReservations, blogPosts, recipes, healthArticles, productHealthInfo,
      orders, users, notifications, staticContent, contactInfo, settings, vendorApplications,
      addCategory, updateCategory, deleteCategory,
      addProduct, updateProduct, deleteProduct,
      addEvent, updateEvent, deleteEvent, addEventReservation, deleteEventReservation,
      addBlogPost, updateBlogPost, deleteBlogPost,
      addRecipe, updateRecipe, deleteRecipe,
      updateProductHealthInfo,
      updateOrder, requestReturn, updateReturnStatus,
      updateUserStatus, updateUserRole, deleteUser,
      updateVendorApplicationStatus,
      addNotification, markNotificationAsRead,
      updateStaticContent, updateContactInfo, updateSettings, seedDatabase,
      heroCategories, updateHeroCategories,
      homeSections, updateHomeSections,
      currentUser, setCurrentUser
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

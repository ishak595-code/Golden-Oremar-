import Database from 'better-sqlite3';
import { join } from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const dbPath = join(process.cwd(), 'database.sqlite');
console.log('Initializing database at:', dbPath);
const db = new Database(dbPath);
console.log('Database initialized successfully');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'user', -- 'user', 'vendor', 'admin', 'superadmin'
    status TEXT DEFAULT 'active',
    two_factor_secret TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    store_name TEXT NOT NULL,
    description TEXT,
    phone TEXT,
    address TEXT,
    location TEXT, -- Production location
    tc_no TEXT,
    iban TEXT,
    document_url TEXT, -- ÇKS or ID document
    commission_rate REAL DEFAULT 10,
    is_verified BOOLEAN DEFAULT 0, -- Admin approval
    status TEXT DEFAULT 'pending', -- 'pending', 'active', 'rejected'
    rating REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL, -- 'Home', 'Work'
    city TEXT NOT NULL,
    district TEXT NOT NULL,
    address TEXT NOT NULL,
    postal_code TEXT,
    is_default BOOLEAN DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    image TEXT,
    is_active BOOLEAN DEFAULT 1,
    order_index INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    discount_price REAL,
    stock INTEGER DEFAULT 0,
    category_id INTEGER,
    vendor_id INTEGER,
    image TEXT,
    gallery TEXT,
    rating REAL DEFAULT 0,
    reviews INTEGER DEFAULT 0,
    unit TEXT,
    tags TEXT,
    section TEXT,
    features TEXT,
    producer TEXT,
    origin TEXT,
    weight REAL,
    organic_cert TEXT,
    shipping_info TEXT,
    video TEXT,
    story TEXT,
    is_approved BOOLEAN DEFAULT 0, -- Admin approval
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id),
    FOREIGN KEY(vendor_id) REFERENCES vendors(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_price REAL NOT NULL,
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'escrow', 'released', 'refunded'
    order_status TEXT DEFAULT 'pending', -- 'pending', 'preparing', 'shipped', 'delivered', 'completed', 'cancelled'
    address_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(address_id) REFERENCES addresses(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    vendor_id INTEGER,
    status TEXT DEFAULT 'pending', -- For individual item tracking
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(vendor_id) REFERENCES vendors(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    user_id INTEGER,
    vendor_id INTEGER,
    amount REAL NOT NULL,
    type TEXT NOT NULL, -- 'payment', 'payout', 'refund', 'commission'
    status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(vendor_id) REFERENCES vendors(id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    banner TEXT,
    discount_type TEXT, -- 'percentage', 'fixed'
    discount_value REAL,
    target_type TEXT, -- 'product', 'category', 'all'
    target_id INTEGER,
    start_date DATETIME,
    end_date DATETIME,
    is_active BOOLEAN DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, -- null means all users
    target_role TEXT, -- 'user', 'vendor', 'admin', null means all
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT, -- 'new_product', 'campaign', 'announcement'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Add missing columns if they don't exist
try { db.prepare('ALTER TABLE vendors ADD COLUMN bank_info TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE vendors ADD COLUMN tax_info TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE vendors ADD COLUMN status TEXT DEFAULT "active"').run(); } catch (e) {}
try { db.prepare('ALTER TABLE vendors ADD COLUMN description TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE vendors ADD COLUMN commission_rate REAL DEFAULT 10').run(); } catch (e) {}

// Seed initial data if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  // Admin user
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run('Admin', 'admin@oremar.com', hash, 'admin');

  // Categories
  const categories = [
    { name: 'Bal & Arı Ürünleri', icon: 'Sun' },
    { name: 'Süt & Süt Ürünleri', icon: 'Droplet' },
    { name: 'Dağ Mahsulleri', icon: 'Mountain' },
    { name: 'Özel Paketler', icon: 'Box' }
  ];
  const insertCat = db.prepare('INSERT INTO categories (name, icon, order_index) VALUES (?, ?, ?)');
  categories.forEach((c, i) => insertCat.run(c.name, c.icon, i));

  // Products
  const products = [
    {
      title: "Yüksek Rakım Karakovan Balı",
      description: "Hakkari'nin 2500 rakımlı yaylalarından, tamamen doğal yöntemlerle elde edilmiş katkısız karakovan balı.",
      price: 1250,
      stock: 15,
      category_id: 1,
      image: "https://images.unsplash.com/photo-1587049352847-4d4b137a504a?q=80&w=800&auto=format&fit=crop",
      rating: 4.9,
      reviews: 128,
      unit: "1 kg",
      tags: JSON.stringify(["Yeni Hasat", "Sınırlı Üretim"]),
      section: "featured"
    },
    {
      title: "Geleneksel Şemdinli Balı",
      description: "Yüzlerce çeşit dağ çiçeğinden elde edilen, şifa kaynağı süzme çiçek balı.",
      price: 850,
      stock: 45,
      category_id: 1,
      image: "https://images.unsplash.com/photo-1587049352851-8d4e89134782?q=80&w=800&auto=format&fit=crop",
      rating: 4.8,
      reviews: 95,
      unit: "1 kg",
      tags: JSON.stringify(["Çok Satan"]),
      section: "featured"
    },
    {
      title: "Hakiki Dağ Kekiği",
      description: "Yüksek yaylalardan elle toplanmış, güneşte kurutulmuş aromatik dağ kekiği.",
      price: 120,
      stock: 100,
      category_id: 3,
      image: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?q=80&w=800&auto=format&fit=crop",
      rating: 4.7,
      reviews: 42,
      unit: "100 gr",
      tags: JSON.stringify(["Doğal"]),
      section: "seasonal"
    },
    {
      title: "Doğal Petek Balı",
      description: "Arıların kendi ördüğü peteklerde, hiçbir müdahale olmadan üretilen saf petek balı.",
      price: 950,
      stock: 25,
      category_id: 1,
      image: "https://images.unsplash.com/photo-1550081699-7872d31268f4?q=80&w=800&auto=format&fit=crop",
      rating: 4.9,
      reviews: 67,
      unit: "1 kg",
      tags: JSON.stringify(["Premium"]),
      section: "featured"
    },
    {
      title: "Organik Ceviz İçi",
      description: "Hakkari'nin yerel ceviz ağaçlarından, yeni mahsul, iri ve lezzetli ceviz içi.",
      price: 350,
      stock: 60,
      category_id: 3,
      image: "https://images.unsplash.com/photo-1599598425947-330026294a53?q=80&w=800&auto=format&fit=crop",
      rating: 4.8,
      reviews: 112,
      unit: "500 gr",
      tags: JSON.stringify(["Yeni Hasat"]),
      section: "seasonal"
    }
  ];

  const insertProd = db.prepare('INSERT INTO products (title, description, price, stock, category_id, image, rating, reviews, unit, tags, section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  products.forEach(p => insertProd.run(p.title, p.description, p.price, p.stock, p.category_id, p.image, p.rating, p.reviews, p.unit, p.tags, p.section));
}

export default db;

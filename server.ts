import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import db from './server/db.ts';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

let stripeClient: Stripe | null = null;

function getStripe(): Stripe | null {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      return null;
    }
    stripeClient = new Stripe(key, {
      apiVersion: '2026-02-25.clover',
    });
  }
  return stripeClient;
}

app.use(cors());
app.use(express.json());

// --- API ROUTES ---

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(decoded.id) as any;
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = { ...decoded, role: user.role };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const isAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
};

// Auth Routes
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, phone } = req.body;
  const lowerEmail = email.toLowerCase();
  try {
    const hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (name, email, password, phone) VALUES (?, ?, ?, ?)');
    const info = stmt.run(name, lowerEmail, hash, phone);
    const token = jwt.sign({ id: info.lastInsertRowid, email: lowerEmail, role: 'user' }, JWT_SECRET);
    res.json({ token, user: { id: info.lastInsertRowid, name, email: lowerEmail, role: 'user' } });
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const lowerEmail = email.toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(lowerEmail) as any;
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
  const responseUser: any = { id: user.id, name: user.name, email: user.email, role: user.role };
  if (user.role === 'vendor') {
    const vendor = db.prepare('SELECT id FROM vendors WHERE user_id = ?').get(user.id) as any;
    responseUser.vendor_id = vendor ? vendor.id : null;
  }
  res.json({ token, user: responseUser });
});

app.get('/api/auth/me', authenticate, (req: any, res) => {
  const user = db.prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?').get(req.user.id) as any;
  if (user && user.role === 'vendor') {
    const vendor = db.prepare('SELECT id FROM vendors WHERE user_id = ?').get(user.id) as any;
    user.vendor_id = vendor ? vendor.id : null;
  }
  res.json(user);
});

// Public Data Routes
app.get('/api/products', (req: any, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category, v.store_name as vendor_name, v.location as vendor_location
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE p.is_approved = 1 AND p.is_active = 1
  `).all();
  
  const formatted = products.map((p: any) => ({
    ...p,
    tags: p.tags ? JSON.parse(p.tags) : [],
    gallery: p.gallery ? JSON.parse(p.gallery) : [],
    features: p.features ? JSON.parse(p.features) : []
  }));
  res.json(formatted);
});

app.get('/api/products/:id', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name as category, v.store_name as vendor_name, v.location as vendor_location, v.description as vendor_description, v.rating as vendor_rating
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE p.id = ?
  `).get(req.params.id) as any;

  if (!product) return res.status(404).json({ error: 'Product not found' });

  const formatted = {
    ...product,
    tags: product.tags ? JSON.parse(product.tags) : [],
    gallery: product.gallery ? JSON.parse(product.gallery) : []
  };
  res.json(formatted);
});

app.get('/api/vendors/:id', (req, res) => {
  const vendor = db.prepare('SELECT id, store_name, description, location, rating, created_at FROM vendors WHERE id = ? AND is_verified = 1').get(req.params.id) as any;
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

  const products = db.prepare('SELECT * FROM products WHERE vendor_id = ? AND is_approved = 1 AND is_active = 1').all(vendor.id);
  res.json({ ...vendor, products });
});

app.get('/api/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY order_index').all();
  res.json(categories);
});

// Cart Routes
app.get('/api/cart', authenticate, (req: any, res) => {
  const items = db.prepare(`
    SELECT c.id, c.quantity, p.* 
    FROM cart c 
    JOIN products p ON c.product_id = p.id 
    WHERE c.user_id = ?
  `).all(req.user.id);
  res.json(items);
});

app.post('/api/cart', authenticate, (req: any, res) => {
  const { product_id, quantity } = req.body;
  const existing = db.prepare('SELECT * FROM cart WHERE user_id = ? AND product_id = ?').get(req.user.id, product_id) as any;
  
  if (existing) {
    db.prepare('UPDATE cart SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
  } else {
    db.prepare('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)').run(req.user.id, product_id, quantity);
  }
  res.json({ success: true });
});

app.put('/api/cart/:id', authenticate, (req: any, res) => {
  const { quantity } = req.body;
  db.prepare('UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?').run(quantity, req.params.id, req.user.id);
  res.json({ success: true });
});

app.delete('/api/cart/:id', authenticate, (req: any, res) => {
  db.prepare('DELETE FROM cart WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// Favorites Routes
app.get('/api/favorites', authenticate, (req: any, res) => {
  const items = db.prepare('SELECT product_id FROM favorites WHERE user_id = ?').all(req.user.id);
  res.json(items.map((i: any) => i.product_id));
});

app.post('/api/favorites', authenticate, (req: any, res) => {
  const { product_id } = req.body;
  const existing = db.prepare('SELECT * FROM favorites WHERE user_id = ? AND product_id = ?').get(req.user.id, product_id);
  
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?').run(req.user.id, product_id);
    res.json({ status: 'removed' });
  } else {
    db.prepare('INSERT INTO favorites (user_id, product_id) VALUES (?, ?)').run(req.user.id, product_id);
    res.json({ status: 'added' });
  }
});

// Address Routes
app.get('/api/addresses', authenticate, (req: any, res) => {
  const addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ?').all(req.user.id);
  res.json(addresses);
});

app.post('/api/addresses', authenticate, (req: any, res) => {
  const { city, district, address, postal_code } = req.body;
  const info = db.prepare('INSERT INTO addresses (user_id, city, district, address, postal_code) VALUES (?, ?, ?, ?, ?)').run(req.user.id, city, district, address, postal_code);
  res.json({ id: info.lastInsertRowid });
});

// Checkout & Orders
app.post('/api/checkout', authenticate, async (req: any, res) => {
  try {
    const { address_id, payment_method } = req.body;
    
    const cartItems = db.prepare(`
      SELECT c.quantity, p.id, p.title, p.price, p.vendor_id 
      FROM cart c 
      JOIN products p ON c.product_id = p.id 
      WHERE c.user_id = ?
    `).all(req.user.id) as any[];

    if (cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    let validAddressId = null;
    if (address_id) {
      const addressExists = db.prepare('SELECT id FROM addresses WHERE id = ? AND user_id = ?').get(address_id, req.user.id);
      if (addressExists) validAddressId = address_id;
    }

    // Create order with 'escrow' payment status
    const info = db.prepare('INSERT INTO orders (user_id, total_price, address_id, payment_status) VALUES (?, ?, ?, "escrow")').run(req.user.id, total, validAddressId);
    const orderId = info.lastInsertRowid;

    const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price, vendor_id) VALUES (?, ?, ?, ?, ?)');
    cartItems.forEach(item => {
      insertItem.run(orderId, item.id, item.quantity, item.price, item.vendor_id);
    });

    // Create transaction record
    db.prepare('INSERT INTO transactions (order_id, user_id, amount, type, status) VALUES (?, ?, ?, "payment", "completed")').run(orderId, req.user.id, total);

    db.prepare('DELETE FROM cart WHERE user_id = ?').run(req.user.id);

    res.json({ success: true, orderId });
  } catch (err: any) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/:id/complete', authenticate, (req: any, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.order_status !== 'delivered') return res.status(400).json({ error: 'Order must be delivered first' });

  db.prepare('UPDATE orders SET order_status = "completed", payment_status = "released" WHERE id = ?').run(req.params.id);
  
  // Payout logic: Create payout transactions for vendors
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id) as any[];
  items.forEach(item => {
    const vendor = db.prepare('SELECT commission_rate FROM vendors WHERE id = ?').get(item.vendor_id) as any;
    const commissionRate = vendor ? vendor.commission_rate : 10;
    const commission = (item.price * item.quantity) * (commissionRate / 100);
    const payout = (item.price * item.quantity) - commission;

    db.prepare('INSERT INTO transactions (order_id, vendor_id, amount, type, status) VALUES (?, ?, ?, "payout", "completed")').run(req.params.id, item.vendor_id, payout);
    db.prepare('INSERT INTO transactions (order_id, vendor_id, amount, type, status) VALUES (?, ?, ?, "commission", "completed")').run(req.params.id, item.vendor_id, commission);
  });

  res.json({ success: true });
});

app.get('/api/orders', authenticate, (req: any, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(orders);
});

// Admin Routes
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  const lowerEmail = email.toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? AND (role = \'admin\' OR role = \'superadmin\' OR role = \'vendor\')').get(lowerEmail) as any;
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials or unauthorized' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

const isVendorOrAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin' && req.user?.role !== 'vendor') return res.status(403).json({ error: 'Forbidden' });
  next();
};

app.get('/api/admin/dashboard', authenticate, isVendorOrAdmin, (req: any, res) => {
  const isVendor = req.user.role === 'vendor';
  let vendorFilter = '';
  let vendorParams: any[] = [];
  
  if (isVendor) {
    const vendor = db.prepare('SELECT id FROM vendors WHERE user_id = ?').get(req.user.id) as any;
    if (vendor) {
      vendorFilter = ' AND oi.product_id IN (SELECT id FROM products WHERE vendor_id = ?)';
      vendorParams = [vendor.id];
    }
  }

  const totalSalesQuery = isVendor ? 
    `SELECT SUM(oi.price * oi.quantity) as total FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.payment_status = 'paid' ${vendorFilter}` :
    'SELECT SUM(total_price) as total FROM orders WHERE payment_status = \'paid\'';
  
  const totalSales = db.prepare(totalSalesQuery).get(...vendorParams) as any;
  
  const todayOrdersQuery = isVendor ?
    `SELECT COUNT(DISTINCT o.id) as count FROM orders o JOIN order_items oi ON o.id = oi.order_id WHERE date(o.created_at) = date('now') ${vendorFilter}` :
    'SELECT COUNT(*) as count FROM orders WHERE date(created_at) = date(\'now\')';
  const todayOrders = db.prepare(todayOrdersQuery).get(...vendorParams) as any;

  const pendingOrdersQuery = isVendor ?
    `SELECT COUNT(DISTINCT o.id) as count FROM orders o JOIN order_items oi ON o.id = oi.order_id WHERE o.order_status = 'pending' ${vendorFilter}` :
    'SELECT COUNT(*) as count FROM orders WHERE order_status = \'pending\'';
  const pendingOrders = db.prepare(pendingOrdersQuery).get(...vendorParams) as any;

  const readyToShipQuery = isVendor ?
    `SELECT COUNT(DISTINCT o.id) as count FROM orders o JOIN order_items oi ON o.id = oi.order_id WHERE o.order_status = 'preparing' ${vendorFilter}` :
    'SELECT COUNT(*) as count FROM orders WHERE order_status = \'preparing\'';
  const readyToShip = db.prepare(readyToShipQuery).get(...vendorParams) as any;

  const lowStockQuery = isVendor ?
    'SELECT COUNT(*) as count FROM products WHERE stock < 10 AND vendor_id = ?' :
    'SELECT COUNT(*) as count FROM products WHERE stock < 10';
  const lowStock = db.prepare(lowStockQuery).get(...(isVendor ? vendorParams : [])) as any;

  const newUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE date(created_at) = date(\'now\')').get() as any;

  const pendingVendors = db.prepare('SELECT COUNT(*) as count FROM vendors WHERE status = \'pending\'').get() as any;
  const pendingProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE is_approved = 0').get() as any;

  res.json({
    totalSales: totalSales.total || 0,
    todayOrders: todayOrders.count,
    pendingOrders: pendingOrders.count,
    readyToShip: readyToShip.count,
    lowStock: lowStock.count,
    newUsers: newUsers.count,
    pendingVendors: pendingVendors.count,
    pendingProducts: pendingProducts.count
  });
});

app.get('/api/admin/orders', authenticate, isVendorOrAdmin, (req: any, res) => {
  const isVendor = req.user.role === 'vendor';
  let orders;
  if (isVendor) {
    const vendor = db.prepare('SELECT id FROM vendors WHERE user_id = ?').get(req.user.id) as any;
    orders = db.prepare(`
      SELECT DISTINCT o.*, u.name as user_name, u.email 
      FROM orders o 
      JOIN users u ON o.user_id = u.id 
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.vendor_id = ?
      ORDER BY o.created_at DESC
    `).all(vendor ? vendor.id : 0);
  } else {
    orders = db.prepare(`
      SELECT o.*, u.name as user_name, u.email 
      FROM orders o 
      JOIN users u ON o.user_id = u.id 
      ORDER BY o.created_at DESC
    `).all();
  }
  res.json(orders);
});

app.put('/api/admin/orders/:id/status', authenticate, isVendorOrAdmin, (req: any, res) => {
  const { status } = req.body;

  if (req.user.role === 'vendor') {
    const vendor = db.prepare('SELECT id FROM vendors WHERE user_id = ?').get(req.user.id) as any;
    if (!vendor) return res.status(403).json({ error: 'Vendor not found' });
    
    // Check if the order contains products from this vendor
    const orderItems = db.prepare(`
      SELECT oi.id FROM order_items oi 
      JOIN products p ON oi.product_id = p.id 
      WHERE oi.order_id = ? AND p.vendor_id = ?
    `).all(req.params.id, vendor.id);
    
    if (orderItems.length === 0) {
      return res.status(403).json({ error: 'Unauthorized to update this order' });
    }
  }

  db.prepare('UPDATE orders SET order_status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

app.post('/api/products', authenticate, isVendorOrAdmin, (req: any, res) => {
  const { title, description, price, discount_price, stock, category_id, image, unit, tags, section, features, producer, origin, weight, video, story, gallery, organic_cert, shipping_info, is_active } = req.body;
  let vendor_id = req.body.vendor_id;
  
  if (req.user.role === 'vendor') {
    const vendor = db.prepare('SELECT id FROM vendors WHERE user_id = ?').get(req.user.id) as any;
    vendor_id = vendor ? vendor.id : null;
  }

  const info = db.prepare('INSERT INTO products (title, description, price, discount_price, stock, category_id, vendor_id, image, unit, tags, section, features, producer, origin, weight, video, story, gallery, organic_cert, shipping_info, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(title, description, price, discount_price, stock, category_id, vendor_id, image, unit, JSON.stringify(tags), section, JSON.stringify(features), producer, origin, weight, video, story, JSON.stringify(gallery), organic_cert, shipping_info, is_active === undefined ? 1 : is_active);
  
  // Log stock movement
  db.prepare('INSERT INTO stock_movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)').run(info.lastInsertRowid, 'add', stock, 'Initial stock');
  
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/products/:id', authenticate, isVendorOrAdmin, (req: any, res) => {
  const { title, description, price, discount_price, stock, category_id, image, unit, tags, section, features, producer, origin, weight, video, story, gallery, organic_cert, shipping_info, is_active } = req.body;
  
  if (req.user.role === 'vendor') {
    const vendor = db.prepare('SELECT id FROM vendors WHERE user_id = ?').get(req.user.id) as any;
    if (!vendor) return res.status(403).json({ error: 'Vendor not found' });
    
    const product = db.prepare('SELECT vendor_id FROM products WHERE id = ?').get(req.params.id) as any;
    if (!product || product.vendor_id !== vendor.id) {
      return res.status(403).json({ error: 'Unauthorized to edit this product' });
    }
  }

  // Check stock change
  const oldProduct = db.prepare('SELECT stock FROM products WHERE id = ?').get(req.params.id) as any;
  if (oldProduct && oldProduct.stock !== stock) {
    const diff = stock - oldProduct.stock;
    const type = diff > 0 ? 'add' : 'correct';
    db.prepare('INSERT INTO stock_movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)').run(req.params.id, type, Math.abs(diff), 'Manual update');
  }

  db.prepare('UPDATE products SET title=?, description=?, price=?, discount_price=?, stock=?, category_id=?, image=?, unit=?, tags=?, section=?, features=?, producer=?, origin=?, weight=?, video=?, story=?, gallery=?, organic_cert=?, shipping_info=?, is_active=? WHERE id=?').run(title, description, price, discount_price, stock, category_id, image, unit, JSON.stringify(tags), section, JSON.stringify(features), producer, origin, weight, video, story, JSON.stringify(gallery), organic_cert, shipping_info, is_active === undefined ? 1 : is_active, req.params.id);
  res.json({ success: true });
});

app.delete('/api/products/:id', authenticate, isVendorOrAdmin, (req: any, res) => {
  if (req.user.role === 'vendor') {
    const vendor = db.prepare('SELECT id FROM vendors WHERE user_id = ?').get(req.user.id) as any;
    if (!vendor) return res.status(403).json({ error: 'Vendor not found' });
    
    const product = db.prepare('SELECT vendor_id FROM products WHERE id = ?').get(req.params.id) as any;
    if (!product || product.vendor_id !== vendor.id) {
      return res.status(403).json({ error: 'Unauthorized to delete this product' });
    }
  }

  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// Category Management
app.post('/api/admin/categories', authenticate, isAdmin, (req, res) => {
  const { name, description, icon, image, is_active } = req.body;
  const info = db.prepare('INSERT INTO categories (name, description, icon, image, is_active) VALUES (?, ?, ?, ?, ?)').run(name, description, icon, image, is_active === undefined ? 1 : is_active);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/admin/categories/:id', authenticate, isAdmin, (req, res) => {
  const { name, description, icon, image, is_active } = req.body;
  db.prepare('UPDATE categories SET name=?, description=?, icon=?, image=?, is_active=? WHERE id=?').run(name, description, icon, image, is_active === undefined ? 1 : is_active, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/categories/:id', authenticate, isAdmin, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// Vendor Management
app.post('/api/vendor/apply', authenticate, (req: any, res) => {
  try {
    const { store_name, phone, address, location, tc_no, iban, document_url, description } = req.body;
    
    const existing = db.prepare('SELECT id FROM vendors WHERE user_id = ?').get(req.user.id);
    if (existing) return res.status(400).json({ error: 'Zaten bir satıcı başvurunuz bulunuyor.' });

    const info = db.prepare(`
      INSERT INTO vendors (user_id, store_name, phone, address, location, tc_no, iban, document_url, description, status, is_verified) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)
    `).run(req.user.id, store_name, phone, address, location, tc_no, iban, document_url, description);
    
    // Notify admin (mock)
    db.prepare('INSERT INTO notifications (title, message, type, target_role) VALUES (?, ?, ?, ?)').run(
      'Yeni Satıcı Başvurusu!',
      `${store_name} mağazası onay bekliyor.`,
      'announcement',
      'admin'
    );

    res.json({ id: info.lastInsertRowid, message: 'Başvurunuz alındı.' });
  } catch (err: any) {
    console.error('Vendor apply error:', err);
    res.status(500).json({ error: 'Başvuru sırasında bir hata oluştu: ' + err.message });
  }
});

app.get('/api/admin/pending-vendors', authenticate, isAdmin, (req, res) => {
  const vendors = db.prepare('SELECT v.*, u.email, u.name as contact_name FROM vendors v JOIN users u ON v.user_id = u.id WHERE v.is_verified = 0').all();
  res.json(vendors);
});

app.post('/api/admin/vendors/:id/verify', authenticate, isAdmin, (req, res) => {
  const { status } = req.body; // 'active' or 'rejected'
  const is_verified = status === 'active' ? 1 : 0;
  
  db.prepare('UPDATE vendors SET status = ?, is_verified = ? WHERE id = ?').run(status, is_verified, req.params.id);
  
  const vendor = db.prepare('SELECT user_id, store_name FROM vendors WHERE id = ?').get(req.params.id) as any;
  if (vendor) {
    if (status === 'active') {
      db.prepare('UPDATE users SET role = \'vendor\' WHERE id = ?').run(vendor.user_id);
    }
    // Notify user
    db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
      vendor.user_id,
      status === 'active' ? 'Mağazanız Onaylandı!' : 'Mağaza Başvurunuz Reddedildi',
      status === 'active' ? `${vendor.store_name} mağazanız artık aktif. Ürün yüklemeye başlayabilirsiniz.` : 'Başvurunuz kriterlerimize uygun bulunmadı.',
      'announcement'
    );
  }
  res.json({ success: true });
});

app.get('/api/admin/pending-products', authenticate, isAdmin, (req, res) => {
  const products = db.prepare(`
    SELECT p.*, v.store_name as vendor_name 
    FROM products p 
    JOIN vendors v ON p.vendor_id = v.id 
    WHERE p.is_approved = 0
  `).all();
  res.json(products);
});

app.post('/api/admin/products/:id/approve', authenticate, isAdmin, (req, res) => {
  const { status } = req.body; // 'approve' or 'reject'
  const is_approved = status === 'approve' ? 1 : 0;
  
  db.prepare('UPDATE products SET is_approved = ? WHERE id = ?').run(is_approved, req.params.id);
  
  const product = db.prepare('SELECT vendor_id, title FROM products WHERE id = ?').get(req.params.id) as any;
  if (product) {
    const vendor = db.prepare('SELECT user_id FROM vendors WHERE id = ?').get(product.vendor_id) as any;
    db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
      vendor.user_id,
      status === 'approve' ? 'Ürününüz Onaylandı' : 'Ürününüz Reddedildi',
      `${product.title} isimli ürününüz ${status === 'approve' ? 'onaylandı ve yayına alındı.' : 'reddedildi.'}`,
      'new_product'
    );
  }
  res.json({ success: true });
});

app.get('/api/admin/vendors', authenticate, isAdmin, (req, res) => {
  const vendors = db.prepare('SELECT v.*, u.email, u.name as contact_name FROM vendors v JOIN users u ON v.user_id = u.id').all();
  const formatted = vendors.map((v: any) => ({
    ...v,
    is_active: v.status === 'active' ? 1 : 0,
    commission_rate: v.commission_rate || 10
  }));
  res.json(formatted);
});

app.post('/api/admin/vendors', authenticate, isAdmin, (req, res) => {
  const { email, store_name, contact_name, phone, address, tax_number, bank_info, commission_rate, is_active } = req.body;
  
  // Find user by email
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any;
  if (!user) {
    return res.status(400).json({ error: 'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.' });
  }

  const status = is_active ? 'active' : 'pending';
  const info = db.prepare('INSERT INTO vendors (user_id, store_name, phone, address, tax_info, bank_info, commission_rate, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(user.id, store_name, phone, address, tax_number, bank_info, commission_rate || 10, status);
  
  if (is_active) {
    db.prepare('UPDATE users SET role = \'vendor\' WHERE id = ?').run(user.id);
  }
  
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/admin/vendors/:id/status', authenticate, isAdmin, (req, res) => {
  const { status } = req.body;
  
  db.prepare('UPDATE vendors SET status=? WHERE id=?').run(status, req.params.id);
  
  const vendor = db.prepare('SELECT user_id FROM vendors WHERE id = ?').get(req.params.id) as any;
  if (vendor) {
    if (status === 'active') {
      db.prepare('UPDATE users SET role = \'vendor\' WHERE id = ?').run(vendor.user_id);
    } else {
      db.prepare('UPDATE users SET role = \'user\' WHERE id = ?').run(vendor.user_id);
    }
  }
  
  res.json({ success: true });
});

app.put('/api/admin/vendors/:id', authenticate, isAdmin, (req, res) => {
  const { store_name, contact_name, phone, address, tax_number, bank_info, commission_rate, is_active } = req.body;
  const status = is_active ? 'active' : 'pending';
  
  db.prepare('UPDATE vendors SET store_name=?, phone=?, address=?, tax_info=?, bank_info=?, commission_rate=?, status=? WHERE id=?').run(store_name, phone, address, tax_number, bank_info, commission_rate || 10, status, req.params.id);
  
  const vendor = db.prepare('SELECT user_id FROM vendors WHERE id = ?').get(req.params.id) as any;
  if (vendor) {
    if (is_active) {
      db.prepare('UPDATE users SET role = \'vendor\' WHERE id = ?').run(vendor.user_id);
    } else {
      db.prepare('UPDATE users SET role = \'user\' WHERE id = ?').run(vendor.user_id);
    }
  }
  
  res.json({ success: true });
});

// Stock Reports
app.get('/api/admin/stock/reports', authenticate, isVendorOrAdmin, (req: any, res) => {
  const isVendor = req.user.role === 'vendor';
  let vendorFilter = '';
  let vendorParams: any[] = [];
  
  if (isVendor) {
    const vendor = db.prepare('SELECT id FROM vendors WHERE user_id = ?').get(req.user.id) as any;
    if (vendor) {
      vendorFilter = ' AND vendor_id = ?';
      vendorParams = [vendor.id];
    }
  }

  const lowStock = db.prepare(`SELECT id, title as name, image, price, stock, (SELECT store_name FROM vendors WHERE id = products.vendor_id) as vendor_name FROM products WHERE stock < 10 AND stock > 0 ${vendorFilter}`).all(...vendorParams);
  const outOfStock = db.prepare(`SELECT id, title as name, image, price, stock, (SELECT store_name FROM vendors WHERE id = products.vendor_id) as vendor_name FROM products WHERE stock <= 0 ${vendorFilter}`).all(...vendorParams);
  
  res.json({ lowStock, outOfStock });
});

// Reviews Management
app.get('/api/admin/reviews', authenticate, isAdmin, (req, res) => {
  const reviews = db.prepare(`
    SELECT r.*, u.name as user_name, p.title as product_title 
    FROM reviews r 
    JOIN users u ON r.user_id = u.id 
    JOIN products p ON r.product_id = p.id
    ORDER BY r.created_at DESC
  `).all();
  res.json(reviews);
});

app.put('/api/admin/reviews/:id/status', authenticate, isAdmin, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// Chat Routes
app.get('/api/chat/messages/:otherId', authenticate, (req: any, res) => {
  const messages = db.prepare(`
    SELECT * FROM chat_messages 
    WHERE (sender_id = ? AND receiver_id = ?) 
    OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at ASC
  `).all(req.user.id, req.params.otherId, req.params.otherId, req.user.id);
  res.json(messages);
});

app.post('/api/chat/messages', authenticate, (req: any, res) => {
  const { receiver_id, message } = req.body;
  const info = db.prepare('INSERT INTO chat_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)').run(req.user.id, receiver_id, message);
  res.json({ id: info.lastInsertRowid });
});

app.post('/api/admin/notifications', authenticate, isAdmin, (req, res) => {
  const { title, message, type, target_role, user_id } = req.body;
  const info = db.prepare('INSERT INTO notifications (title, message, type, target_role, user_id) VALUES (?, ?, ?, ?, ?)').run(title, message, type, target_role, user_id);
  res.json({ id: info.lastInsertRowid });
});

// Campaigns
app.get('/api/admin/campaigns', authenticate, isAdmin, (req, res) => {
  const campaigns = db.prepare('SELECT * FROM campaigns').all();
  res.json(campaigns);
});

app.post('/api/admin/campaigns', authenticate, isAdmin, (req, res) => {
  const { title, banner, discount_type, discount_value, target_type, target_id, start_date, end_date, is_active } = req.body;
  const info = db.prepare('INSERT INTO campaigns (title, banner, discount_type, discount_value, target_type, target_id, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(title, banner, discount_type, discount_value, target_type, target_id, start_date, end_date, is_active === undefined ? 1 : is_active);
  res.json({ id: info.lastInsertRowid });
});

// Finance Reports
app.get('/api/admin/finance/reports', authenticate, isAdmin, (req, res) => {
  const dailySales = db.prepare('SELECT date(created_at) as date, SUM(amount) as total_sales FROM transactions WHERE type = \'payment\' AND status = \'completed\' GROUP BY date(created_at) ORDER BY date DESC LIMIT 30').all();
  const vendorIncome = db.prepare(`
    SELECT v.store_name as vendor_name, 
           SUM(CASE WHEN t.type = 'payout' THEN t.amount ELSE 0 END) as total_payouts,
           SUM(CASE WHEN t.type = 'commission' THEN t.amount ELSE 0 END) as total_commission,
           SUM(CASE WHEN t.type = 'payment' THEN t.amount ELSE 0 END) as total_sales
    FROM transactions t
    JOIN vendors v ON t.vendor_id = v.id 
    WHERE t.status = 'completed'
    GROUP BY v.id
  `).all();
  
  res.json({ dailySales, vendorIncome });
});

app.get('/api/admin/users', authenticate, isAdmin, (req, res) => {
  const users = db.prepare('SELECT id, name, email, phone, role, status, created_at as joinDate FROM users').all();
  res.json(users);
});

app.put('/api/admin/users/:id/status', authenticate, isAdmin, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', authenticate, isAdmin, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Settings Routes
app.get('/api/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings').all() as any[];
  const result: any = {};
  settings.forEach(s => { result[s.key] = s.value; });
  res.json(result);
});

app.post('/api/settings', authenticate, isAdmin, (req, res) => {
  const settings = req.body;
  const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  Object.keys(settings).forEach(key => {
    insert.run(key, typeof settings[key] === 'object' ? JSON.stringify(settings[key]) : settings[key]);
  });
  res.json({ success: true });
});

// Start Vite
async function startServer() {
  console.log('Starting server...');
  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Global error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

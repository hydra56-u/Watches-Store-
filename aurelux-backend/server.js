// ==========================================
// AURELUX BACKEND SERVER
// ==========================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// DATABASE SETUP (lowdb v1 - FileSync)
// ==========================================

const dbFile = path.join(__dirname, 'data', 'db.json');
const adapter = new FileSync(dbFile);
const db = low(adapter);

// Set default data if db.json is empty
db.defaults({ watches: [], orders: [] }).write();

// ==========================================
// FILE UPLOAD SETUP (Multer)
// ==========================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per file
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    if (ext) cb(null, true);
    else cb(new Error('Only image files are allowed!'));
  }
});

// ==========================================
// AUTH MIDDLEWARE (Protect Admin Routes)
// ==========================================

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

// ==========================================
// ROUTE: ADMIN LOGIN
// ==========================================

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign(
      { username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ success: true, token });
  }

  res.status(401).json({ success: false, error: 'Invalid username or password' });
});

// ==========================================
// ROUTE: GET ALL WATCHES (Public - for Shop page)
// ==========================================

app.get('/api/watches', (req, res) => {
  const watches = db.get('watches').value();
  res.json(watches);
});

// ==========================================
// ROUTE: GET SINGLE WATCH (Public)
// ==========================================

app.get('/api/watches/:id', (req, res) => {
  const watch = db.get('watches').find({ id: req.params.id }).value();

  if (!watch) {
    return res.status(404).json({ error: 'Watch not found' });
  }

  res.json(watch);
});

// ==========================================
// ROUTE: ADD NEW WATCH (Admin Only) — Multiple Photos
// ==========================================

app.post('/api/admin/watches', verifyToken, upload.array('photos', 5), (req, res) => {
  try {
    const { name, price, description, category, stock } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    // req.files is an array (up to 5 photos)
    const photoUrls = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];

    const newWatch = {
      id: Date.now().toString(),
      name,
      price: parseFloat(price),
      description: description || '',
      category: category || 'General',
      stock: parseInt(stock) || 1,
      photos: photoUrls,
      dateAdded: new Date().toISOString()
    };

    db.get('watches').push(newWatch).write();

    res.json({ success: true, watch: newWatch });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while adding watch' });
  }
});

// ==========================================
// ROUTE: UPDATE WATCH (Admin Only) — Multiple Photos
// ==========================================

app.put('/api/admin/watches/:id', verifyToken, upload.array('photos', 5), (req, res) => {
  try {
    const watch = db.get('watches').find({ id: req.params.id });

    if (!watch.value()) {
      return res.status(404).json({ error: 'Watch not found' });
    }

    const { name, price, description, category, stock } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (price) updates.price = parseFloat(price);
    if (description !== undefined) updates.description = description;
    if (category) updates.category = category;
    if (stock) updates.stock = parseInt(stock);

    // If new photos uploaded, replace old ones
    if (req.files && req.files.length > 0) {
      updates.photos = req.files.map(f => `/uploads/${f.filename}`);
    }

    watch.assign(updates).write();

    res.json({ success: true, watch: watch.value() });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while updating watch' });
  }
});

// ==========================================
// ROUTE: DELETE WATCH (Admin Only) — Delete All Photos
// ==========================================

app.delete('/api/admin/watches/:id', verifyToken, (req, res) => {
  const watch = db.get('watches').find({ id: req.params.id }).value();

  if (!watch) {
    return res.status(404).json({ error: 'Watch not found' });
  }

  // Delete all photo files if they exist
  if (watch.photos && watch.photos.length > 0) {
    watch.photos.forEach(photoPath => {
      const fullPath = path.join(__dirname, photoPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });
  }

  db.get('watches').remove({ id: req.params.id }).write();

  res.json({ success: true });
});

// ==========================================
// ROUTE: PLACE ORDER (Public - Customer facing)
// ==========================================

app.post('/api/orders', async (req, res) => {
  try {
    const { customerName, phone, address, watchId, watchName, quantity, totalPrice, paymentMethod } = req.body;

    if (!customerName || !phone || !address || !watchId) {
      return res.status(400).json({ error: 'Missing required order details' });
    }

    const newOrder = {
      id: 'ORD-' + Date.now(),
      customerName,
      phone,
      address,
      watchId,
      watchName,
      quantity: parseInt(quantity) || 1,
      totalPrice: parseFloat(totalPrice) || 0,
      paymentMethod: paymentMethod || 'COD',
      status: 'Pending',
      date: new Date().toISOString()
    };

    db.get('orders').push(newOrder).write();

    // Auto-update Excel file
    await updateExcelFile();

    res.json({ success: true, order: newOrder });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while placing order' });
  }
});

// ==========================================
// ROUTE: GET ALL ORDERS (Admin Only)
// ==========================================

app.get('/api/admin/orders', verifyToken, (req, res) => {
  const orders = db.get('orders').value();
  res.json(orders);
});

// ==========================================
// ROUTE: DOWNLOAD EXCEL FILE (Admin Only)
// ==========================================

app.get('/api/admin/orders/export', verifyToken, async (req, res) => {
  await updateExcelFile();

  const filePath = path.join(__dirname, 'data', 'orders.xlsx');

  res.download(filePath, 'AURELUX_Orders.xlsx');
});

// ==========================================
// FUNCTION: Generate / Update Excel File
// ==========================================

async function updateExcelFile() {
  const orders = db.get('orders').value();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Orders');

  sheet.columns = [
    { header: 'Order ID', key: 'id', width: 20 },
    { header: 'Customer Name', key: 'customerName', width: 25 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Address', key: 'address', width: 35 },
    { header: 'Watch Name', key: 'watchName', width: 25 },
    { header: 'Quantity', key: 'quantity', width: 10 },
    { header: 'Total Price', key: 'totalPrice', width: 15 },
    { header: 'Payment Method', key: 'paymentMethod', width: 16 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Date', key: 'date', width: 22 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8C6A7' }
  };

  orders.forEach(order => {
    sheet.addRow(order);
  });

  const filePath = path.join(__dirname, 'data', 'orders.xlsx');
  await workbook.xlsx.writeFile(filePath);
}

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(`\n🚀 AURELUX Backend Server running on http://localhost:${PORT}\n`);
});
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
// In production we serve same-origin; during local dev, Vite runs on localhost and this remains permissive.
app.use(cors());

const DB_PATH = process.env.DB_PATH || './dev.sqlite';
// Ensure DB directory exists (especially when using a mounted volume like /var/data)
try {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
} catch (e) {
  console.error('Failed to ensure DB directory', e);
}
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open DB', err);
  } else {
    console.log('Connected to SQLite DB at', DB_PATH);
  }
});

// Small promise wrappers for sqlite3
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

// Initialize DB (create tables if missing)
async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'Admin'
  );`);

  await run(`CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT
  );`);

  await run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT,
    last_name TEXT,
    class_id INTEGER,
    FOREIGN KEY(class_id) REFERENCES classes(id)
  );`);

  await run(`CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    amount REAL,
    status TEXT DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(student_id) REFERENCES students(id)
  );`);
}
initDb()
  .then(seedAdmin)
  .catch(err => console.error('DB init error', err));

async function seedAdmin() {
  try {
    const row = await get('SELECT COUNT(*) as c FROM users');
    if (!row || row.c === 0) {
      const name = 'Administrator';
      const email = 'admin@lowveld.local';
      const password = 'admin123';
      const hashed = await bcrypt.hash(password, 10);
      await run('INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)', [name, email, hashed, 'Admin']);
      console.log('Seeded default admin:', email, '(please change the password)');
    }
  } catch (e) {
    console.error('Seed admin failed', e);
  }
}

// ---- Auth middleware ----
const SECRET = process.env.JWT_SECRET || 'dev_secret';
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });
  const token = auth.split(' ')[1];
  jwt.verify(token, SECRET, (err, payload) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = payload;
    next();
  });
}

// ---- Auth routes ----
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const hashed = await bcrypt.hash(password, 10);
    const result = await run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name || '', email, hashed]);
    const user = await get('SELECT id, name, email, role FROM users WHERE id = ?', [result.lastID]);
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '1d' });
    res.json({ user, token });
  } catch (err) {
    if (err && err.message && err.message.includes('SQLITE_CONSTRAINT')) return res.status(400).json({ error: 'Email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '1d' });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---- Students endpoints ----
app.get('/api/students', authMiddleware, async (req, res) => {
  try {
    const rows = await all(`SELECT s.*, c.name as class_name
                           FROM students s
                           LEFT JOIN classes c ON s.class_id = c.id`);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/students', authMiddleware, async (req, res) => {
  try {
    const { first_name, last_name, class_id } = req.body;
    const r = await run('INSERT INTO students (first_name, last_name, class_id) VALUES (?, ?, ?)', [first_name, last_name, class_id]);
    const student = await get('SELECT * FROM students WHERE id = ?', [r.lastID]);
    res.json(student);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/students/:id', authMiddleware, async (req, res) => {
  try {
    const student = await get('SELECT * FROM students WHERE id = ?', [req.params.id]);
    if (!student) return res.status(404).json({ error: 'Not found' });
    res.json(student);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/students/:id', authMiddleware, async (req, res) => {
  try {
    const { first_name, last_name, class_id } = req.body;
    await run('UPDATE students SET first_name = ?, last_name = ?, class_id = ? WHERE id = ?', [first_name, last_name, class_id, req.params.id]);
    const student = await get('SELECT * FROM students WHERE id = ?', [req.params.id]);
    res.json(student);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/students/:id', authMiddleware, async (req, res) => {
  try {
    await run('DELETE FROM students WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---- Classes endpoints ----
app.get('/api/classes', authMiddleware, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM classes');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/classes', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    const r = await run('INSERT INTO classes (name, description) VALUES (?, ?)', [name, description]);
    const cls = await get('SELECT * FROM classes WHERE id = ?', [r.lastID]);
    res.json(cls);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---- Invoices endpoints (simple) ----
app.get('/api/invoices', authMiddleware, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM invoices');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/invoices', authMiddleware, async (req, res) => {
  try {
    const { student_id, amount, status } = req.body;
    const r = await run('INSERT INTO invoices (student_id, amount, status) VALUES (?, ?, ?)', [student_id, amount, status || 'draft']);
    const inv = await get('SELECT * FROM invoices WHERE id = ?', [r.lastID]);
    res.json(inv);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---- Start server ----
const PORT = process.env.PORT || 4000;

// ---- Static client build (single-URL deployment) ----
const candidates = [
  path.join(__dirname, '../dist/spa'), // root build to dist/spa
  path.join(__dirname, '../client/dist'), // client build when building from client/
];
let clientDist = candidates.find((p) => {
  try { return fs.existsSync(p) && fs.statSync(p).isDirectory(); } catch { return false; }
});
if (!clientDist) {
  console.error('Client build folder not found. Checked:', candidates);
  clientDist = candidates[0];
}
app.use(express.static(clientDist));

// ---- Health check (under /api namespace) ----
app.get('/api/health', (req, res) => res.json({ ok: true }));

// SPA fallback: send index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexPath = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  console.error('index.html not found at', indexPath);
  return res.status(500).send('Client build not found');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

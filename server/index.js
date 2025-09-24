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

// Choose a DB path that works locally and on Render (no persistent disk by default)
// Prefer explicit DB_PATH; otherwise:
// - In production (Render), default to /tmp/dev.sqlite (always writable)
// - In development, default to ./dev.sqlite
let DB_PATH = process.env.DB_PATH
  || (process.env.RENDER ? '/tmp/dev.sqlite' : './dev.sqlite');
// Ensure DB directory exists (especially when using a mounted volume)
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
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'Admin',
    is_active BOOLEAN DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );`);

  await run(`CREATE TABLE IF NOT EXISTS user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    permission TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );`);

  await run(`CREATE TABLE IF NOT EXISTS parents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    phone TEXT,
    address TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );`);

  await run(`CREATE TABLE IF NOT EXISTS parent_student (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER,
    student_id INTEGER,
    relationship TEXT,
    FOREIGN KEY(parent_id) REFERENCES parents(id),
    FOREIGN KEY(student_id) REFERENCES students(id)
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
    date_of_birth TEXT,
    class_id INTEGER,
    parent_id INTEGER,
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(parent_id) REFERENCES parents(id)
  );`);

  await run(`CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    amount REAL,
    status TEXT DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(student_id) REFERENCES students(id)
  );`);

  // Non-teaching staff
  await run(`CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT,
    last_name TEXT,
    title TEXT,
    email TEXT,
    phone TEXT
  );`);

  // Attendance logs (for students, teachers, staff)
  await run(`CREATE TABLE IF NOT EXISTS attendance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- student | teacher | staff
    entity_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    status TEXT NOT NULL, -- Present | Absent | Late
    remarks TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(entity_type, entity_id, date)
  );`);

  // Teachers table
  await run(`CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    subject TEXT
  );`);

  // Subjects table
  await run(`CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );`);

  // Class streams (e.g., A, B, Yellow, Green) tied to a class
  await run(`CREATE TABLE IF NOT EXISTS class_streams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER,
    name TEXT,
    FOREIGN KEY(class_id) REFERENCES classes(id)
  );`);

  // Guardians table
  await run(`CREATE TABLE IF NOT EXISTS guardians (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT
  );`);

  // Student-Subject mapping
  await run(`CREATE TABLE IF NOT EXISTS student_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    subject_id INTEGER,
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(subject_id) REFERENCES subjects(id)
  );`);

  // Teacher-Subject mapping
  await run(`CREATE TABLE IF NOT EXISTS teacher_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER,
    subject_id INTEGER,
    FOREIGN KEY(teacher_id) REFERENCES teachers(id),
    FOREIGN KEY(subject_id) REFERENCES subjects(id)
  );`);

  // Class-Subject mapping
  await run(`CREATE TABLE IF NOT EXISTS class_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER,
    subject_id INTEGER,
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(subject_id) REFERENCES subjects(id)
  );`);

  // Teacher-Class assignments
  await run(`CREATE TABLE IF NOT EXISTS teacher_classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER,
    class_id INTEGER,
    FOREIGN KEY(teacher_id) REFERENCES teachers(id),
    FOREIGN KEY(class_id) REFERENCES classes(id)
  );`);

  // Timetable entries
  await run(`CREATE TABLE IF NOT EXISTS timetable_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER,
    teacher_id INTEGER,
    subject TEXT,
    day_of_week INTEGER,   -- 1=Mon .. 7=Sun
    start_time TEXT,       -- '08:00'
    end_time TEXT,         -- '09:00'
    room TEXT,
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(teacher_id) REFERENCES teachers(id)
  );`);

  // Add missing columns to students
  const studentCols = await all("PRAGMA table_info(students)");
  if (!studentCols.some(c => c.name === "guardian_id")) {
    await run("ALTER TABLE students ADD COLUMN guardian_id INTEGER REFERENCES guardians(id)");
  }
  if (!studentCols.some(c => c.name === "class_stream_id")) {
    await run("ALTER TABLE students ADD COLUMN class_stream_id INTEGER REFERENCES class_streams(id)");
  }
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
console.log('JWT_SECRET:', SECRET);
console.log('All env vars:', Object.keys(process.env).filter(k => k.includes('JWT') || k.includes('SECRET')));
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  console.log('Auth middleware check - Authorization header:', auth ? 'present' : 'missing');

  if (!auth) {
    console.log('Missing Authorization header');
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = auth.split(' ')[1];
  if (!token) {
    console.log('No token found in Authorization header');
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, SECRET, (err, payload) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid token' });
    }
    console.log('Token verified successfully for user:', payload.email, 'with role:', payload.role);
    req.user = payload;
    next();
  });
}

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for email:', email);

    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.is_active) {
      console.log('User account is deactivated:', email);
      return res.status(401).json({ error: 'Account is deactivated. Please contact administrator.' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '1d' });
    console.log('Login successful for user:', email, 'with role:', user.role);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---- Auth routes ----
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
    }

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

// ---- User Management endpoints ----
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    // Only admins can see all users
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const users = await all(`SELECT id, name, email, role, is_active
                            FROM users ORDER BY id DESC`);
    res.json(users);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users', authMiddleware, async (req, res) => {
  try {
    // Only admins can create users
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { name, email, password, role = 'Teacher' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashed, role]);

    const user = await get('SELECT id, name, email, role, is_active FROM users WHERE id = ?',
      [result.lastID]);

    res.json(user);
  } catch (err) {
    if (err && err.message && err.message.includes('SQLITE_CONSTRAINT')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    // Only admins can update users
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { name, email, role, is_active } = req.body;
    await run('UPDATE users SET name = ?, email = ?, role = ?, is_active = ?, updated_at = datetime("now") WHERE id = ?',
      [name, email, role, is_active, req.params.id]);

    const user = await get('SELECT id, name, email, role, is_active FROM users WHERE id = ?',
      [req.params.id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    if (err && err.message && err.message.includes('SQLITE_CONSTRAINT')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    // Only admins can delete users, and can't delete themselves
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await run('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---- Parent Management endpoints ----
app.post('/api/parents/register', async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashed, 'Parent']);

    const parentResult = await run('INSERT INTO parents (user_id, phone, address) VALUES (?, ?, ?)',
      [result.lastID, phone || '', address || '']);

    const user = await get('SELECT id, name, email, role, is_active FROM users WHERE id = ?',
      [result.lastID]);
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '1d' });

    res.json({ user, token, message: 'Parent account created successfully' });
  } catch (err) {
    if (err && err.message && err.message.includes('SQLITE_CONSTRAINT')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Parent registration error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/parents/students', authMiddleware, async (req, res) => {
  try {
    // Only parents can access their students
    if (req.user.role !== 'Parent') {
      return res.status(403).json({ error: 'Access denied. Parent role required.' });
    }

    const students = await all(`
      SELECT s.*, c.name as class_name, ps.relationship
      FROM students s
      INNER JOIN parent_student ps ON s.id = ps.student_id
      INNER JOIN parents p ON ps.parent_id = p.id
      INNER JOIN users u ON p.user_id = u.id
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE u.id = ?
    `, [req.user.id]);

    res.json(students);
  } catch (err) {
    console.error('Get parent students error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---- Students endpoints ----
app.get('/api/students', authMiddleware, async (req, res) => {
  try {
    const rows = await all(`SELECT s.*, c.name as class_name, cs.name as stream_name
                           FROM students s
                           LEFT JOIN classes c ON s.class_id = c.id
                           LEFT JOIN class_streams cs ON cs.id = s.class_stream_id`);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/students', authMiddleware, async (req, res) => {
  try {
    const { first_name, last_name, class_id, parent_id, date_of_birth } = req.body;
    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    const result = await run('INSERT INTO students (first_name, last_name, class_id, parent_id, date_of_birth) VALUES (?, ?, ?, ?, ?)',
      [first_name, last_name, class_id || null, parent_id || null, date_of_birth || null]);

    const student = await get('SELECT * FROM students WHERE id = ?', [result.lastID]);
    res.json(student);
  } catch (err) {
    console.error('Create student error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/students/:id', authMiddleware, async (req, res) => {
  try {
    const student = await get(`SELECT s.*, c.name as class_name, cs.name as stream_name
                               FROM students s
                               LEFT JOIN classes c ON s.class_id = c.id
                               LEFT JOIN class_streams cs ON cs.id = s.class_stream_id
                               WHERE s.id = ?`, [req.params.id]);
    if (!student) return res.status(404).json({ error: 'Not found' });
    const guardian = student.guardian_id ? await get('SELECT * FROM guardians WHERE id = ?', [student.guardian_id]) : null;
    const subjects = await all('SELECT sub.* FROM student_subjects ss JOIN subjects sub ON sub.id = ss.subject_id WHERE ss.student_id = ?', [req.params.id]);
    res.json({ ...student, guardian, subjects });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/students/:id', authMiddleware, async (req, res) => {
  try {
    const { first_name, last_name, class_id, parent_id, date_of_birth } = req.body;
    await run('UPDATE students SET first_name = ?, last_name = ?, class_id = ?, parent_id = ?, date_of_birth = ? WHERE id = ?',
      [first_name, last_name, class_id, parent_id, date_of_birth, req.params.id]);

    const student = await get('SELECT * FROM students WHERE id = ?', [req.params.id]);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(student);
  } catch (err) {
    console.error('Update student error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/students/:id', authMiddleware, async (req, res) => {
  try {
    await run('DELETE FROM students WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---- Parent-Student Link endpoints ----
app.post('/api/parent-student/link', authMiddleware, async (req, res) => {
  try {
    // Only admins can link parents to students
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { parent_id, student_id, relationship = 'Parent' } = req.body;
    if (!parent_id || !student_id) {
      return res.status(400).json({ error: 'Parent ID and Student ID are required' });
    }

    // Verify parent exists and has Parent role
    const parent = await get('SELECT p.*, u.role FROM parents p INNER JOIN users u ON p.user_id = u.id WHERE p.id = ?', [parent_id]);
    if (!parent || parent.role !== 'Parent') {
      return res.status(400).json({ error: 'Invalid parent ID or user is not a parent' });
    }

    // Verify student exists
    const student = await get('SELECT * FROM students WHERE id = ?', [student_id]);
    if (!student) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    // Check if link already exists
    const existingLink = await get('SELECT * FROM parent_student WHERE parent_id = ? AND student_id = ?', [parent_id, student_id]);
    if (existingLink) {
      return res.status(400).json({ error: 'Parent-student link already exists' });
    }

    const result = await run('INSERT INTO parent_student (parent_id, student_id, relationship) VALUES (?, ?, ?)',
      [parent_id, student_id, relationship]);

    res.json({ success: true, message: 'Parent-student link created successfully' });
  } catch (err) {
    console.error('Link parent-student error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/parent-student/links', authMiddleware, async (req, res) => {
  try {
    // Only admins can see all parent-student links
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const links = await all(`
      SELECT ps.*, p.user_id as parent_user_id, u.name as parent_name, u.email as parent_email,
             s.first_name, s.last_name, c.name as class_name
      FROM parent_student ps
      INNER JOIN parents p ON ps.parent_id = p.id
      INNER JOIN users u ON p.user_id = u.id
      INNER JOIN students s ON ps.student_id = s.id
      LEFT JOIN classes c ON s.class_id = c.id
    `);

    res.json(links);
  } catch (err) {
    console.error('Get parent-student links error:', err);
    res.status(500).json({ error: 'Server error' });
  }
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

// ---- Teachers endpoints ----
app.get('/api/teachers', authMiddleware, async (req, res) => {
  try {
    const rows = await all("SELECT * FROM teachers ORDER BY id DESC");
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/teachers', authMiddleware, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, subject } = req.body;
    if (!first_name || !last_name) return res.status(400).json({ error: 'First and last name are required' });
    const r = await run('INSERT INTO teachers (first_name, last_name, email, phone, subject) VALUES (?, ?, ?, ?, ?)', [first_name, last_name, email || null, phone || null, subject || null]);
    const teacher = await get('SELECT * FROM teachers WHERE id = ?', [r.lastID]);
    res.json(teacher);
  } catch (err) {
    if (err && err.message && err.message.includes('SQLITE_CONSTRAINT')) return res.status(400).json({ error: 'Email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/teachers/:id', authMiddleware, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, subject } = req.body;
    await run('UPDATE teachers SET first_name = ?, last_name = ?, email = ?, phone = ?, subject = ? WHERE id = ?', [first_name, last_name, email || null, phone || null, subject || null, req.params.id]);
    const teacher = await get('SELECT * FROM teachers WHERE id = ?', [req.params.id]);
    if (!teacher) return res.status(404).json({ error: 'Not found' });
    res.json(teacher);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/teachers/:id', authMiddleware, async (req, res) => {
  try {
    await run('DELETE FROM teachers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---- Staff endpoints ----
app.get('/api/staff', authMiddleware, async (req, res) => {
  try {
    const rows = await all("SELECT * FROM staff ORDER BY id DESC");
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/staff', authMiddleware, async (req, res) => {
  try {
    const { first_name, last_name, title, email, phone } = req.body;
    if (!first_name || !last_name) return res.status(400).json({ error: 'First and last name are required' });
    const r = await run('INSERT INTO staff (first_name, last_name, title, email, phone) VALUES (?, ?, ?, ?, ?)', [first_name, last_name, title || null, email || null, phone || null]);
    const row = await get('SELECT * FROM staff WHERE id = ?', [r.lastID]);
    res.json(row);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/staff/:id', authMiddleware, async (req, res) => {
  try {
    const { first_name, last_name, title, email, phone } = req.body;
    await run('UPDATE staff SET first_name=?, last_name=?, title=?, email=?, phone=? WHERE id=?', [first_name, last_name, title || null, email || null, phone || null, req.params.id]);
    const row = await get('SELECT * FROM staff WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/staff/:id', authMiddleware, async (req, res) => {
  try {
    await run('DELETE FROM staff WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---- Class streams endpoints ----
app.get('/api/class-streams', authMiddleware, async (req, res) => {
  try {
    const rows = await all("SELECT cs.*, c.name as class_name FROM class_streams cs JOIN classes c ON c.id = cs.class_id ORDER BY c.name, cs.name");
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/class-streams', authMiddleware, async (req, res) => {
  try {
    const { class_id, name } = req.body;
    if (!class_id || !name) return res.status(400).json({ error: 'class_id and name required' });
    const r = await run('INSERT OR IGNORE INTO class_streams (class_id, name) VALUES (?,?)', [class_id, name]);
    const row = await get('SELECT * FROM class_streams WHERE id = ?', [r.lastID]);
    res.json(row || (await get('SELECT * FROM class_streams WHERE class_id = ? AND name = ?', [class_id, name])));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---- Subjects endpoints ----
app.get('/api/subjects', authMiddleware, async (req, res) => {
  try {
    const rows = await all("SELECT * FROM subjects ORDER BY name");
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/subjects', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await run('INSERT OR IGNORE INTO subjects (name) VALUES (?)', [name]);
    const row = await get('SELECT * FROM subjects WHERE id = ?', [r.lastID]);
    res.json(row || (await get('SELECT * FROM subjects WHERE name = ?', [name])));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/subjects/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ref = await get('SELECT COUNT(*) as cnt FROM student_subjects WHERE subject_id = ?', [id]);
    if ((ref?.cnt || 0) > 0) {
      return res.status(400).json({ error: 'Cannot delete: subject is assigned to students' });
    }
    await run('DELETE FROM subjects WHERE id = ?', [id]);
    res.json({ success: true });
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

// ---- Attendance endpoints ----
app.get('/api/attendance/today', authMiddleware, async (req, res) => {
  try {
    const { type } = req.query; // student, teacher, staff
    if (!type) return res.status(400).json({ error: 'Type parameter required' });

    const today = new Date().toISOString().slice(0, 10);
    let query, params;

    if (type === 'student') {
      query = `
        SELECT al.*, s.first_name, s.last_name, c.name as class_name
        FROM attendance_logs al
        LEFT JOIN students s ON al.entity_id = s.id
        LEFT JOIN classes c ON s.class_id = c.id
        WHERE al.entity_type = 'student' AND al.date = ?
        ORDER BY al.created_at DESC
      `;
      params = [today];
    } else if (type === 'teacher') {
      query = `
        SELECT al.*, t.first_name, t.last_name
        FROM attendance_logs al
        LEFT JOIN teachers t ON al.entity_id = t.id
        WHERE al.entity_type = 'teacher' AND al.date = ?
        ORDER BY al.created_at DESC
      `;
      params = [today];
    } else if (type === 'staff') {
      query = `
        SELECT al.*, st.first_name, st.last_name
        FROM attendance_logs al
        LEFT JOIN staff st ON al.entity_id = st.id
        WHERE al.entity_type = 'staff' AND al.date = ?
        ORDER BY al.created_at DESC
      `;
      params = [today];
    } else {
      return res.status(400).json({ error: 'Invalid type. Must be student, teacher, or staff' });
    }

    const rows = await all(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/attendance/mark', authMiddleware, async (req, res) => {
  try {
    const { entity_type, entity_id, date, status, remarks } = req.body;
    if (!entity_type || !entity_id || !date || !status) {
      return res.status(400).json({ error: 'entity_type, entity_id, date, and status are required' });
    }
    if (!['Present', 'Absent', 'Late'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Present, Absent, or Late' });
    }

    // Insert or replace (UPSERT)
    await run(`
      INSERT OR REPLACE INTO attendance_logs (entity_type, entity_id, date, status, remarks)
      VALUES (?, ?, ?, ?, ?)
    `, [entity_type, entity_id, date, status, remarks || '']);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---- Receipts (payments) ----
app.get('/api/receipts', authMiddleware, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM receipts ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/receipts', authMiddleware, async (req, res) => {
  try {
    const { invoice_id, amount, method, reference } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Amount must be > 0' });
    const r = await run('INSERT INTO receipts (invoice_id, amount, method, reference) VALUES (?, ?, ?, ?)', [invoice_id || null, Number(amount), method || null, reference || null]);

    // If linked to an invoice, update invoice status based on total paid
    if (invoice_id) {
      const inv = await get('SELECT amount FROM invoices WHERE id = ?', [invoice_id]);
      if (inv) {
        const paidRow = await get('SELECT SUM(amount) as total FROM receipts WHERE invoice_id = ?', [invoice_id]);
        const totalPaid = paidRow?.total || 0;
        const newStatus = totalPaid >= inv.amount ? 'Paid' : 'Under Review';
        await run('UPDATE invoices SET status = ? WHERE id = ?', [newStatus, invoice_id]);
      }
    }

    const rec = await get('SELECT * FROM receipts WHERE id = ?', [r.lastID]);
    res.json(rec);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---- Expenses ----
app.get('/api/expenses', authMiddleware, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM expenses ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/expenses', authMiddleware, async (req, res) => {
  try {
    const { title, amount, category } = req.body;
    if (!title || !amount || Number(amount) <= 0) return res.status(400).json({ error: 'Title and amount are required' });
    const r = await run('INSERT INTO expenses (title, amount, category) VALUES (?, ?, ?)', [title, Number(amount), category || null]);
    const exp = await get('SELECT * FROM expenses WHERE id = ?', [r.lastID]);
    res.json(exp);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---- Finance summary ----
app.get('/api/finance/summary', authMiddleware, async (req, res) => {
  try {
    const rec = await get('SELECT COALESCE(SUM(amount),0) as total FROM receipts', []);
    const exp = await get('SELECT COALESCE(SUM(amount),0) as total FROM expenses', []);
    const totalReceipts = rec?.total || 0;
    const totalExpenses = exp?.total || 0;
    const bankBalance = totalReceipts - totalExpenses;
    res.json({ totalReceipts, totalExpenses, bankBalance });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---- Analytics overview (used by Dashboard) ----
app.get('/api/analytics/overview', authMiddleware, async (req, res) => {
  try {
    async function tableExists(name) {
      try { const row = await get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [name]); return !!row; }
      catch { return false; }
    }
    async function countIfExists(table) {
      if (!(await tableExists(table))) return 0;
      try { const r = await get(`SELECT COUNT(*) as c FROM ${table}`); return (r && r.c) || 0; } catch { return 0; }
    }
    const [students, teachers, staff] = await Promise.all([
      countIfExists('students'),
      countIfExists('teachers'),
      countIfExists('staff'),
    ]);

    let studPresent = 0, teachPresent = 0, staffPresent = 0;
    const hasAttendance = await tableExists('attendance_logs');
    if (hasAttendance) {
      const today = new Date().toISOString().slice(0,10);
      try { const r = await get("SELECT COUNT(*) as c FROM attendance_logs WHERE entity_type='student' AND date=? AND status='Present'", [today]); studPresent = r?.c || 0; } catch {}
      try { const r = await get("SELECT COUNT(*) as c FROM attendance_logs WHERE entity_type='teacher' AND date=? AND status='Present'", [today]); teachPresent = r?.c || 0; } catch {}
      try { const r = await get("SELECT COUNT(*) as c FROM attendance_logs WHERE entity_type='staff' AND date=? AND status='Present'", [today]); staffPresent = r?.c || 0; } catch {}
    }

    res.json({
      totals: { students, teachers, staff },
      attendanceToday: { students: studPresent, teachers: teachPresent, staff: staffPresent },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
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
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexPath = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  console.error('index.html not found at', indexPath);
  return res.status(500).send('Client build not found');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

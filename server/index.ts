// server/index.ts
import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { handleDemo } from "./routes/demo";

dotenv.config();

export function createServer() {
  const app = express();

  app.use(express.json());
  app.use(cors());

  // --- SQLite setup ---
  const DB_PATH = process.env.DB_PATH || "./dev.sqlite";
  const db = new sqlite3.Database(DB_PATH);

  // Promisified helpers for sqlite3
  const run = (sql: string, params: any[] = []) =>
    new Promise<{ lastID: number; changes: number }>((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: (this as any).lastID, changes: (this as any).changes });
      });

  // ---- Staff (non-teaching) endpoints ----
  app.get("/api/staff", authMiddleware, async (req, res) => {
    try {
      const rows = await all("SELECT * FROM staff ORDER BY id DESC");
      res.json(rows);
    } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
  });
  app.post("/api/staff", authMiddleware, async (req, res) => {
    try {
      const { first_name, last_name, title, email, phone } = req.body || {};
      if (!first_name || !last_name) return res.status(400).json({ error: "First and last name are required" });
      const r = await run("INSERT INTO staff (first_name, last_name, title, email, phone) VALUES (?,?,?,?,?)", [first_name, last_name, title || null, email || null, phone || null]);
      const row = await get("SELECT * FROM staff WHERE id = ?", [r.lastID]);
      res.json(row);
    } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
  });
  app.put("/api/staff/:id", authMiddleware, async (req, res) => {
    try {
      const { first_name, last_name, title, email, phone } = req.body || {};
      await run("UPDATE staff SET first_name=?, last_name=?, title=?, email=?, phone=? WHERE id=?", [first_name, last_name, title || null, email || null, phone || null, req.params.id]);
      const row = await get("SELECT * FROM staff WHERE id = ?", [req.params.id]);
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
  });
  app.delete("/api/staff/:id", authMiddleware, async (req, res) => {
    try { await run("DELETE FROM staff WHERE id = ?", [req.params.id]); res.json({ success: true }); }
    catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
  });

  // ---- Attendance endpoints ----
  app.post("/api/attendance/mark", authMiddleware, async (req, res) => {
    try {
      const { entity_type, entity_id, date, status, remarks } = req.body || {};
      if (!entity_type || !entity_id || !status) return res.status(400).json({ error: "entity_type, entity_id, status required" });
      const d = date || new Date().toISOString().slice(0,10);
      await run(
        "INSERT OR REPLACE INTO attendance_logs (entity_type, entity_id, date, status, remarks) VALUES (?, ?, ?, ?, ?)",
        [String(entity_type), Number(entity_id), d, String(status), remarks || null]
      );
      const row = await get("SELECT * FROM attendance_logs WHERE entity_type=? AND entity_id=? AND date=?", [String(entity_type), Number(entity_id), d]);
      res.json(row);
    } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
  });
  app.get("/api/attendance/today", authMiddleware, async (req, res) => {
    try {
      const type = (req.query.type as string) || "student";
      const d = new Date().toISOString().slice(0,10);
      let rows: any[] = [];
      if (type === "student") {
        rows = await all(
          `SELECT a.*, s.first_name || ' ' || s.last_name as name
           FROM attendance_logs a JOIN students s ON s.id = a.entity_id
           WHERE a.entity_type='student' AND a.date = ?`, [d]
        );
      } else if (type === "teacher") {
        rows = await all(
          `SELECT a.*, t.first_name || ' ' || t.last_name as name
           FROM attendance_logs a JOIN teachers t ON t.id = a.entity_id
           WHERE a.entity_type='teacher' AND a.date = ?`, [d]
        );
      } else {
        rows = await all(
          `SELECT a.*, st.first_name || ' ' || st.last_name as name
           FROM attendance_logs a JOIN staff st ON st.id = a.entity_id
           WHERE a.entity_type='staff' AND a.date = ?`, [d]
        );
      }
      res.json(rows);
    } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
  });

  // ---- Analytics overview ----
  app.get("/api/analytics/overview", authMiddleware, async (req, res) => {
    try {
      const [studentCount, teacherCount, staffCount] = await Promise.all([
        get<{ c: number }>("SELECT COUNT(*) as c FROM students", []),
        get<{ c: number }>("SELECT COUNT(*) as c FROM teachers", []),
        get<{ c: number }>("SELECT COUNT(*) as c FROM staff", []),
      ]);
      const today = new Date().toISOString().slice(0,10);
      const [studPresent, teachPresent, staffPresent] = await Promise.all([
        get<{ c: number }>("SELECT COUNT(*) as c FROM attendance_logs WHERE entity_type='student' AND date=? AND status='Present'", [today]),
        get<{ c: number }>("SELECT COUNT(*) as c FROM attendance_logs WHERE entity_type='teacher' AND date=? AND status='Present'", [today]),
        get<{ c: number }>("SELECT COUNT(*) as c FROM attendance_logs WHERE entity_type='staff' AND date=? AND status='Present'", [today]),
      ]);
      const finance = await get<any>("SELECT 1"); // placeholder if needed
      res.json({
        totals: {
          students: studentCount?.c || 0,
          teachers: teacherCount?.c || 0,
          staff: staffCount?.c || 0,
        },
        attendanceToday: {
          students: studPresent?.c || 0,
          teachers: teachPresent?.c || 0,
          staff: staffPresent?.c || 0,
        },
      });
    } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
  });
    });

  // ---- Timetable endpoints ----
  // Create or update an entry
  app.post("/api/timetable", authMiddleware, async (req, res) => {
    try {
      const { id, class_id, teacher_id, subject, day_of_week, start_time, end_time, room } = req.body || {};
      if (!class_id && !teacher_id) return res.status(400).json({ error: "class_id or teacher_id required" });
      if (!subject || !day_of_week || !start_time || !end_time) return res.status(400).json({ error: "Missing fields" });
      if (String(start_time) >= String(end_time)) return res.status(400).json({ error: "start_time must be before end_time" });

      // --- Overlap validation (same day, same class or teacher) ---
      const day = Number(day_of_week);
      async function findConflictsForClass() {
        if (!class_id) return [] as any[];
        return await all(
          `SELECT * FROM timetable_entries
           WHERE day_of_week = ?
             AND class_id = ?
             AND (NOT (end_time <= ? OR start_time >= ?))
             ${id ? "AND id != ?" : ""}`,
          id ? [day, class_id, start_time, end_time, id] : [day, class_id, start_time, end_time]
        );
      }
      async function findConflictsForTeacher() {
        if (!teacher_id) return [] as any[];
        return await all(
          `SELECT * FROM timetable_entries
           WHERE day_of_week = ?
             AND teacher_id = ?
             AND (NOT (end_time <= ? OR start_time >= ?))
             ${id ? "AND id != ?" : ""}`,
          id ? [day, teacher_id, start_time, end_time, id] : [day, teacher_id, start_time, end_time]
        );
      }

      const [classConflicts, teacherConflicts] = await Promise.all([
        findConflictsForClass(),
        findConflictsForTeacher(),
      ]);
      if ((classConflicts && classConflicts.length) || (teacherConflicts && teacherConflicts.length)) {
        const c = (classConflicts && classConflicts[0]) || (teacherConflicts && teacherConflicts[0]);
        const msg = c
          ? `Overlaps with entry ${c.subject ? `'${c.subject}' ` : ""}from ${c.start_time} to ${c.end_time}`
          : "Overlaps with an existing timetable entry";
        return res.status(400).json({ error: msg });
      }

      if (id) {
        await run(
          `UPDATE timetable_entries SET class_id=?, teacher_id=?, subject=?, day_of_week=?, start_time=?, end_time=?, room=? WHERE id=?`,
          [class_id || null, teacher_id || null, subject, Number(day_of_week), start_time, end_time, room || null, id]
        );
        const row = await get("SELECT * FROM timetable_entries WHERE id = ?", [id]);
        return res.json(row);
      } else {
        const r = await run(
          `INSERT INTO timetable_entries (class_id, teacher_id, subject, day_of_week, start_time, end_time, room) VALUES (?,?,?,?,?,?,?)`,
          [class_id || null, teacher_id || null, subject, Number(day_of_week), start_time, end_time, room || null]
        );
        const row = await get("SELECT * FROM timetable_entries WHERE id = ?", [r.lastID]);
        return res.json(row);
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });
  
  app.delete("/api/timetable/:id", authMiddleware, async (req, res) => {
    try {
      await run("DELETE FROM timetable_entries WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/timetable/teacher/:teacherId", authMiddleware, async (req, res) => {
    try {
      const rows = await all(
        `SELECT t.*, c.name as class_name
         FROM timetable_entries t
         LEFT JOIN classes c ON c.id = t.class_id
         WHERE t.teacher_id = ?
         ORDER BY day_of_week ASC, start_time ASC`,
        [req.params.teacherId]
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/timetable/class/:classId", authMiddleware, async (req, res) => {
    try {
      const rows = await all(
        `SELECT t.*, (tr.first_name || ' ' || tr.last_name) as teacher_name
         FROM timetable_entries t
         LEFT JOIN teachers tr ON tr.id = t.teacher_id
         WHERE t.class_id = ?
         ORDER BY day_of_week ASC, start_time ASC`,
        [req.params.classId]
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });
  const get = <T = any>(sql: string, params: any[] = []) =>
    new Promise<T | undefined>((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  const all = <T = any>(sql: string, params: any[] = []) =>
    new Promise<T[]>((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });

  // Initialize database schema
  (async () => {
    await run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'Admin'
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

    // Migrate: ensure 'role' column exists on users
    const userCols = await all<{ name: string }>(`PRAGMA table_info(users)`);
    if (!userCols.some((c) => c.name === "role")) {
      await run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'Admin'`);
    }

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
      guardian_id INTEGER,
      class_stream_id INTEGER,
      FOREIGN KEY(class_id) REFERENCES classes(id)
    );`);

    // Add class_stream_id to students if missing
    const studentCols = await all<{ name: string }>(`PRAGMA table_info(students)`);
    if (!studentCols.some((c) => c.name === "class_stream_id")) {
      await run(`ALTER TABLE students ADD COLUMN class_stream_id INTEGER`);
    }

    // Guardians table
    await run(`CREATE TABLE IF NOT EXISTS guardians (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT
    );`);

    // Subjects table
    await run(`CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE
    );`);

    // Class streams (e.g., A, B, Yellow, Green) tied to a class
    await run(`CREATE TABLE IF NOT EXISTS class_streams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(class_id, name),
      FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
    );`);

    // Student-Subject assignments
    await run(`CREATE TABLE IF NOT EXISTS student_subjects (
      student_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      PRIMARY KEY(student_id, subject_id),
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );`);

    // Class-Subject mapping
    await run(`CREATE TABLE IF NOT EXISTS class_subjects (
      class_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      PRIMARY KEY(class_id, subject_id),
      FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );`);

    // Teacher-Subject mapping
    await run(`CREATE TABLE IF NOT EXISTS teacher_subjects (
      teacher_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      PRIMARY KEY(teacher_id, subject_id),
      FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );`);

    // Teachers table
    await run(`CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT,
      last_name TEXT,
      email TEXT UNIQUE,
      phone TEXT,
      subject TEXT
    );`);

    // Link table: many-to-many between teachers and classes
    await run(`CREATE TABLE IF NOT EXISTS teacher_classes (
      teacher_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      PRIMARY KEY (teacher_id, class_id),
      FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
    );`);

    await run(`CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      amount REAL,
      title TEXT,
      status TEXT DEFAULT 'Pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(student_id) REFERENCES students(id)
    );`);

    // Finance: receipts and expenses
    await run(`CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      amount REAL NOT NULL,
      method TEXT,               -- e.g., Cash, Card, Bank Transfer
      reference TEXT,            -- reference number / note
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(invoice_id) REFERENCES invoices(id)
    );`);

    await run(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,             -- e.g., Utilities, Salaries, Supplies
      created_at TEXT DEFAULT (datetime('now'))
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
  })().catch((e) => console.error("DB init error", e));

  // --- Auth helpers ---
  const SECRET = process.env.JWT_SECRET || "dev_secret";
  function signToken(payload: any) {
    return jwt.sign(payload, SECRET, { expiresIn: "1d" });
  }
  function authMiddleware(req: any, res: any, next: any) {
    const auth = req.headers["authorization"] as string | undefined;
    if (!auth) return res.status(401).json({ error: "Missing Authorization header" });
    const token = auth.split(" ")[1];
    try {
      const decoded = jwt.verify(token, SECRET);
      req.user = decoded;
      next();
    } catch (e) {
      return res.status(403).json({ error: "Invalid token" });
    }
  }

  // --- Auth routes ---
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, password, role } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      const hashed = await bcrypt.hash(password, 10);
      const result = await run("INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)", [name || "", email, hashed, role || "Admin"]);
      const user = await get<any>("SELECT id, name, email, role FROM users WHERE id = ?", [result.lastID]);
      const token = signToken({ id: user?.id, email: user?.email, role: user?.role });
      return res.json({ user, token });
    } catch (err: any) {
      if (err?.message?.includes("SQLITE_CONSTRAINT")) return res.status(400).json({ error: "Email already exists" });
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // ---- Teacher-Subject mapping ----
  app.get("/api/teachers/:id/subjects", authMiddleware, async (req, res) => {
    try {
      const rows = await all(
        `SELECT s.* FROM teacher_subjects ts JOIN subjects s ON s.id = ts.subject_id WHERE ts.teacher_id = ? ORDER BY s.name ASC`,
        [req.params.id]
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });
  app.post("/api/teachers/:id/subjects", authMiddleware, async (req, res) => {
    try {
      const { subject_id } = req.body || {};
      if (!subject_id) return res.status(400).json({ error: "subject_id required" });
      await run("INSERT OR IGNORE INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)", [req.params.id, subject_id]);
      const row = await get("SELECT * FROM subjects WHERE id = ?", [subject_id]);
      res.json(row);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });
  app.delete("/api/teachers/:id/subjects/:subjectId", authMiddleware, async (req, res) => {
    try {
      await run("DELETE FROM teacher_subjects WHERE teacher_id = ? AND subject_id = ?", [req.params.id, req.params.subjectId]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const user = await get<any>("SELECT * FROM users WHERE email = ?", [email]);
      if (!user) return res.status(401).json({ error: "Invalid credentials" });
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });
      const token = signToken({ id: user.id, email: user.email, role: user.role });
      return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Back-compat simple routes (mirror auth handlers)
  app.post("/api/register", async (req, res) => {
    try {
      const { name, email, password, role } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      const hashed = await bcrypt.hash(password, 10);
      const result = await run("INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)", [name || "", email, hashed, role || "Admin"]);
      const user = await get<any>("SELECT id, name, email, role FROM users WHERE id = ?", [result.lastID]);
      const token = signToken({ id: user?.id, email: user?.email, role: user?.role });
      return res.json({ user, token });
    } catch (err: any) {
      if (err?.message?.includes("SQLITE_CONSTRAINT")) return res.status(400).json({ error: "Email already exists" });
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const user = await get<any>("SELECT * FROM users WHERE email = ?", [email]);
      if (!user) return res.status(401).json({ error: "Invalid credentials" });
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });
      const token = signToken({ id: user.id, email: user.email, role: user.role });
      return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Health
  app.get("/health", (req, res) => res.json({ ok: true }));

  // --- Demo route (used by client/pages/Index.tsx) ---
  app.get("/api/demo", handleDemo);

  // --- Example protected route ---
  app.get("/api/hello", (req, res) => {
    res.json({ message: "Hello from Express + SQLite backend!" });
  });

  // ---- Students endpoints ----
  app.get("/api/students", authMiddleware, async (req, res) => {
    try {
      const rows = await all(`SELECT s.*, c.name as class_name, cs.name as stream_name
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN class_streams cs ON cs.id = s.class_stream_id`);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Create student with optional guardian, stream, and subjects
  app.post("/api/students", authMiddleware, async (req, res) => {
    try {
      const { first_name, last_name, class_id, class_stream_id, guardian, subject_ids } = req.body || {};
      if (!first_name || !last_name || !class_id) return res.status(400).json({ error: "first_name, last_name, class_id required" });

      // Create guardian if provided
      let guardianId: number | null = null;
      if (guardian && (guardian.first_name || guardian.last_name)) {
        const g = await run(
          `INSERT INTO guardians (first_name, last_name, phone, email, address) VALUES (?,?,?,?,?)`,
          [guardian.first_name || "", guardian.last_name || "", guardian.phone || null, guardian.email || null, guardian.address || null]
        );
        guardianId = g.lastID;
      }

      const r = await run(
        "INSERT INTO students (first_name, last_name, class_id, guardian_id, class_stream_id) VALUES (?, ?, ?, ?, ?)",
        [first_name, last_name, class_id, guardianId, class_stream_id || null]
      );
      const studentId = r.lastID;

      if (Array.isArray(subject_ids) && subject_ids.length > 0) {
        for (const sid of subject_ids) {
          await run("INSERT OR IGNORE INTO student_subjects (student_id, subject_id) VALUES (?, ?)", [studentId, Number(sid)]);
        }
      }

      const student = await get("SELECT * FROM students WHERE id = ?", [studentId]);
      res.json(student);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Get student with guardian and subjects
  app.get("/api/students/:id", authMiddleware, async (req, res) => {
    try {
      const student = await get<any>(`SELECT s.*, c.name as class_name, cs.name as stream_name
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN class_streams cs ON cs.id = s.class_stream_id
        WHERE s.id = ?`, [req.params.id]);
      if (!student) return res.status(404).json({ error: "Not found" });
      const guardian = student.guardian_id ? await get(`SELECT * FROM guardians WHERE id = ?`, [student.guardian_id]) : null;
      const subjects = await all(`SELECT sub.* FROM student_subjects ss JOIN subjects sub ON sub.id = ss.subject_id WHERE ss.student_id = ?`, [req.params.id]);
      res.json({ ...student, guardian, subjects });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/students/:id", authMiddleware, async (req, res) => {
    try {
      const { first_name, last_name, class_id } = req.body || {};
      await run("UPDATE students SET first_name = ?, last_name = ?, class_id = ? WHERE id = ?", [first_name, last_name, class_id, req.params.id]);
      const student = await get("SELECT * FROM students WHERE id = ?", [req.params.id]);
      res.json(student);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/students/:id", authMiddleware, async (req, res) => {
    try {
      await run("DELETE FROM students WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // ---- Guardians endpoints ----
  app.get("/api/guardians", authMiddleware, async (req, res) => {
    try {
      const rows = await all("SELECT * FROM guardians ORDER BY id DESC");
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });
  app.post("/api/guardians", authMiddleware, async (req, res) => {
    try {
      const { first_name, last_name, phone, email, address } = req.body || {};
      if (!first_name && !last_name) return res.status(400).json({ error: "Name required" });
      const r = await run("INSERT INTO guardians (first_name, last_name, phone, email, address) VALUES (?,?,?,?,?)", [first_name || "", last_name || "", phone || null, email || null, address || null]);
      const row = await get("SELECT * FROM guardians WHERE id = ?", [r.lastID]);
      res.json(row);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // ---- Subjects endpoints ----
  app.get("/api/subjects", authMiddleware, async (req, res) => {
    try {
      const rows = await all("SELECT * FROM subjects ORDER BY name ASC");
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });
  app.post("/api/subjects", authMiddleware, async (req, res) => {
    try {
      const { name } = req.body || {};
      if (!name) return res.status(400).json({ error: "name required" });
      const r = await run("INSERT OR IGNORE INTO subjects (name) VALUES (?)", [name]);
      const row = await get("SELECT * FROM subjects WHERE id = ?", [r.lastID]);
      res.json(row || (await get("SELECT * FROM subjects WHERE name = ?", [name])));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Delete a subject if not referenced
  app.delete("/api/subjects/:id", authMiddleware, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const ref = await get<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM student_subjects WHERE subject_id = ?",
        [id]
      );
      if ((ref?.cnt || 0) > 0) {
        return res.status(400).json({ error: "Cannot delete: subject is assigned to students" });
      }
      await run("DELETE FROM subjects WHERE id = ?", [id]);
      return res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // ---- Class streams endpoints ----
  app.get("/api/class-streams", authMiddleware, async (req, res) => {
    try {
      const rows = await all(`SELECT cs.*, c.name as class_name FROM class_streams cs JOIN classes c ON c.id = cs.class_id ORDER BY c.name, cs.name`);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });
  app.post("/api/class-streams", authMiddleware, async (req, res) => {
    try {
      const { class_id, name } = req.body || {};
      if (!class_id || !name) return res.status(400).json({ error: "class_id and name required" });
      const r = await run("INSERT OR IGNORE INTO class_streams (class_id, name) VALUES (?,?)", [class_id, name]);
      const row = await get("SELECT * FROM class_streams WHERE id = ?", [r.lastID]);
      res.json(row || (await get("SELECT * FROM class_streams WHERE class_id = ? AND name = ?", [class_id, name])));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // ---- Classes endpoints ----
  app.get("/api/classes", authMiddleware, async (req, res) => {
    try {
      const rows = await all("SELECT * FROM classes");
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/classes", authMiddleware, async (req, res) => {
    try {
      const { name, description } = req.body || {};
      const r = await run("INSERT INTO classes (name, description) VALUES (?, ?)", [name, description]);
      const cls = await get("SELECT * FROM classes WHERE id = ?", [r.lastID]);
      res.json(cls);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // ---- Class-Subject mapping ----
  app.get("/api/classes/:id/subjects", authMiddleware, async (req, res) => {
    try {
      const rows = await all(
        `SELECT s.* FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id WHERE cs.class_id = ? ORDER BY s.name ASC`,
        [req.params.id]
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });
  app.post("/api/classes/:id/subjects", authMiddleware, async (req, res) => {
    try {
      const { subject_id } = req.body || {};
      if (!subject_id) return res.status(400).json({ error: "subject_id required" });
      await run("INSERT OR IGNORE INTO class_subjects (class_id, subject_id) VALUES (?, ?)", [req.params.id, subject_id]);
      const row = await get("SELECT * FROM subjects WHERE id = ?", [subject_id]);
      res.json(row);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });
  app.delete("/api/classes/:id/subjects/:subjectId", authMiddleware, async (req, res) => {
    try {
      await run("DELETE FROM class_subjects WHERE class_id = ? AND subject_id = ?", [req.params.id, req.params.subjectId]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // ---- Teachers endpoints ----
  app.get("/api/teachers", authMiddleware, async (req, res) => {
    try {
      const rows = await all("SELECT * FROM teachers ORDER BY id DESC");
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/teachers", authMiddleware, async (req, res) => {
    try {
      const { first_name, last_name, email, phone, subject } = req.body || {};
      if (!first_name || !last_name) return res.status(400).json({ error: "First and last name are required" });
      const r = await run(
        "INSERT INTO teachers (first_name, last_name, email, phone, subject) VALUES (?, ?, ?, ?, ?)",
        [first_name, last_name, email || null, phone || null, subject || null]
      );
      const teacher = await get("SELECT * FROM teachers WHERE id = ?", [r.lastID]);
      res.json(teacher);
    } catch (err: any) {
      if (err?.message?.includes("SQLITE_CONSTRAINT")) return res.status(400).json({ error: "Email already exists" });
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/teachers/:id", authMiddleware, async (req, res) => {
    try {
      const { first_name, last_name, email, phone, subject } = req.body || {};
      await run(
        "UPDATE teachers SET first_name = ?, last_name = ?, email = ?, phone = ?, subject = ? WHERE id = ?",
        [first_name, last_name, email || null, phone || null, subject || null, req.params.id]
      );
      const teacher = await get("SELECT * FROM teachers WHERE id = ?", [req.params.id]);
      if (!teacher) return res.status(404).json({ error: "Not found" });
      res.json(teacher);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/teachers/:id", authMiddleware, async (req, res) => {
    try {
      await run("DELETE FROM teachers WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // ---- Teacher-Class assignments ----
  // List classes for a teacher
  app.get("/api/teachers/:id/classes", authMiddleware, async (req, res) => {
    try {
      const rows = await all(
        `SELECT tc.class_id as id, c.name, c.description
         FROM teacher_classes tc
         JOIN classes c ON c.id = tc.class_id
         WHERE tc.teacher_id = ?
         ORDER BY c.name ASC`,
        [req.params.id]
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Assign a class to a teacher
  app.post("/api/teachers/:id/classes", authMiddleware, async (req, res) => {
    try {
      const { class_id } = req.body || {};
      if (!class_id) return res.status(400).json({ error: "class_id is required" });
      await run("INSERT OR IGNORE INTO teacher_classes (teacher_id, class_id) VALUES (?, ?)", [req.params.id, class_id]);
      const row = await get(
        `SELECT c.id, c.name, c.description FROM classes c WHERE c.id = ?`,
        [class_id]
      );
      res.json(row);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Remove assignment
  app.delete("/api/teachers/:id/classes/:classId", authMiddleware, async (req, res) => {
    try {
      await run("DELETE FROM teacher_classes WHERE teacher_id = ? AND class_id = ?", [req.params.id, req.params.classId]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // ---- Invoices endpoints ----
  app.get("/api/invoices", authMiddleware, async (req, res) => {
    try {
      const rows = await all("SELECT * FROM invoices ORDER BY created_at DESC");
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/invoices", authMiddleware, async (req, res) => {
    try {
      const { student_id, amount, status, title } = req.body || {};
      const r = await run("INSERT INTO invoices (student_id, amount, status, title) VALUES (?, ?, ?, ?)", [student_id, amount, status || "Pending", title || "Invoice"]);
      const inv = await get("SELECT * FROM invoices WHERE id = ?", [r.lastID]);
      res.json(inv);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // ---- Receipts (payments) ----
  app.get("/api/receipts", authMiddleware, async (req, res) => {
    try {
      const rows = await all("SELECT * FROM receipts ORDER BY created_at DESC");
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/receipts", authMiddleware, async (req, res) => {
    try {
      const { invoice_id, amount, method, reference } = req.body || {};
      if (!amount || Number(amount) <= 0) return res.status(400).json({ error: "Amount must be > 0" });
      const r = await run(
        "INSERT INTO receipts (invoice_id, amount, method, reference) VALUES (?, ?, ?, ?)",
        [invoice_id || null, Number(amount), method || null, reference || null]
      );

      // If linked to an invoice, update invoice status based on total paid
      if (invoice_id) {
        const inv = await get<any>("SELECT amount FROM invoices WHERE id = ?", [invoice_id]);
        if (inv) {
          const paidRow = await get<{ total: number }>(
            "SELECT SUM(amount) as total FROM receipts WHERE invoice_id = ?",
            [invoice_id]
          );
          const totalPaid = paidRow?.total || 0;
          const newStatus = totalPaid >= inv.amount ? "Paid" : "Under Review";
          await run("UPDATE invoices SET status = ? WHERE id = ?", [newStatus, invoice_id]);
        }
      }

      const rec = await get("SELECT * FROM receipts WHERE id = ?", [r.lastID]);
      res.json(rec);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // ---- Expenses ----
  app.get("/api/expenses", authMiddleware, async (req, res) => {
    try {
      const rows = await all("SELECT * FROM expenses ORDER BY created_at DESC");
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/expenses", authMiddleware, async (req, res) => {
    try {
      const { title, amount, category } = req.body || {};
      if (!title || !amount || Number(amount) <= 0)
        return res.status(400).json({ error: "Title and amount are required" });
      const r = await run(
        "INSERT INTO expenses (title, amount, category) VALUES (?, ?, ?)",
        [title, Number(amount), category || null]
      );
      const exp = await get("SELECT * FROM expenses WHERE id = ?", [r.lastID]);
      res.json(exp);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // ---- Finance summary (mini P&L + bank balance) ----
  app.get("/api/finance/summary", authMiddleware, async (req, res) => {
    try {
      const rec = await get<{ total: number }>("SELECT COALESCE(SUM(amount),0) as total FROM receipts", []);
      const exp = await get<{ total: number }>("SELECT COALESCE(SUM(amount),0) as total FROM expenses", []);
      const totalReceipts = rec?.total || 0;
      const totalExpenses = exp?.total || 0;
      const bankBalance = totalReceipts - totalExpenses;
      res.json({ totalReceipts, totalExpenses, bankBalance });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  return app;
}

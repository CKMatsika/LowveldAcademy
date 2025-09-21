import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const DB_PATH = process.env.DB_PATH || "./dev.sqlite";

const db = new sqlite3.Database(DB_PATH);

function run(sql: string, params: any[] = []) {
  return new Promise<{ lastID: number; changes: number }>((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: (this as any).lastID, changes: (this as any).changes });
    });
  });
}
function get<T = any>(sql: string, params: any[] = []) {
  return new Promise<T | undefined>((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
}

async function seed() {
  console.log(`Seeding database at ${DB_PATH} ...`);

  // Ensure base tables exist (in case server hasn't run yet)
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'Admin'
  );`);

  // Migration: ensure 'role' column exists
  const cols: { name: string }[] = await new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(users)`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as any);
    });
  });
  if (!cols.some((c) => c.name === 'role')) {
    await run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'Admin'`);
  }

  await run(`CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT
  );`);

  // Admin user
  const adminEmail = "admin@lowveld.local";
  const existingAdmin = await get<{ id: number }>("SELECT id FROM users WHERE email = ?", [adminEmail]);
  if (!existingAdmin) {
    const hashed = await bcrypt.hash("123456", 10);
    await run("INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)", [
      "Administrator",
      adminEmail,
      hashed,
      "Admin",
    ]);
    console.log("✔ Created admin user:", adminEmail, "password: 123456");
  } else {
    console.log("• Admin user already exists:", adminEmail);
  }

  // Sample classes
  const classes = [
    { name: "Grade 7 - A", description: "Senior Phase" },
    { name: "Grade 8 - A", description: "Senior Phase" },
    { name: "Grade 9 - A", description: "Senior Phase" },
  ];

  for (const c of classes) {
    const row = await get("SELECT id FROM classes WHERE name = ?", [c.name]);
    if (!row) {
      await run("INSERT INTO classes (name, description) VALUES (?, ?)", [c.name, c.description]);
      console.log("✔ Added class:", c.name);
    } else {
      console.log("• Class exists:", c.name);
    }
  }

  console.log("Done seeding.");
  db.close();
}

seed().catch((e) => {
  console.error("Seed error", e);
  db.close();
  process.exit(1);
});

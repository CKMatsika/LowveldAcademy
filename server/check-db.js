const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./dev.sqlite');

console.log('Database tables:');
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
  if (err) console.error(err);
  else console.log(rows.map(r => r.name));
  db.close();
});

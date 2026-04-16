const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'appointments.db');
const db = new sqlite3.Database(dbPath);

// Создание таблицы, если её нет
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientName TEXT NOT NULL,
      date TEXT NOT NULL,
      master TEXT NOT NULL,
      service TEXT NOT NULL,
      phone TEXT NOT NULL,
      tattooIdea TEXT,
      tattooSize TEXT,
      bodyPlacement TEXT,
      status TEXT DEFAULT 'pending',
      createdAt TEXT NOT NULL,
      completedAt TEXT,
      canceledAt TEXT
    )
  `);
});

module.exports = db;
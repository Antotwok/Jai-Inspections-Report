const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database/reports.db');

db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS clients(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      address TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reports(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_no TEXT,
      report_date TEXT,
      client_id INTEGER,
      source TEXT,
      film TEXT,
      density TEXT,
      sensitivity TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS report_rows(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER,
      description TEXT,
      thickness TEXT,
      location TEXT,
      film_size TEXT,
      area TEXT,
      observation TEXT,
      result TEXT
    )
  `);

});

console.log("Database Created");
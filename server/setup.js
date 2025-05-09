/**
 * Database setup script for Race Control application
 * Run with: npm run setup
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Create db directory if it doesn't exist
const dbDir = path.join(__dirname, '..', 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Database file path
const dbPath = path.join(dbDir, 'race-control.db');

// Create or open database
const db = new sqlite3.Database(dbPath);

// Create tables
db.serialize(() => {
  // Drop existing tables if they exist
  db.run('DROP TABLE IF EXISTS race_results');
  db.run('DROP TABLE IF EXISTS runners');
  db.run('DROP TABLE IF EXISTS races');
  db.run('DROP TABLE IF EXISTS checkpoints');
  db.run('DROP TABLE IF EXISTS checkpoint_results');

  // Create races table
  db.run(`
    CREATE TABLE races (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      start_time INTEGER,
      status TEXT DEFAULT 'pending',
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Create runners table
  db.run(`
    CREATE TABLE runners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      race_id INTEGER NOT NULL,
      bib_number INTEGER NOT NULL,
      name TEXT,
      FOREIGN KEY (race_id) REFERENCES races(id),
      UNIQUE(race_id, bib_number)
    )
  `);

  // Create race_results table
  db.run(`
    CREATE TABLE race_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      race_id INTEGER NOT NULL,
      runner_id INTEGER NOT NULL,
      finish_time INTEGER,
      chip_time INTEGER,
      position INTEGER,
      device_id TEXT,
      sync_status TEXT DEFAULT 'pending',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (race_id) REFERENCES races(id),
      FOREIGN KEY (runner_id) REFERENCES runners(id),
      UNIQUE(race_id, runner_id)
    )
  `);

  // Create checkpoints table
  db.run(`
    CREATE TABLE checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      race_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      distance REAL,
      location TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (race_id) REFERENCES races(id)
    )
  `);

  // Create checkpoint_results table
  db.run(`
    CREATE TABLE checkpoint_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkpoint_id INTEGER NOT NULL,
      runner_id INTEGER NOT NULL,
      passing_time INTEGER NOT NULL,
      device_id TEXT,
      sync_status TEXT DEFAULT 'pending',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id),
      FOREIGN KEY (runner_id) REFERENCES runners(id),
      UNIQUE(checkpoint_id, runner_id)
    )
  `);

  // Insert sample data
  db.run(`
    INSERT INTO races (name, description, status)
    VALUES ('Pub-to-Pub 2025', 'A winter race between local pubs', 'pending')
  `);

  // Create some sample runners
  const sampleRunners = [
    { bib: 1, name: 'John Smith' },
    { bib: 2, name: 'Jane Doe' },
    { bib: 3, name: 'Sam Johnson' },
    { bib: 4, name: 'Emma Wilson' },
    { bib: 5, name: 'David Brown' }
  ];

  const insertRunner = db.prepare(`
    INSERT INTO runners (race_id, bib_number, name)
    VALUES (1, ?, ?)
  `);

  sampleRunners.forEach(runner => {
    insertRunner.run(runner.bib, runner.name);
  });

  insertRunner.finalize();

  console.log('Database setup complete');
});

// Close the database connection
db.close((err) => {
  if (err) {
    console.error('Error closing database:', err.message);
  } else {
    console.log('Database connection closed');
  }
});
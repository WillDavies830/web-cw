-- Race Control - Portsmouth Joggers' Club
-- Database Schema

PRAGMA foreign_keys = ON;

-- Users table for authentication (race directors, admins)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  role TEXT CHECK (role IN ('admin', 'director', 'volunteer')) NOT NULL DEFAULT 'volunteer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Races table
CREATE TABLE IF NOT EXISTS races (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  distance REAL,
  distance_unit TEXT CHECK (distance_unit IN ('km', 'mi', 'other')) DEFAULT 'km',
  race_date DATE,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  status TEXT CHECK (status IN ('planned', 'active', 'completed', 'cancelled')) NOT NULL DEFAULT 'planned',
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Race settings and configuration
CREATE TABLE IF NOT EXISTS race_settings (
  race_id INTEGER PRIMARY KEY,
  bib_number_required BOOLEAN NOT NULL DEFAULT 1,
  allow_unregistered_runners BOOLEAN NOT NULL DEFAULT 0,
  collect_additional_data BOOLEAN NOT NULL DEFAULT 0,
  start_method TEXT CHECK (start_method IN ('mass', 'wave', 'individual')) NOT NULL DEFAULT 'mass',
  time_format TEXT CHECK (time_format IN ('hh:mm:ss', 'mm:ss.ms')) NOT NULL DEFAULT 'hh:mm:ss',
  display_pace BOOLEAN NOT NULL DEFAULT 1,
  pace_unit TEXT CHECK (pace_unit IN ('min/km', 'min/mi')) NOT NULL DEFAULT 'min/km',
  auto_assign_places BOOLEAN NOT NULL DEFAULT 1,
  show_age_category_results BOOLEAN NOT NULL DEFAULT 0,
  show_gender_results BOOLEAN NOT NULL DEFAULT 1,
  FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE
);

-- Runners table (participants in any race)
CREATE TABLE IF NOT EXISTS runners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT,
  last_name TEXT,
  gender TEXT,
  date_of_birth DATE,
  club TEXT,
  email TEXT,
  phone TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Race entries table (links runners to specific races)
CREATE TABLE IF NOT EXISTS race_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id INTEGER NOT NULL,
  runner_id INTEGER NOT NULL,
  bib_number INTEGER NOT NULL,
  status TEXT CHECK (status IN ('registered', 'checked_in', 'started', 'finished', 'DNF', 'DNS', 'DQ')) NOT NULL DEFAULT 'registered',
  category TEXT,
  team TEXT,
  is_registered_online BOOLEAN DEFAULT 0,
  registration_timestamp TIMESTAMP,
  check_in_timestamp TIMESTAMP,
  UNIQUE (race_id, bib_number),
  UNIQUE (race_id, runner_id),
  FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE,
  FOREIGN KEY (runner_id) REFERENCES runners(id) ON DELETE CASCADE
);

-- Race results table
CREATE TABLE IF NOT EXISTS race_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id INTEGER NOT NULL,
  entry_id INTEGER NOT NULL,
  bib_number INTEGER NOT NULL,
  finish_time INTEGER,  -- stored in seconds for easy calculation
  chip_time INTEGER,    -- if using chip timing
  place INTEGER,
  gender_place INTEGER,
  category_place INTEGER,
  pace REAL,
  recorded_by INTEGER,  -- user ID who recorded this result
  device_id TEXT,       -- device identifier that recorded the result
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id) REFERENCES race_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Timing points (for races with multiple checkpoints)
CREATE TABLE IF NOT EXISTS timing_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  distance REAL,
  is_start BOOLEAN DEFAULT 0,
  is_finish BOOLEAN DEFAULT 0,
  sequence_number INTEGER NOT NULL,
  FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE
);

-- Split times at timing points
CREATE TABLE IF NOT EXISTS split_times (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id INTEGER NOT NULL,
  entry_id INTEGER NOT NULL,
  timing_point_id INTEGER NOT NULL,
  bib_number INTEGER NOT NULL,
  split_time INTEGER,  -- time in seconds from race start
  recorded_by INTEGER,
  device_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id) REFERENCES race_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (timing_point_id) REFERENCES timing_points(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Devices used for timing
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL UNIQUE,
  device_name TEXT,
  device_type TEXT,
  assigned_to INTEGER,
  last_sync_time TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- Sync log for offline devices
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'result', 'runner', 'entry', etc.
  entity_id INTEGER NOT NULL,
  action TEXT CHECK (action IN ('create', 'update', 'delete')) NOT NULL,
  sync_status TEXT CHECK (sync_status IN ('pending', 'synced', 'failed')) NOT NULL DEFAULT 'pending',
  sync_timestamp TIMESTAMP,
  sync_data TEXT, -- JSON of the data to be synced
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Age categories
CREATE TABLE IF NOT EXISTS age_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  min_age INTEGER NOT NULL,
  max_age INTEGER NOT NULL,
  gender TEXT CHECK (gender IN ('M', 'F', 'X', 'all')) NOT NULL DEFAULT 'all'
);

-- System settings
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_race_entries_race_id ON race_entries (race_id);
CREATE INDEX IF NOT EXISTS idx_race_entries_runner_id ON race_entries (runner_id);
CREATE INDEX IF NOT EXISTS idx_race_entries_bib ON race_entries (race_id, bib_number);
CREATE INDEX IF NOT EXISTS idx_race_results_race_id ON race_results (race_id);
CREATE INDEX IF NOT EXISTS idx_race_results_bib ON race_results (race_id, bib_number);
CREATE INDEX IF NOT EXISTS idx_split_times_race_entry ON split_times (race_id, entry_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_device ON sync_log (device_id, sync_status);

-- Default system settings
INSERT OR IGNORE INTO system_settings (key, value, description) VALUES 
  ('club_name', 'Portsmouth Joggers'' Club', 'Name of the club'),
  ('default_time_format', 'hh:mm:ss', 'Default time format for displaying results'),
  ('default_distance_unit', 'km', 'Default unit for race distances'),
  ('default_pace_unit', 'min/km', 'Default unit for pace calculations'),
  ('allow_offline_mode', '1', 'Allow devices to work in offline mode'),
  ('sync_interval', '60', 'How often devices should sync data (in seconds)'),
  ('race_director_email', 'race-director@portsmouthjoggers.co.uk', 'Default email for race notifications');

-- Default age categories
INSERT OR IGNORE INTO age_categories (name, min_age, max_age, gender) VALUES 
  ('Under 18', 0, 17, 'all'),
  ('Senior', 18, 39, 'all'),
  ('Vet 40-49', 40, 49, 'all'),
  ('Vet 50-59', 50, 59, 'all'),
  ('Vet 60-69', 60, 69, 'all'),
  ('Vet 70+', 70, 120, 'all');

-- Triggers to update the updated_at column
CREATE TRIGGER IF NOT EXISTS users_updated_at 
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS races_updated_at 
AFTER UPDATE ON races
BEGIN
  UPDATE races SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS runners_updated_at 
AFTER UPDATE ON runners
BEGIN
  UPDATE runners SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS race_results_updated_at 
AFTER UPDATE ON race_results
BEGIN
  UPDATE race_results SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS system_settings_updated_at 
AFTER UPDATE ON system_settings
BEGIN
  UPDATE system_settings SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
END;
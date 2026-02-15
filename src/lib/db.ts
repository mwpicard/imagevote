import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(path.join(dataDir, "imagevote.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    intro_heading TEXT NOT NULL DEFAULT 'Welcome',
    intro_body TEXT NOT NULL DEFAULT 'You will be shown a series of images. For each one, share your impressions and vote.',
    outro_heading TEXT NOT NULL DEFAULT 'Thank you!',
    outro_body TEXT NOT NULL DEFAULT 'Your feedback has been recorded.',
    intro_media_filename TEXT,
    outro_media_filename TEXT,
    intro_audio_filename TEXT,
    outro_audio_filename TEXT,
    narration_timing TEXT NOT NULL DEFAULT 'simultaneous',
    voting_mode TEXT NOT NULL DEFAULT 'binary',
    language TEXT NOT NULL DEFAULT 'en',
    randomize_order INTEGER NOT NULL DEFAULT 0,
    auto_record INTEGER NOT NULL DEFAULT 0,
    auto_transcribe INTEGER NOT NULL DEFAULT 0,
    max_comparisons INTEGER,
    beta_price TEXT,
    code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    video_filename TEXT,
    audio_filename TEXT,
    label TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    participant_id TEXT NOT NULL,
    vote INTEGER,
    audio_filename TEXT,
    transcription TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS outro_recordings (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    participant_id TEXT NOT NULL,
    audio_filename TEXT NOT NULL,
    transcription TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pairwise_responses (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    participant_id TEXT NOT NULL,
    image_a_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    image_b_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    winner_id TEXT REFERENCES images(id) ON DELETE CASCADE,
    score INTEGER,
    audio_filename TEXT,
    transcription TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT,
    age INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_interests (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    participant_id TEXT NOT NULL,
    email TEXT NOT NULL,
    image_ids TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Migrations for existing databases
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN intro_media_filename TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN outro_media_filename TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN language TEXT NOT NULL DEFAULT 'en'`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN auto_record INTEGER NOT NULL DEFAULT 0`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE images ADD COLUMN audio_filename TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE participants ADD COLUMN age INTEGER`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE pairwise_responses ADD COLUMN score INTEGER`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE images ADD COLUMN caption TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE participants ADD COLUMN last_seen_at TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN auto_transcribe INTEGER NOT NULL DEFAULT 0`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN intro_audio_filename TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN outro_audio_filename TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN narration_timing TEXT NOT NULL DEFAULT 'simultaneous'`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN beta_price TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN max_comparisons INTEGER`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN preorder_url TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN intro_heading_es TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN intro_heading_ca TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN intro_body_es TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN intro_body_ca TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN outro_heading_es TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN outro_heading_ca TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN outro_body_es TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN outro_body_ca TEXT`);
} catch { /* column already exists */ }

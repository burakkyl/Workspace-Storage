import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

export const db = new DatabaseSync(config.dbFile);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  title         TEXT DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'member',   -- owner | admin | manager | member
  color         TEXT DEFAULT '#2563eb',
  provider      TEXT DEFAULT 'demo',              -- demo | microsoft
  ms_object_id  TEXT,
  ms_upn        TEXT,
  active        INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device      TEXT DEFAULT '',
  created_at  TEXT DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);

-- Her kullanicinin bagli bulut saglayicilari (OneDrive, SharePoint, Google Drive, Dropbox)
CREATE TABLE IF NOT EXISTS connections (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,                    -- onedrive | sharepoint | googledrive | dropbox
  account_label  TEXT DEFAULT '',
  status         TEXT DEFAULT 'connected',         -- connected | needs_consent | error | disconnected
  drive_id       TEXT,
  quota_total    INTEGER DEFAULT 0,
  quota_used     INTEGER DEFAULT 0,
  last_sync_at   TEXT,
  created_at     TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  code         TEXT NOT NULL,
  description  TEXT DEFAULT '',
  color        TEXT DEFAULT '#2563eb',
  status       TEXT DEFAULT 'active',              -- planning | active | on_hold | done | archived
  owner_id     TEXT NOT NULL REFERENCES users(id),
  start_date   TEXT,
  end_date     TEXT,
  storage_root TEXT DEFAULT '',                     -- ana depolamadaki kok klasor
  created_at   TEXT DEFAULT (datetime('now'))
);

-- Proje uyeligi + rol (yetkilendirme)
CREATE TABLE IF NOT EXISTS project_members (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'contributor', -- admin | planner | contributor | viewer
  granted_by  TEXT REFERENCES users(id),
  can_assign  INTEGER DEFAULT 0,
  can_mount   INTEGER DEFAULT 1,
  can_schedule INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, user_id)
);

-- Kisilerin kendi bulut klasorlerini proje ana deposuna baglamasi
CREATE TABLE IF NOT EXISTS mounts (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  label           TEXT NOT NULL,                    -- ana depolamada gorunen isim (orn. "Elif Demir - Statik Projeler")
  source_path     TEXT NOT NULL,                    -- kaynak buluttaki yol
  external_id     TEXT,                             -- Graph driveItem id
  drive_id        TEXT,
  share_permission TEXT DEFAULT 'write',            -- read | write | manage
  status          TEXT DEFAULT 'connected',         -- connected | pending | syncing | error | disconnected
  item_count      INTEGER DEFAULT 0,
  size_bytes      INTEGER DEFAULT 0,
  last_sync_at    TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS files (
  id           TEXT PRIMARY KEY,
  mount_id     TEXT REFERENCES mounts(id) ON DELETE CASCADE,
  parent_id    TEXT,
  name         TEXT NOT NULL,
  path         TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'file',        -- folder | file
  size_bytes   INTEGER DEFAULT 0,
  mime         TEXT DEFAULT '',
  modified_at  TEXT,
  modified_by  TEXT DEFAULT '',
  external_id  TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT DEFAULT '',
  assignee_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by   TEXT REFERENCES users(id),
  status       TEXT DEFAULT 'todo',                 -- todo | doing | review | done
  priority     TEXT DEFAULT 'normal',               -- low | normal | high | urgent
  due_date     TEXT,
  mount_id     TEXT REFERENCES mounts(id) ON DELETE SET NULL,
  progress     INTEGER DEFAULT 0,
  created_at   TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT DEFAULT '',
  kind              TEXT DEFAULT 'meeting',         -- meeting | milestone | deadline | reminder
  start_at          TEXT NOT NULL,
  end_at            TEXT NOT NULL,
  location          TEXT DEFAULT '',
  organizer_id      TEXT REFERENCES users(id),
  attendees         TEXT DEFAULT '[]',              -- JSON array of user ids
  is_teams          INTEGER DEFAULT 0,
  teams_meeting_id  TEXT,
  teams_join_url    TEXT,
  outlook_event_id  TEXT,
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS channels (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  topic       TEXT DEFAULT '',
  teams_chat_id TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  channel_id  TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  attachment  TEXT DEFAULT '',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity (
  id          TEXT PRIMARY KEY,
  project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL,
  text        TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invitations (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT DEFAULT '',
  role        TEXT DEFAULT 'contributor',
  token       TEXT NOT NULL,
  status      TEXT DEFAULT 'pending',               -- pending | accepted | revoked
  invited_by  TEXT REFERENCES users(id),
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT
);

CREATE INDEX IF NOT EXISTS idx_mounts_project ON mounts(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project  ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);
CREATE INDEX IF NOT EXISTS idx_files_mount    ON files(mount_id);
CREATE INDEX IF NOT EXISTS idx_messages_chan  ON messages(channel_id);
`);

// ---- kucuk yardimcilar -------------------------------------------------
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);

export const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

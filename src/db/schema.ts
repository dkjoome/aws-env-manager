export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS namespaces (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS environments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  namespace_id  INTEGER NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(namespace_id, name)
);

CREATE TABLE IF NOT EXISTS projects (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  namespace_id  INTEGER NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(namespace_id, name)
);

CREATE TABLE IF NOT EXISTS keys (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  note        TEXT,
  is_secure   INTEGER NOT NULL DEFAULT 0,
  is_locked   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS key_values (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  key_id          INTEGER NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
  environment_id  INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  value           TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(key_id, environment_id)
);

CREATE TABLE IF NOT EXISTS key_links (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key_id  INTEGER NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
  target_key_id  INTEGER NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
  rule           TEXT NOT NULL DEFAULT 'eq',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_key_id, target_key_id)
);

CREATE TABLE IF NOT EXISTS settings (
  id                      INTEGER PRIMARY KEY DEFAULT 1,
  credentials_file_path   TEXT,
  ssm_profile             TEXT,
  s3_profile              TEXT,
  s3_bucket               TEXT,
  s3_backup_prefix        TEXT,
  aws_region              TEXT,
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings (id) VALUES (1);
`;

// Individual statements for execution via Tauri plugin-sql (which doesn't support multi-statement)
export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS namespaces (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS environments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    namespace_id  INTEGER NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    UNIQUE(namespace_id, name)
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    namespace_id  INTEGER NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(namespace_id, name)
  )`,
  `CREATE TABLE IF NOT EXISTS keys (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    note        TEXT,
    is_secure   INTEGER NOT NULL DEFAULT 0,
    is_locked   INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(project_id, name)
  )`,
  `CREATE TABLE IF NOT EXISTS key_values (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id          INTEGER NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
    environment_id  INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    value           TEXT,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(key_id, environment_id)
  )`,
  `CREATE TABLE IF NOT EXISTS key_links (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    source_key_id  INTEGER NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
    target_key_id  INTEGER NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
    rule           TEXT NOT NULL DEFAULT 'eq',
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source_key_id, target_key_id)
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    id                      INTEGER PRIMARY KEY DEFAULT 1,
    credentials_file_path   TEXT,
    ssm_profile             TEXT,
    s3_profile              TEXT,
    s3_bucket               TEXT,
    s3_backup_prefix        TEXT,
    aws_region              TEXT,
    updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `INSERT OR IGNORE INTO settings (id) VALUES (1)`,
];

// Migrations for existing databases (ALTER TABLE won't fail if column exists in SQLite with try/catch)
export const MIGRATIONS = [
  `ALTER TABLE keys ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0`,
];

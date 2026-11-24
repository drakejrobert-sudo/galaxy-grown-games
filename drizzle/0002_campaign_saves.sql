CREATE TABLE campaign_saves (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  operation_id TEXT,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX campaign_saves_owner ON campaign_saves(owner_id, deleted_at);
CREATE TABLE campaign_operations (
  id TEXT PRIMARY KEY,
  save_id TEXT NOT NULL REFERENCES campaign_saves(id),
  owner_id TEXT NOT NULL,
  expected_revision INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  committed_at INTEGER,
  committed_revision INTEGER
);
CREATE INDEX campaign_operations_cleanup ON campaign_operations(owner_id, created_at);
CREATE TABLE campaign_chunks (
  operation_id TEXT NOT NULL REFERENCES campaign_operations(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY(operation_id, position)
);
CREATE TABLE campaign_art (
  operation_id TEXT NOT NULL REFERENCES campaign_operations(id) ON DELETE CASCADE,
  map_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  digest TEXT NOT NULL,
  PRIMARY KEY(operation_id, map_id)
);

CREATE TABLE rooms (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  closed_at INTEGER
);
--> statement-breakpoint
CREATE INDEX rooms_owner ON rooms (owner_id, expires_at);
--> statement-breakpoint
CREATE TABLE room_members (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES rooms (id),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  station TEXT CHECK (station IN ('Pilot', 'Gunner', 'Bomber', 'Life Support')),
  UNIQUE (room_id, user_id)
);
--> statement-breakpoint
CREATE INDEX room_members_user ON room_members (user_id, room_id);
--> statement-breakpoint
CREATE TABLE room_join_attempts (
  user_id TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);

ALTER TABLE rooms ADD COLUMN situation TEXT
  CHECK (situation IN ('Asteroid Field', 'Space Battle', 'Boarding Party'));
--> statement-breakpoint
ALTER TABLE room_members ADD COLUMN started_at INTEGER;
--> statement-breakpoint
ALTER TABLE room_members ADD COLUMN report TEXT;

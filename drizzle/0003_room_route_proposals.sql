CREATE TABLE room_maps (
  room_id TEXT PRIMARY KEY NOT NULL REFERENCES rooms (id),
  revision TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  map_id TEXT NOT NULL,
  schematic TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE room_route_proposals (
  room_id TEXT NOT NULL REFERENCES room_maps (room_id) ON DELETE CASCADE,
  seat_id TEXT NOT NULL REFERENCES room_members (id),
  id TEXT NOT NULL,
  revision TEXT NOT NULL,
  stops TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  PRIMARY KEY (room_id, seat_id, id),
  UNIQUE (room_id, seat_id, revision, stops)
);
--> statement-breakpoint
CREATE TRIGGER clear_room_proposals_after_map_change
AFTER UPDATE OF revision ON room_maps
WHEN OLD.revision <> NEW.revision
BEGIN
  DELETE FROM room_route_proposals WHERE room_id = NEW.room_id;
END;
--> statement-breakpoint
CREATE TRIGGER clear_map_after_room_close
AFTER UPDATE OF closed_at ON rooms
WHEN NEW.closed_at IS NOT NULL
BEGIN
  DELETE FROM room_maps WHERE room_id = NEW.id;
END;

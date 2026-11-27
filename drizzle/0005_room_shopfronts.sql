CREATE TABLE shops (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  inventory TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE INDEX shops_by_owner ON shops(owner_id);
--> statement-breakpoint
ALTER TABLE rooms ADD COLUMN shop_id TEXT REFERENCES shops(id);

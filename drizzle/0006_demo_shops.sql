ALTER TABLE shops ADD COLUMN demo_key TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX shops_by_owner_demo ON shops(owner_id, demo_key);

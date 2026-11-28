CREATE TABLE casino_reports (
  seat_id TEXT NOT NULL REFERENCES room_members (id),
  session_id TEXT NOT NULL,
  game TEXT NOT NULL,
  starting_gold INTEGER NOT NULL CHECK (starting_gold >= 0),
  final_gold INTEGER NOT NULL CHECK (final_gold >= 0),
  submitted_at INTEGER NOT NULL,
  PRIMARY KEY (seat_id, game, session_id)
);
--> statement-breakpoint
CREATE INDEX casino_reports_submitted_at ON casino_reports (submitted_at);

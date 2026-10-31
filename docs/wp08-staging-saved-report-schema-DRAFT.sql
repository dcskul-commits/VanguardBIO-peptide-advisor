-- WP08-B DESIGN DRAFT ONLY — DO NOT EXECUTE.
-- Requires separately approved opt-in storage scope, retention, migration window, and rollback.
-- Target ONLY: approved isolated staging PostgreSQL database.
-- No Airo DB, production migration, or live resource API routes.
BEGIN;
CREATE TABLE IF NOT EXISTS "saved_report" (
  "id" uuid PRIMARY KEY,
  "owner_id" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "title" varchar(120) NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  CONSTRAINT "saved_report_title_nonblank" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "saved_report_title_bound" CHECK (length("title") <= 120),
  CONSTRAINT "saved_report_body_nonblank" CHECK (length(btrim("body")) > 0),
  CONSTRAINT "saved_report_body_bound" CHECK (length("body") <= 40000)
);
CREATE INDEX IF NOT EXISTS "saved_report_owner_created_idx"
  ON "saved_report" ("owner_id", "created_at" DESC, "id" DESC);
COMMIT;
-- Proposed rollback ONLY if this migration is solely responsible for the table
-- and data retention/export obligations have been fulfilled:
-- DROP TABLE "saved_report";

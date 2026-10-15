-- Synced tables: values that don't fit their field are skipped and listed here instead of
-- failing the whole run; runs can be stopped and report progress; a field can be kept as text.
CREATE TABLE IF NOT EXISTS data.table_sync_issues (
  sync_id          uuid NOT NULL REFERENCES data.table_syncs (id) ON DELETE CASCADE,
  source_record_id uuid NOT NULL,
  dest_record_id   uuid,
  source_field_id  text NOT NULL,
  field_name       text NOT NULL,
  record_label     text NOT NULL DEFAULT '',
  value            text,
  message          text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sync_id, source_record_id, source_field_id)
);

ALTER TABLE data.table_syncs
  ADD COLUMN IF NOT EXISTS cancel_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS progress jsonb,
  -- { "<source field id>": "text" }: import that field as plain text instead of its own type.
  ADD COLUMN IF NOT EXISTS field_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Import errors remember which field was rejected.
ALTER TABLE data.import_errors ADD COLUMN IF NOT EXISTS field_id uuid;

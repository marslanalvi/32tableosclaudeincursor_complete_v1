-- Record comments, Airtable-style: resolve threads, attach files, comment on one of the
-- record's attachments, and choose per record which comments notify you.
ALTER TABLE data.comments
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS attachment_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_attachment_id uuid;

-- 'all': every comment on the record; 'mentions': only @mentions and replies; 'off': nothing.
ALTER TABLE data.record_subscriptions
  ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'all';
ALTER TABLE data.record_subscriptions DROP CONSTRAINT IF EXISTS record_subscriptions_level_check;
ALTER TABLE data.record_subscriptions
  ADD CONSTRAINT record_subscriptions_level_check CHECK (level IN ('all', 'mentions', 'off'));

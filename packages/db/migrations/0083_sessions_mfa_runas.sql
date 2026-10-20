-- Roles phase 3 (questionnaire B9, B10, G16).

-- B10: sessions end after 30 days without activity (they slide while in use). Sessions idle for
-- longer than that end now.
UPDATE core.sessions
SET idle_expires_at = coalesce(last_seen_at, created_at) + interval '30 days'
WHERE auth_method <> 'automation' AND revoked_at IS NULL AND idle_expires_at > now() + interval '30 days';

-- B9: two-factor sign-in is required for everyone (platform switch; the local test database
-- turns it off for the older suites).
INSERT INTO core.platform_settings (key, value)
VALUES ('require_mfa', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- G16: an automation runs as a chosen person instead of whoever saved it last. Existing
-- automations keep running as they do today.
ALTER TABLE data.automations ADD COLUMN IF NOT EXISTS run_as uuid;
UPDATE data.automations SET run_as = coalesce(updated_by, created_by) WHERE run_as IS NULL;

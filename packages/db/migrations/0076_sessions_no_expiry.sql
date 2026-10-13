-- Signed-in sessions no longer expire (no idle timeout, no 7-day limit). They end only when the
-- user signs out, signs out other sessions, changes password, or is suspended/removed.
-- The cookie is re-issued about once a day so browsers (which cap cookies at ~400 days) keep it.
ALTER TABLE core.sessions ADD COLUMN IF NOT EXISTS cookie_refreshed_at timestamptz;

UPDATE core.sessions
SET expires_at = now() + interval '100 years',
    idle_expires_at = now() + interval '100 years'
WHERE revoked_at IS NULL
  AND auth_method <> 'automation'
  AND expires_at > now()
  AND idle_expires_at > now();

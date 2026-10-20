-- Platform-wide settings (not tied to one organization).
-- signup_mode: 'restricted' (default) = accounts only through an invitation or an allowed email
-- domain, and nobody but the first sign-up creates an organization; 'open' = legacy behaviour.
CREATE TABLE IF NOT EXISTS core.platform_settings (
  key         text        PRIMARY KEY,
  value       jsonb       NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO core.platform_settings (key, value)
VALUES ('signup_mode', '"restricted"'::jsonb)
ON CONFLICT (key) DO NOTHING;

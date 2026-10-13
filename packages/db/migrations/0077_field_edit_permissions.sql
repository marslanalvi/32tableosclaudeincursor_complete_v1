-- Field permissions: who may edit values in a field.
-- NULL = editors and up (default). Otherwise {"level": "creators" | "specific" | "nobody", "userIds": [uuid, ...]}.
ALTER TABLE data.fields ADD COLUMN IF NOT EXISTS edit_permission jsonb;

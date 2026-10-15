-- Per-base access: a base grant overrides the role inherited from the workspace, and
-- role 'none' blocks a base the workspace role would otherwise open.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'core.access_grants'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%interface_only%'
  LOOP
    EXECUTE format('ALTER TABLE core.access_grants DROP CONSTRAINT %I', c);
  END LOOP;
END;
$$;

ALTER TABLE core.access_grants ADD CONSTRAINT access_grants_role_check CHECK (
     (resource_type = 'org'       AND role IN ('owner','admin','billing_admin','member','guest'))
  OR (resource_type = 'workspace' AND role IN ('owner','creator','editor','commenter','viewer'))
  OR (resource_type = 'base'      AND role IN ('creator','editor','commenter','viewer','interface_only','none'))
  OR (resource_type = 'interface' AND role IN ('interface_editor','interface_user'))
);

-- One invitation can open several bases (the first is base_id, the rest are here).
ALTER TABLE core.invitations ADD COLUMN IF NOT EXISTS extra_base_ids uuid[] NOT NULL DEFAULT '{}';

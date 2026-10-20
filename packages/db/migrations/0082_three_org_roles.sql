-- Three account types: Owner, Admin, Member (questionnaire G7, B14). The unused Billing admin
-- and Guest roles become Member.
UPDATE core.organization_members SET role = 'member', updated_at = now() WHERE role IN ('billing_admin', 'guest');
DELETE FROM core.access_grants WHERE resource_type = 'org' AND role IN ('billing_admin', 'guest');

ALTER TABLE core.organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE core.organization_members ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('owner', 'admin', 'member'));

ALTER TABLE core.access_grants DROP CONSTRAINT IF EXISTS access_grants_role_check;
ALTER TABLE core.access_grants ADD CONSTRAINT access_grants_role_check CHECK (
     (resource_type = 'org'       AND role IN ('owner','admin','member'))
  OR (resource_type = 'workspace' AND role IN ('owner','creator','editor','commenter','viewer'))
  OR (resource_type = 'base'      AND role IN ('creator','editor','commenter','viewer','interface_only','none'))
  OR (resource_type = 'interface' AND role IN ('interface_editor','interface_user'))
);

-- An invitation can also make someone an Admin or Owner (only Owners send those).
ALTER TABLE core.invitations ADD COLUMN IF NOT EXISTS org_role text NOT NULL DEFAULT 'member';
ALTER TABLE core.invitations DROP CONSTRAINT IF EXISTS invitations_org_role_check;
ALTER TABLE core.invitations ADD CONSTRAINT invitations_org_role_check CHECK (org_role IN ('owner', 'admin', 'member'));

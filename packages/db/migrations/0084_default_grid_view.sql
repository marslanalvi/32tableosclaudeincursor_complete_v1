-- Every table keeps a shared Grid view as its default, which nobody can delete.
-- Earlier, deleting the default passed it on to another view (sometimes a Gantt or a form).

-- 1. Only a live, shared Grid view can be the default.
UPDATE data.views SET is_default = false
WHERE is_default AND (deleted_at IS NOT NULL OR type <> 'grid' OR visibility = 'personal');

-- 1b. One default per table (keep the first).
UPDATE data.views v SET is_default = false
WHERE v.is_default AND v.deleted_at IS NULL AND EXISTS (
  SELECT 1 FROM data.views o
  WHERE o.table_id = v.table_id AND o.is_default AND o.deleted_at IS NULL
    AND (o.order_key, o.created_at, o.id) < (v.order_key, v.created_at, v.id)
);

-- 2. Tables without one: the first shared Grid view becomes the default.
UPDATE data.views v SET is_default = true, updated_at = now()
FROM (
  SELECT DISTINCT ON (table_id) id
  FROM data.views
  WHERE deleted_at IS NULL AND type = 'grid' AND visibility <> 'personal'
    AND table_id NOT IN (SELECT table_id FROM data.views WHERE is_default AND deleted_at IS NULL)
  ORDER BY table_id, order_key, created_at
) pick
WHERE v.id = pick.id;

-- 3. Tables with no shared Grid view at all get one, at the end of the list (a key after the
--    last one: appending a digit keeps fractional order keys valid).
INSERT INTO data.views (workspace_id, base_id, table_id, type, name, order_key, is_default, config)
SELECT t.workspace_id, t.base_id, t.id, 'grid', 'Grid view',
       coalesce((SELECT max(order_key) || 'V' FROM data.views WHERE table_id = t.id), 'a0'),
       true, '{}'::jsonb
FROM data.tables t
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM data.views v WHERE v.table_id = t.id AND v.is_default AND v.deleted_at IS NULL);

-- 4. At most one default per table from now on.
CREATE UNIQUE INDEX IF NOT EXISTS views_one_default_per_table
  ON data.views (table_id) WHERE is_default AND deleted_at IS NULL;

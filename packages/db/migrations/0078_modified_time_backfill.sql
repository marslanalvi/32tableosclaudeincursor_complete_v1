-- Last modified time fields that watch specific fields store their time in the record's cell.
-- Fill it for existing records: the latest change-log edit of a watched field, otherwise the
-- record's creation time when a watched field has a value. Called by the API whenever such a
-- field is created or its watched fields change, and below for fields that already exist.
CREATE OR REPLACE FUNCTION data.backfill_watched_modified_time(p_field_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  f record;
  v_base uuid;
  v_slot text;
  v_slots text[];
  v_links uuid[];
BEGIN
  SELECT id, table_id, slot, type, config INTO f FROM data.fields WHERE id = p_field_id AND deleted_at IS NULL;
  IF NOT FOUND OR f.type <> 'modified_time' THEN RETURN; END IF;
  SELECT base_id INTO v_base FROM data.tables WHERE id = f.table_id;
  v_slot := f.slot::text;

  IF jsonb_typeof(f.config -> 'watchFieldIds') <> 'array' OR jsonb_array_length(f.config -> 'watchFieldIds') = 0 THEN
    UPDATE data.records SET cells = cells - v_slot WHERE table_id = f.table_id AND cells ? v_slot;
    RETURN;
  END IF;

  SELECT coalesce(array_agg(w.slot::text) FILTER (WHERE w.type NOT IN ('link', 'contact')), '{}'),
         coalesce(array_agg(w.id) FILTER (WHERE w.type IN ('link', 'contact')), '{}')
    INTO v_slots, v_links
    FROM data.fields w
    WHERE w.table_id = f.table_id AND w.deleted_at IS NULL
      AND w.id::text IN (SELECT jsonb_array_elements_text(f.config -> 'watchFieldIds'));

  WITH changed AS (
    SELECT (op ->> 'recordId')::uuid AS rid, max(bc.created_at) AS at
    FROM data.base_changes bc
    CROSS JOIN LATERAL jsonb_array_elements(bc.ops) op
    CROSS JOIN LATERAL (
      SELECT coalesce(op -> 'prevCells', (
        SELECT i -> 'cells' FROM jsonb_array_elements(bc.inverse_ops) i
        WHERE i ->> 'op' = 'record.updated' AND i ->> 'recordId' = op ->> 'recordId' LIMIT 1
      )) AS prev
    ) p
    WHERE bc.base_id = v_base
      AND jsonb_typeof(bc.ops) = 'array'
      AND op ->> 'op' = 'record.updated'
      AND op ->> 'tableId' = f.table_id::text
      AND (
        (jsonb_typeof(p.prev) = 'object' AND jsonb_typeof(op -> 'cells') = 'object' AND EXISTS (
          SELECT 1 FROM unnest(v_slots) s
          WHERE nullif(nullif(nullif(op -> 'cells' -> s, 'null'), '""'), '[]')
                IS DISTINCT FROM nullif(nullif(nullif(p.prev -> s, 'null'), '""'), '[]')
        ))
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(op -> 'links') = 'array' THEN op -> 'links' ELSE '[]'::jsonb END) d
          WHERE d ->> 'fieldId' = ANY (v_links::text[]) AND d ->> 'recordId' = op ->> 'recordId'
        )
      )
    GROUP BY 1
  ),
  linked AS (
    SELECT l.a_record_id AS rid FROM data.record_links l JOIN data.link_relations lr ON lr.id = l.relation_id
    WHERE lr.a_field_id = ANY (v_links) AND l.deletion_batch_id IS NULL
    UNION
    SELECT l.b_record_id FROM data.record_links l JOIN data.link_relations lr ON lr.id = l.relation_id
    WHERE lr.b_field_id = ANY (v_links) AND l.deletion_batch_id IS NULL
  ),
  stamp AS (
    SELECT r.id,
      CASE
        WHEN c.at IS NOT NULL THEN to_jsonb(to_char(c.at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
        WHEN EXISTS (
          SELECT 1 FROM unnest(v_slots) s WHERE nullif(nullif(nullif(r.cells -> s, 'null'), '""'), '[]') IS NOT NULL
        ) OR r.id IN (SELECT rid FROM linked)
          THEN to_jsonb(to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      END AS val
    FROM data.records r LEFT JOIN changed c ON c.rid = r.id
    WHERE r.table_id = f.table_id
  )
  UPDATE data.records r
  SET cells = CASE WHEN s.val IS NULL THEN r.cells - v_slot ELSE jsonb_set(r.cells, ARRAY[v_slot], s.val) END
  FROM stamp s
  WHERE r.id = s.id AND r.table_id = f.table_id AND (r.cells -> v_slot) IS DISTINCT FROM s.val;
END;
$$;

DO $$
DECLARE fid uuid;
BEGIN
  FOR fid IN
    SELECT id FROM data.fields
    WHERE type = 'modified_time' AND deleted_at IS NULL
      AND jsonb_typeof(config -> 'watchFieldIds') = 'array' AND jsonb_array_length(config -> 'watchFieldIds') > 0
  LOOP
    PERFORM data.backfill_watched_modified_time(fid);
  END LOOP;
END;
$$;

-- The product is TableOS everywhere: the domain event topic is now 'tableos.domain-events.v1'.
-- Events written before this release but not yet published by the relay move to the new topic,
-- so the workers (which now listen on it) still receive them.
ALTER TABLE data.outbox_events ALTER COLUMN topic SET DEFAULT 'tableos.domain-events.v1';

UPDATE data.outbox_events
SET topic = 'tableos.domain-events.v1'
WHERE published_at IS NULL AND topic <> 'tableos.domain-events.v1';

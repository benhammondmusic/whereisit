ALTER TABLE things ADD COLUMN obtained_on TEXT; -- YYYY-MM-DD
ALTER TABLE things ADD COLUMN replace_by TEXT;  -- YYYY-MM-DD
ALTER TABLE things ADD COLUMN created_by TEXT;
ALTER TABLE things ADD COLUMN updated_by TEXT;

-- History. Paths are stored as text so they still read correctly after things are renamed or deleted.
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thing_id TEXT NOT NULL,
  kind TEXT NOT NULL,        -- 'created' | 'moved'
  from_path TEXT,
  to_path TEXT,
  by TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX events_thing_id ON events(thing_id, at);
CREATE INDEX things_replace_by ON things(replace_by);

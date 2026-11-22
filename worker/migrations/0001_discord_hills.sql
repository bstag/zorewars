CREATE TABLE IF NOT EXISTS discord_hills (
  hill TEXT PRIMARY KEY CHECK (hill IN ('nano', 'tiny')),
  version INTEGER NOT NULL,
  state TEXT NOT NULL
);

INSERT OR IGNORE INTO discord_hills (hill, version, state) VALUES
  ('nano', 0, '{"revision":1,"entries":[],"matches":[],"receipts":[]}'),
  ('tiny', 0, '{"revision":1,"entries":[],"matches":[],"receipts":[]}');

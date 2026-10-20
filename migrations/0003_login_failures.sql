-- Wrong door codes, for lockout. Rows older than a day are pruned on insert.
CREATE TABLE login_failures (
  ip TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX login_failures_ip_at ON login_failures(ip, at);

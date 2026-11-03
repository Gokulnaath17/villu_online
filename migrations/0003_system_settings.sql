-- System settings table for persistent configurations (e.g. YouTube streaming cookies)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER DEFAULT 0
);


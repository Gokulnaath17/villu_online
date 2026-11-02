-- Migration 0002: Add is_active to users and create audit_logs table
ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS audit_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT,
    username   TEXT,
    action     TEXT NOT NULL,
    details    TEXT,
    ip_hash    TEXT,
    created_at INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);


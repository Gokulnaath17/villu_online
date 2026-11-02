-- Users
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE,
    email         TEXT UNIQUE,
    name          TEXT,
    password_hash TEXT,
    password_salt TEXT,
    iterations    INTEGER DEFAULT 100000,
    role          TEXT DEFAULT 'user',
    is_active     INTEGER DEFAULT 1,
    created_at    INTEGER DEFAULT (unixepoch()),
    updated_at    INTEGER DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT,
    username   TEXT,
    action     TEXT NOT NULL,
    details    TEXT,
    ip_hash    TEXT,
    created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_hash    TEXT,
    user_agent TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Playlists
CREATE TABLE IF NOT EXISTS playlists (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    name        TEXT NOT NULL,
    description TEXT,
    cover_url   TEXT,
    is_public   INTEGER DEFAULT 0,
    created_at  INTEGER DEFAULT (unixepoch()),
    updated_at  INTEGER DEFAULT (unixepoch())
);

-- Playlist tracks (ordered)
CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    video_id    TEXT NOT NULL,
    title       TEXT NOT NULL,
    artist      TEXT,
    thumbnail   TEXT,
    duration    INTEGER,         -- seconds
    position    INTEGER NOT NULL, -- ordering within playlist
    added_at    INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (playlist_id, video_id)
);

-- Liked songs
CREATE TABLE IF NOT EXISTS liked_songs (
    user_id   TEXT NOT NULL REFERENCES users(id),
    video_id  TEXT NOT NULL,
    title     TEXT NOT NULL,
    artist    TEXT,
    thumbnail TEXT,
    duration  INTEGER,
    liked_at  INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, video_id)
);

-- Recently played
CREATE TABLE IF NOT EXISTS history (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   TEXT NOT NULL REFERENCES users(id),
    video_id  TEXT NOT NULL,
    title     TEXT NOT NULL,
    artist    TEXT,
    thumbnail TEXT,
    duration  INTEGER,
    played_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_history_user_time ON history(user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pos ON playlist_tracks(playlist_id, position ASC);

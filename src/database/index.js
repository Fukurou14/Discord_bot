const Database = require('better-sqlite3');
const config = require('../config');

const db = new Database(config.DB_FILE);
db.pragma('journal_mode = WAL');

db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        message_id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL,
        author_tag TEXT,
        channel_id TEXT NOT NULL,
        content TEXT,
        image_url TEXT,
        db_message_id TEXT,
        log_message_id TEXT,
        created_at INTEGER,
        is_deleted INTEGER DEFAULT 0,
        deleted_at INTEGER
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS ignored_channels (
        channel_id TEXT PRIMARY KEY,
        added_by TEXT,
        added_at INTEGER
    )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_author ON messages(author_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_deleted ON messages(is_deleted)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_created ON messages(created_at)`);

module.exports = {
    db,
    insertMsg: db.prepare(`
        INSERT OR REPLACE INTO messages 
        (message_id, author_id, author_tag, channel_id, content, image_url, db_message_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    updateFile: db.prepare(`
        UPDATE messages SET image_url = ?, db_message_id = ? WHERE message_id = ?
    `),
    updateLogMessageId: db.prepare(`
        UPDATE messages SET log_message_id = ? WHERE message_id = ?
    `),
    updateContent: db.prepare(`
        UPDATE messages SET content = ? WHERE message_id = ?
    `),
    markDeleted: db.prepare(`
        UPDATE messages SET is_deleted = 1, deleted_at = ? WHERE message_id = ?
    `),
    getLogById: db.prepare(`SELECT * FROM messages WHERE message_id = ?`),
    getDeletedLogs: db.prepare(`
        SELECT * FROM messages WHERE is_deleted = 1 
        ORDER BY deleted_at DESC LIMIT ?
    `),
    getLogsByUser: db.prepare(`
        SELECT * FROM messages WHERE author_id = ? 
        ORDER BY created_at DESC LIMIT ?
    `),
    cleanOldLogs: db.prepare(`DELETE FROM messages WHERE created_at < ?`),

    addIgnoredChannel: db.prepare(`
        INSERT OR REPLACE INTO ignored_channels (channel_id, added_by, added_at)
        VALUES (?, ?, ?)
    `),
    removeIgnoredChannel: db.prepare(`DELETE FROM ignored_channels WHERE channel_id = ?`),
    getIgnoredChannel: db.prepare(`SELECT * FROM ignored_channels WHERE channel_id = ?`),
    getAllIgnoredChannels: db.prepare(`SELECT * FROM ignored_channels ORDER BY added_at DESC`)
};
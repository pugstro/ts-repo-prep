import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import logger from './logger.js';
import { getCurrentBranch } from './git.js';

const BASE_DB_FILENAME = '.repo-prep';
const dbLogger = logger.child({ module: 'db' });

export interface DBFile {
    path: string;
    mtime: number;
    last_scanned_at: number;
}

export interface DBExport {
    id?: number;
    file_path: string;
    name: string;
    kind: string;
    signature?: string; // detailed
    doc?: string;       // detailed
    start_line: number;
    end_line: number;
}

export interface DBImport {
    id?: number;
    file_path: string;
    module_specifier: string;
    imported_symbols: string;
    resolved_path?: string;
}

export function initDB(repoPath: string): any {
    const branch = getCurrentBranch(repoPath);
    const dbFilename = branch ? `${BASE_DB_FILENAME}.${branch}.db` : `${BASE_DB_FILENAME}.db`;
    const dbPath = path.join(repoPath, dbFilename);

    dbLogger.info({ repoPath, dbFilename, branch }, 'Initializing database...');
    const db = new Database(dbPath);

    // Wal mode for better concurrency
    db.pragma('journal_mode = WAL');

    // Schema
    db.exec(`
        CREATE TABLE IF NOT EXISTS files (
            path TEXT PRIMARY KEY,
            mtime REAL,
            last_scanned_at REAL,
            classification TEXT,
            summary TEXT
        );

        CREATE TABLE IF NOT EXISTS exports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT,
            name TEXT,
            kind TEXT,
            signature TEXT,
            doc TEXT,
            start_line INTEGER,
            end_line INTEGER,
            classification TEXT,
            capabilities TEXT, -- JSON string
            parent_id INTEGER, -- For nested members (methods, properties)
            FOREIGN KEY(file_path) REFERENCES files(path) ON DELETE CASCADE,
            FOREIGN KEY(parent_id) REFERENCES exports(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS imports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT,
            module_specifier TEXT,
            imported_symbols TEXT,
            resolved_path TEXT,
            FOREIGN KEY(file_path) REFERENCES files(path) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT,
            key TEXT,
            value TEXT,
            kind TEXT, -- e.g. "Env", "Port", "Image"
            FOREIGN KEY(file_path) REFERENCES files(path) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS file_content (
            file_path TEXT PRIMARY KEY,
            content TEXT,
            FOREIGN KEY(file_path) REFERENCES files(path) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_exports_file_path ON exports(file_path);
        CREATE INDEX IF NOT EXISTS idx_exports_name ON exports(name);
        CREATE INDEX IF NOT EXISTS idx_exports_parent_id ON exports(parent_id);
        CREATE INDEX IF NOT EXISTS idx_imports_file_path ON imports(file_path);
        CREATE INDEX IF NOT EXISTS idx_imports_resolved_path ON imports(resolved_path);
        CREATE INDEX IF NOT EXISTS idx_configs_file_path ON configs(file_path);

        -- FTS5 Search (External Content)
        CREATE VIRTUAL TABLE IF NOT EXISTS exports_fts USING fts5(
            name, 
            signature, 
            doc, 
            content='exports', 
            content_rowid='id'
        );

        -- FTS5 for file summaries (semantic intent search)
        CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
            path,
            summary,
            content='files',
            content_rowid='rowid'
        );

        -- FTS5 for full file content (Smart Grep)
        CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
            file_path,
            content,
            content='file_content',
            content_rowid='rowid'
        );

        -- Triggers to keep exports_fts in sync
        CREATE TRIGGER IF NOT EXISTS exports_ai AFTER INSERT ON exports BEGIN
            INSERT INTO exports_fts(rowid, name, signature, doc) VALUES (new.id, new.name, new.signature, new.doc);
        END;

        CREATE TRIGGER IF NOT EXISTS exports_ad AFTER DELETE ON exports BEGIN
            INSERT INTO exports_fts(exports_fts, rowid, name, signature, doc) VALUES('delete', old.id, old.name, old.signature, old.doc);
        END;

        CREATE TRIGGER IF NOT EXISTS exports_au AFTER UPDATE ON exports BEGIN
            INSERT INTO exports_fts(exports_fts, rowid, name, signature, doc) VALUES('delete', old.id, old.name, old.signature, old.doc);
            INSERT INTO exports_fts(rowid, name, signature, doc) VALUES (new.id, new.name, new.signature, new.doc);
        END;

        -- Triggers to keep files_fts in sync
        CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
            INSERT INTO files_fts(rowid, path, summary) VALUES (new.rowid, new.path, new.summary);
        END;

        CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
            INSERT INTO files_fts(files_fts, rowid, path, summary) VALUES('delete', old.rowid, old.path, old.summary);
        END;

        CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
            INSERT INTO files_fts(files_fts, rowid, path, summary) VALUES('delete', old.rowid, old.path, old.summary);
            INSERT INTO files_fts(rowid, path, summary) VALUES (new.rowid, new.path, new.summary);
        END;

        -- Triggers to keep content_fts in sync
        CREATE TRIGGER IF NOT EXISTS content_ai AFTER INSERT ON file_content BEGIN
            INSERT INTO content_fts(rowid, file_path, content) VALUES (new.rowid, new.file_path, new.content);
        END;

        CREATE TRIGGER IF NOT EXISTS content_ad AFTER DELETE ON file_content BEGIN
            INSERT INTO content_fts(content_fts, rowid, file_path, content) VALUES('delete', old.rowid, old.file_path, old.content);
        END;

        CREATE TRIGGER IF NOT EXISTS content_au AFTER UPDATE ON file_content BEGIN
            INSERT INTO content_fts(content_fts, rowid, file_path, content) VALUES('delete', old.rowid, old.file_path, old.content);
            INSERT INTO content_fts(rowid, file_path, content) VALUES (new.rowid, new.file_path, new.content);
        END;
    `);

    return db;
}

const dbCache = new Map<string, any>();

export function getDB(repoPath: string): any {
    const branch = getCurrentBranch(repoPath);
    const dbFilename = branch ? `${BASE_DB_FILENAME}.${branch}.db` : `${BASE_DB_FILENAME}.db`;
    const dbPath = path.join(repoPath, dbFilename);

    if (dbCache.has(dbPath)) {
        const db = dbCache.get(dbPath);
        if (db.open) {
            return db;
        }
        dbCache.delete(dbPath);
    }

    let db;
    if (!fs.existsSync(dbPath)) {
        db = initDB(repoPath);
    } else {
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');

        // Migration: Add files_fts table if it doesn't exist (v1.3.0)
        const tableExists = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='files_fts'
        `).get();

        if (!tableExists) {
            dbLogger.info({ dbPath }, 'Migrating database: adding files_fts table');
            db.exec(`
                CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
                    path,
                    summary,
                    content='files',
                    content_rowid='rowid'
                );

                CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
                    INSERT INTO files_fts(rowid, path, summary) VALUES (new.rowid, new.path, new.summary);
                END;

                CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
                    INSERT INTO files_fts(files_fts, rowid, path, summary) VALUES('delete', old.rowid, old.path, old.summary);
                END;

                CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
                    INSERT INTO files_fts(files_fts, rowid, path, summary) VALUES('delete', old.rowid, old.path, old.summary);
                    INSERT INTO files_fts(rowid, path, summary) VALUES (new.rowid, new.path, new.summary);
                END;
            `);

            // Populate FTS table with existing data
            db.exec(`
                INSERT INTO files_fts(rowid, path, summary)
                SELECT rowid, path, summary FROM files WHERE summary IS NOT NULL;
            `);

            dbLogger.info({ dbPath }, 'Migration complete: files_fts table created and populated');
        }
    }

    dbCache.set(dbPath, db);
    return db;
}

export function closeAllDBs() {
    for (const [path, db] of dbCache.entries()) {
        try {
            if (db.open) {
                dbLogger.info({ path }, 'Closing database connection');
                db.close();
            }
        } catch (err) {
            dbLogger.error({ path, err }, 'Error closing database execution');
        }
    }
    dbCache.clear();
}

// Ensure connections are closed on exit
process.on('exit', () => closeAllDBs());
process.on('SIGINT', () => {
    closeAllDBs();
    process.exit(0);
});


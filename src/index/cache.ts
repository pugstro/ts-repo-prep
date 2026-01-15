import { scanRepo } from '../scanner.js';
import { parseFile } from '../parser/index.js';
import logger from '../logger.js';
import plimit from 'p-limit';
import path from 'path';
import { getDB } from '../db.js';
import { resolveImportPath, initResolver } from '../resolver/index.js';
import { parseConfigFile } from '../config-parser.js';

export async function ensureCacheUpToDate(repoPath: string, concurrency = 5): Promise<any> { // Return type is now DB instance or void
    const db = getDB(repoPath);

    // Initialize resolver for this repo (loads tsconfig.json for path aliases)
    initResolver(repoPath);

    // Get current state from DB
    const cachedFiles = db.prepare('SELECT path, mtime FROM files').all() as { path: string, mtime: number }[];
    const cachedMap = new Map(cachedFiles.map(f => [f.path, f.mtime]));

    // Always scan to get current state on disk
    const onDiskFiles = await scanRepo(repoPath);
    const onDiskMap = new Map(onDiskFiles.map(f => [f.path, f.mtime]));

    // Determine Work
    const toDelete = cachedFiles.filter(f => !onDiskMap.has(f.path)).map(f => f.path);
    const toProcess = onDiskFiles.filter(f => {
        const cachedMtime = cachedMap.get(f.path);
        // If not in cache OR mtime different, re-process
        return cachedMtime === undefined || cachedMtime !== f.mtime;
    });

    if (toDelete.length === 0 && toProcess.length === 0) {
        return db; // Nothing to do
    }

    logger.info({ toDelete: toDelete.length, toProcess: toProcess.length }, 'Syncing Database...');

    // 1. Delete removed files
    const deleteParams = toDelete.map(p => p); // simpler than trying to batch too smartly
    if (deleteParams.length > 0) {
        const deleteStmt = db.prepare('DELETE FROM files WHERE path = ?');
        const deleteTransaction = db.transaction((paths: string[]) => {
            for (const p of paths) deleteStmt.run(p);
        });
        deleteTransaction(deleteParams);
    }

    // 2. Process changed files
    if (toProcess.length > 0) {
        const limit = plimit(concurrency);

        let completed = 0;
        const total = toProcess.length;

        const parseTasks = toProcess.map(meta => limit(async () => {
            try {
                const fileName = path.basename(meta.path);
                const isCode = fileName.endsWith('.ts') || fileName.endsWith('.tsx');

                if (isCode) {
                    const result = await parseFile(meta.path);
                    completed++;
                    if (completed % 50 === 0 || completed === total) {
                        logger.info({ completed, total }, 'Parsing progress...');
                    }
                    return { meta, ...result, kind: 'code' };
                } else {
                    const result = parseConfigFile(meta.path);
                    completed++;
                    if (completed % 50 === 0 || completed === total) {
                        logger.info({ completed, total }, 'Parsing progress...');
                    }
                    return { meta, ...result, kind: 'config' };
                }
            } catch (err) {
                completed++;
                logger.error({ path: meta.path, error: err }, 'Failed to parse file');
                return { meta, exports: [], imports: [], kind: 'error' };
            }
        }));

        const results = await Promise.all(parseTasks);

        const insertFile = db.prepare('INSERT OR REPLACE INTO files (path, mtime, last_scanned_at, classification, summary) VALUES (?, ?, ?, ?, ?)');
        const insertExport = db.prepare('INSERT INTO exports (file_path, name, kind, signature, doc, start_line, end_line, classification, capabilities) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        const insertImport = db.prepare('INSERT INTO imports (file_path, module_specifier, imported_symbols, resolved_path) VALUES (?, ?, ?, ?)');
        const insertConfig = db.prepare('INSERT INTO configs (file_path, key, value, kind) VALUES (?, ?, ?, ?)');

        const deleteFile = db.prepare('DELETE FROM files WHERE path = ?');

        const writeTransaction = db.transaction((items: any[]) => {
            for (const item of items) {
                const { meta, exports, imports, configs, classification, summary } = item;

                // Clear old entry to trigger cascade delete of exports/imports/configs
                deleteFile.run(meta.path);

                // Insert new File
                insertFile.run(meta.path, meta.mtime, Date.now(), classification || 'Unknown', summary || '');

                // Insert Exports
                if (exports) {
                    for (const exp of exports) {
                        insertExport.run(
                            meta.path,
                            exp.name,
                            exp.kind,
                            exp.signature,
                            exp.doc || '',
                            exp.line,
                            exp.endLine || exp.line,
                            exp.classification || 'Other',
                            exp.capabilities || '[]'
                        );
                    }
                }

                // Insert Imports
                if (imports) {
                    for (const imp of imports) {
                        const resolvedPath = resolveImportPath(imp.module, meta.path, repoPath);
                        insertImport.run(meta.path, imp.module, imp.name, resolvedPath);
                    }
                }

                // Insert Configs
                if (configs) {
                    for (const conf of configs) {
                        insertConfig.run(meta.path, conf.key, conf.value, conf.kind);
                    }
                }
            }
        });

        writeTransaction(results);
    }

    return db;
}

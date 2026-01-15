import path from 'path';
import logger from '../logger.js';
import { DetailLevel, FileSummary } from '../types.js';
import { getDB, DBFile } from '../db.js';
import { buildTree } from './tree.js';
import { ensureCacheUpToDate } from './cache.js';

export async function processRepo(repoPath: string, concurrency = 5, level: DetailLevel = 'detailed', subPath?: string) {
    logger.info({ repo: repoPath, level, subPath }, 'Ensuring cache is up-to-date...');

    // Ensure DB is consistent
    await ensureCacheUpToDate(repoPath, concurrency);
    const db = getDB(repoPath);

    // Fetch data from DB based on filters
    let query = 'SELECT * FROM files';
    let params: any[] = [];

    if (subPath) {
        const absoluteSubPath = path.resolve(repoPath, subPath);
        query += ' WHERE path LIKE ?';
        params.push(`${absoluteSubPath}%`);
    }

    const files = db.prepare(query).all(params) as DBFile[];
    logger.info({ count: files.length }, 'Fetching data from DB...');

    // If level is lite, we just need paths (which we have)
    if (level === 'lite') {
        const summaries: FileSummary[] = files.map(f => ({
            path: f.path,
            mtime: f.mtime
        }));
        return buildTree(summaries, repoPath, level);
    }

    const summaries: FileSummary[] = files.map(f => {
        // Fetch exports
        let exports = db.prepare('SELECT name, kind, signature, start_line as line FROM exports WHERE file_path = ?').all(f.path) as any[];

        if (level === 'structure') {
            exports = exports.map(e => ({ name: e.name, kind: e.kind, line: e.line }));
        } else if (level === 'signatures') {
            exports = exports.map(e => ({ name: e.name, kind: e.kind, signature: e.signature, line: e.line }));
        }

        // Fetch imports
        let imports: any[] = [];
        if (level === 'detailed') {
            imports = db.prepare('SELECT module_specifier as module, resolved_path FROM imports WHERE file_path = ?').all(f.path);
        }

        return {
            path: f.path,
            mtime: f.mtime,
            classification: (f as any).classification,
            summary: (f as any).summary,
            exports,
            imports: imports.length > 0 ? imports : undefined,
            chunks: []
        };
    });

    logger.info({ count: summaries.length }, 'Building hierarchical project tree...');
    return buildTree(summaries, repoPath, level);
}

import { ensureCacheUpToDate } from '../../index.js';
import { getDB } from '../../db.js';
import { resolveToolArgs } from '../utils.js';
import path from 'path';

export async function handleSearchSymbols(args: any) {
    const { repoPath } = resolveToolArgs(args);
    const query = String(args?.query).toLowerCase();

    await ensureCacheUpToDate(repoPath);
    const db = getDB(repoPath);

    // Use FTS5 optimization if available, else fallback to LIKE
    let results;
    try {
        // Try FTS first
        results = db.prepare(`
            SELECT e.name, e.kind, e.signature, e.start_line as line, f.path as file_path, e.classification, e.capabilities
            FROM exports e
            JOIN exports_fts ef ON e.id = ef.rowid
            JOIN files f ON e.file_path = f.path
            WHERE ef MATCH ?
            LIMIT 50
        `).all(`"${query}" OR ${query}*`); // Simple FTS syntax
    } catch (e) {
        // Fallback to standard LIKE if table missing or syntax error
        results = db.prepare(`
            SELECT e.name, e.kind, e.signature, e.start_line as line, f.path as file_path, e.classification, e.capabilities
            FROM exports e
            JOIN files f ON e.file_path = f.path
            WHERE lower(e.name) LIKE ?
            LIMIT 50
        `).all(`%${query}%`) as any[];
    }

    const matches = results.map((r: any) => ({
        file: path.relative(repoPath, r.file_path),
        name: r.name,
        kind: r.kind,
        signature: r.signature,
        line: r.line,
        classification: r.classification,
        capabilities: JSON.parse(r.capabilities || '[]')
    }));
    return {
        content: [{ type: 'text', text: JSON.stringify(matches, null, 2) }],
    };
}

export async function handleSearchByCapability(args: any) {
    const { repoPath } = resolveToolArgs(args);
    const capability = String(args?.capability);

    await ensureCacheUpToDate(repoPath);
    const db = getDB(repoPath);

    // Search in JSON column
    const results = db.prepare(`
        SELECT e.name, e.kind, e.signature, e.start_line as line, f.path as file_path, e.classification, e.capabilities
        FROM exports e
        JOIN files f ON e.file_path = f.path
        WHERE e.capabilities LIKE ?
    `).all(`%${capability}%`) as any[];

    const matches = results.map((r: any) => ({
        file: path.relative(repoPath, r.file_path),
        name: r.name,
        kind: r.kind,
        signature: r.signature,
        line: r.line,
        classification: r.classification,
        capabilities: JSON.parse(r.capabilities || '[]')
    }));

    return {
        content: [{ type: 'text', text: JSON.stringify(matches, null, 2) }],
    };
}

export async function handleGetInfrastructureMetadata(args: any) {
    const { repoPath } = resolveToolArgs(args);
    const kind = args?.kind ? String(args.kind) : undefined;

    await ensureCacheUpToDate(repoPath);
    const db = getDB(repoPath);

    let query = 'SELECT key, value, kind, file_path FROM configs';
    const params: any[] = [];

    if (kind) {
        query += ' WHERE kind = ?';
        params.push(kind);
    }

    const results = db.prepare(query).all(...params) as any[];
    const formatted = results.map((r: any) => ({
        ...r,
        file: path.relative(repoPath, r.file_path)
    }));

    return {
        content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
    };
}

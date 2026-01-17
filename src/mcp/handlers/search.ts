import { ensureCacheUpToDate } from '../../index.js';
import { getDB } from '../../db.js';
import { resolveToolArgs } from '../utils.js';
import path from 'path';
import logger from '../../logger.js';

interface IntentMatch {
    path: string;
    summary: string;
    rank: number;
}

export async function handleSearch(args: any) {
    const { repoPath } = resolveToolArgs(args);
    const query = String(args?.query || '');
    const mode = (args?.mode || 'symbol') as 'symbol' | 'concept';

    if (!query) {
        return { content: [{ type: 'text', text: 'Error: query is required' }], isError: true };
    }

    await ensureCacheUpToDate(repoPath);
    const db = getDB(repoPath);

    if (mode === 'concept') {
        logger.info({ repoPath, query }, 'Searching by concept (intent)...');

        // Logic from intent.ts
        const matches = db.prepare(`
            SELECT 
                files.path,
                files.summary,
                files_fts.rank
            FROM files_fts
            JOIN files ON files.rowid = files_fts.rowid
            WHERE files_fts MATCH ?
            ORDER BY rank
            LIMIT 10
        `).all(query) as IntentMatch[];

        if (matches.length === 0) {
            return {
                content: [{
                    type: 'text',
                    text: `No files found matching concept: "${query}"\n\nTip: Try broader terms or check if the repository has been indexed with summaries.`
                }]
            };
        }

        const resultText = `# Concept Search: "${query}"\n\nFound ${matches.length} relevant file(s):\n\n` +
            matches.map((m, idx) => {
                const relativePath = path.relative(repoPath, m.path);
                return `## ${idx + 1}. ${relativePath}\n\n**Summary**: ${m.summary || 'No summary available'}\n`;
            }).join('\n');

        return {
            content: [{ type: 'text', text: resultText }]
        };
    } else {
        // Default: symbol search
        // Logic from handleSearchSymbols
        let results;
        try {
            // Try FTS first
            results = db.prepare(`
                SELECT e.name, e.kind, e.signature, e.start_line as line, f.path as file_path, e.classification, e.capabilities
                FROM exports e
                JOIN exports_fts ef ON e.id = ef.rowid
                JOIN files f ON e.file_path = f.path
                WHERE ef MATCH ?
                LIMIT 20
            `).all(`"${query}" OR ${query}*`);
        } catch (e) {
            // Fallback
            results = db.prepare(`
                SELECT e.name, e.kind, e.signature, e.start_line as line, f.path as file_path, e.classification, e.capabilities
                FROM exports e
                JOIN files f ON e.file_path = f.path
                WHERE lower(e.name) LIKE ?
                LIMIT 20
            `).all(`%${query.toLowerCase()}%`) as any[];
        }

        if (results.length === 0) {
            return {
                content: [{
                    type: 'text',
                    text: `No symbols found matching: "${query}"`
                }]
            };
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
}

import { resolveToolArgs } from '../utils.js';
import { getDB } from '../../db.js';
import { ensureCacheUpToDate } from '../../index.js';
import logger from '../../logger.js';
import fs from 'fs';
import path from 'path';

interface ConfigMatch {
    file: string;
    line: number;
    value: string;
    context: string;
}

export async function handleSearchConfig(args: any): Promise<any> {
    const { repoPath } = resolveToolArgs(args);
    const key = String(args?.key || '');
    const kind = args?.kind ? String(args.kind) : undefined;

    if (!key && !kind) {
        return {
            content: [{
                type: 'text',
                text: 'Error: Either "key" or "kind" parameter is required.'
            }]
        };
    }

    await ensureCacheUpToDate(repoPath);
    const db = getDB(repoPath);

    // MODE 1: Search for specific Key (like grep but smarter)
    if (key) {
        logger.info({ repoPath, key }, 'Searching for config key...');
        const matches: ConfigMatch[] = [];

        // 1. Search .env files
        const envFiles = db.prepare(`
            SELECT path FROM files 
            WHERE path LIKE '%.env%'
            ORDER BY path
        `).all();

        for (const { path: filePath } of envFiles as any[]) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const lines = content.split('\n');

                lines.forEach((line, idx) => {
                    // Match KEY=value or KEY = value
                    const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, 'i'));
                    if (match) {
                        matches.push({
                            file: path.relative(repoPath, filePath),
                            line: idx + 1,
                            value: match[1].trim(),
                            context: '.env file'
                        });
                    }
                });
            } catch (err) {
                logger.warn({ filePath, err }, 'Failed to read .env file');
            }
        }

        // 2. Search docker-compose files
        const dockerFiles = db.prepare(`
            SELECT path FROM files 
            WHERE path LIKE '%docker-compose%'
            AND (path LIKE '%.yml' OR path LIKE '%.yaml')
            ORDER BY path
        `).all();

        for (const { path: filePath } of dockerFiles as any[]) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const lines = content.split('\n');

                lines.forEach((line, idx) => {
                    // Match environment variables in docker-compose
                    // Patterns: KEY=value or - KEY=value or KEY: value
                    const patterns = [
                        new RegExp(`^\\s*-?\\s*${key}\\s*[:=]\\s*(.*)$`, 'i'),
                        new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, 'i')
                    ];

                    for (const pattern of patterns) {
                        const match = line.match(pattern);
                        if (match) {
                            matches.push({
                                file: path.relative(repoPath, filePath),
                                line: idx + 1,
                                value: match[1].trim(),
                                context: 'docker-compose'
                            });
                            break;
                        }
                    }
                });
            } catch (err) {
                logger.warn({ filePath, err }, 'Failed to read docker-compose file');
            }
        }

        // 3. Search YAML config files
        const yamlFiles = db.prepare(`
            SELECT path FROM files 
            WHERE (path LIKE '%.yml' OR path LIKE '%.yaml')
            AND path NOT LIKE '%docker-compose%'
            AND path NOT LIKE '%node_modules%'
            ORDER BY path
            LIMIT 100
        `).all();

        for (const { path: filePath } of yamlFiles as any[]) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const lines = content.split('\n');

                lines.forEach((line, idx) => {
                    // Match YAML key: value
                    const match = line.match(new RegExp(`^\\s*${key}\\s*:\\s*(.*)$`, 'i'));
                    if (match) {
                        matches.push({
                            file: path.relative(repoPath, filePath),
                            line: idx + 1,
                            value: match[1].trim(),
                            context: 'YAML config'
                        });
                    }
                });
            } catch (err) {
                logger.warn({ filePath, err }, 'Failed to read YAML file');
            }
        }

        // Format results
        if (matches.length === 0) {
            return {
                content: [{
                    type: 'text',
                    text: `No configuration found for key: ${key}`
                }]
            };
        }

        const resultText = `# Configuration Key: ${key}\n\nFound ${matches.length} match(es):\n\n` +
            matches.map(m =>
                `## ${m.file}:${m.line} (${m.context})\n\`\`\`\n${m.value}\n\`\`\``
            ).join('\n\n');

        return {
            content: [{
                type: 'text',
                text: resultText
            }]
        };
    }

    // MODE 2: Metadata Dump (by Kind)
    // Query infrastructure and configuration metadata (from Dockerfiles, YAML, or .env files)
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

import { processRepo, ensureCacheUpToDate, parseFile } from '../../index.js';
import { resolveToolArgs } from '../utils.js';
import { getDB } from '../../db.js';
import type { DetailLevel } from '../../types.js';
import path from 'path';

export async function handleGetProjectSummary(args: any) {
    const { repoPath } = resolveToolArgs(args);
    const subPath = args?.subPath ? String(args.subPath) : undefined;
    const maxDepth = args?.maxDepth ? Number(args.maxDepth) : undefined;

    // 1. Try to get calculation detail (signatures) first
    let summary = await processRepo(repoPath, 5, 'signatures', subPath, maxDepth);
    let json = JSON.stringify(summary, null, 2);

    // 2. Adaptive Safety Check
    // Limit: 50,000 characters (approx 12k tokens).
    const CHAR_LIMIT = 50000;

    if (json.length > CHAR_LIMIT) {
        // Too big! Downgrade to 'structure' (names only)
        summary = await processRepo(repoPath, 5, 'structure', subPath, maxDepth);
        json = JSON.stringify(summary, null, 2);

        if (json.length > CHAR_LIMIT) {
            // STILL too big! Downgrade to 'lite' (files only)
            summary = await processRepo(repoPath, 5, 'lite', subPath, maxDepth);
            json = JSON.stringify(summary, null, 2);

            if (json.length > CHAR_LIMIT) {
                // MASSIVE REPO DETECTED
                return {
                    content: [{
                        type: 'text',
                        text: `Warning: The repository at ${subPath || 'root'} is too large (${json.length} chars) to show in one go.\n` +
                            `Please use 'get_project_summary' with a 'subPath' (e.g., 'src/', 'apps/') to explore specific areas.\n\n` +
                            `Use 'search_symbols' to find something specific.`
                    }],
                };
            }
        }

        (summary as any)._meta = {
            warning: "Signatures/details truncated to fit context window.",
            originalSizeChars: json.length,
            action: "Use 'summarize_file' or 'search_symbols' for details."
        };
        json = JSON.stringify(summary, null, 2);
    }

    return {
        content: [{ type: 'text', text: json }],
    };
}

export async function handleSummarizeFile(args: any) {
    const { repoPath, filePath } = resolveToolArgs(args);
    if (!filePath) {
        return {
            content: [{ type: 'text', text: 'Error: filePath is required' }],
            isError: true
        };
    }
    const detailLevel = (args?.detailLevel as DetailLevel) || 'signatures';

    // Ensure freshest data
    await ensureCacheUpToDate(repoPath);

    const db = getDB(repoPath);
    const dbFile = db.prepare('SELECT classification, summary FROM files WHERE path = ?').get(filePath);

    const fileName = path.basename(filePath);
    const isCode = fileName.endsWith('.ts') || fileName.endsWith('.tsx');

    let result: any;
    if (isCode) {
        result = await parseFile(filePath);
    } else {
        // For config files, simulate or pull from DB configs table?
        // Let's pull everything from DB to be consistent after sync
        const exports = db.prepare('SELECT name, kind, signature, start_line as line FROM exports WHERE file_path = ?').all(filePath);
        result = { exports, imports: [] };
    }

    if (detailLevel === 'structure') {
        result.exports = result.exports.map((e: any) => ({
            name: e.name,
            kind: e.kind,
            line: e.line,
            classification: e.classification
        } as any));
        delete (result as any).imports;
    } else if (detailLevel === 'signatures') {
        result.exports = result.exports.map((e: any) => ({
            name: e.name,
            kind: e.kind,
            signature: e.signature,
            line: e.line,
            classification: e.classification,
            capabilities: JSON.parse(e.capabilities || '[]')
        }));
        delete (result as any).imports;
    }

    return {
        content: [{
            type: 'text',
            text: JSON.stringify({
                ...result,
                fileDescription: dbFile?.summary || '', // NEW: explicit description
                classification: dbFile?.classification || 'Unknown',
                summary: dbFile?.summary || '' // Keep for backward compat
            }, null, 2)
        }],
    };
}

export async function handleRefreshIndex(args: any) {
    const { repoPath } = resolveToolArgs(args);
    await ensureCacheUpToDate(repoPath);
    return {
        content: [{ type: 'text', text: `Repository at ${repoPath} has been re-indexed.` }],
    };
}

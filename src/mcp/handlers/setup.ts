import { ensureCacheUpToDate, processRepo } from '../../index.js';
import { resolveToolArgs } from '../utils.js';
import { getDB } from '../../db.js';
import logger from '../../logger.js';

export async function handleSetupRepository(args: any) {
    const { repoPath } = resolveToolArgs(args);

    logger.info({ repoPath }, 'Setting up repository...');

    // 1. Ensure cache is up-to-date (handles initial indexing or incremental sync)
    await ensureCacheUpToDate(repoPath);

    const db = getDB(repoPath);

    // 2. Gather statistics
    const fileCount = db.prepare('SELECT COUNT(*) as count FROM files').get().count;
    const exportCount = db.prepare('SELECT COUNT(*) as count FROM exports').get().count;
    const importCount = db.prepare('SELECT COUNT(*) as count FROM imports').get().count;

    // 3. Classify repo size & Type
    let sizeClass: 'small' | 'medium' | 'large';
    let strategy: string;
    let typeHint = "";

    // --- Smart Classification (System Map) ---
    // 1. Get top root directories by total file count
    // 2. Count TS/JS files vs Total files for each
    const topDirs = db.prepare(`
        SELECT 
            SUBSTR(path, LENGTH(?) + 2, 
                INSTR(SUBSTR(path, LENGTH(?) + 2), '/') - 1
            ) as root,
            COUNT(*) as total_files,
            SUM(CASE 
                WHEN path LIKE '%.ts' OR path LIKE '%.tsx' 
                  OR path LIKE '%.js' OR path LIKE '%.jsx' 
                  OR path LIKE '%.mjs' OR path LIKE '%.cjs' 
                THEN 1 ELSE 0 
            END) as ts_files
        FROM files 
        WHERE path LIKE ? || '/%/%'
        GROUP BY root
        ORDER BY total_files DESC
        LIMIT 8
    `).all(repoPath, repoPath, repoPath);

    const systemMap: string[] = [];
    const activeComponents: string[] = [];

    topDirs.forEach((d: any) => {
        const name = d.root;
        const total = d.total_files;
        const ts = d.ts_files;

        // Skip hidden folders (except .github maybe? nah ignore for high level)
        if (name.startsWith('.')) return;

        let status = "";
        let type = "";

        // Heuristics
        const isBackendName = /backend|service|api|server/i.test(name);
        const isConfigName = /config|infra|docker/i.test(name);
        const hasTs = ts > 0;
        const mostlyTs = total > 0 && (ts / total > 0.3); // >30% TS content

        if (hasTs && mostlyTs) {
            status = "✅ Active";
            type = "(TS/JS Source)";
            activeComponents.push(`\`${name}/\``);
        } else if (hasTs) {
            status = "✅ Active";
            type = "(Partial TS)";
            activeComponents.push(`\`${name}/\``);
        } else if (isBackendName) {
            status = "⚠️ Detected";
            type = "(Non-TS Backend)";
        } else if (isConfigName || name === 'configuration') {
            status = "ℹ️ Infrastructure";
            type = "(Config/Ops)";
        } else {
            status = "📄 Context";
            type = `(${total} files)`;
        }

        systemMap.push(`| \`${name}/\` | ${status} | ${type} |`);
    });

    const hasDockerCompose = db.prepare('SELECT 1 FROM files WHERE path = ?').get(repoPath + '/docker-compose.yml');
    if (hasDockerCompose) {
        typeHint = " (Docker/Service Monorepo detected)";
        systemMap.unshift(`| \`docker-compose.yml\` | 🐳 Orchestration | (Services defined) |`);
    }

    if (fileCount < 100) {
        sizeClass = 'small';
        strategy = 'You can safely use `get_project_summary` to view the full tree.';
    } else {
        if (fileCount < 500) {
            sizeClass = 'medium';
        } else {
            sizeClass = 'large';
        }

        if (activeComponents.length > 0) {
            const focusList = activeComponents.join(', ');
            strategy = `👉 **Focus on ${focusList}.** These are your TypeScript/JavaScript hotspots.\n` +
                `⚠️ **Unknown/Non-TS components:** See System Map below. Do not traverse them to save tokens.`;
        } else if (sizeClass === 'medium') {
            strategy = 'Use `get_project_summary` with a `subPath` to explore specific areas. Use `search_symbols` for direct lookups.';
        } else {
            strategy = '⚠️ **Prefer `search_symbols` over tree traversal.** Only use `get_project_summary` with a narrow `subPath`.';
        }
    }

    // 4. Get high-level summary (lite level with depth=1 for top-level only)
    const summary = await processRepo(repoPath, 5, 'lite', undefined, 1);

    const welcomeMessage = `
# Repository Indexed: ${repoPath}

## Overview
| Metric | Count |
|--------|-------|
| Files | ${fileCount} |
| Symbols | ${exportCount} |
| Dependencies | ${importCount} |
| **Size Class** | **${sizeClass.toUpperCase()}**${typeHint} |

## Recommended Strategy
${strategy}

## System Component Map
| Component | Status | Type |
|-----------|--------|------|
${systemMap.join('\n')}

## Quick Reference
| Goal | Tool | Example |
|------|------|---------|
| Find a function/class | \`search_symbols\` | \`search_symbols({ query: "AuthController" })\` |
| Explore a directory | \`get_project_summary\` | \`get_project_summary({ subPath: "src/services/" })\` |
| Understand a symbol | \`get_symbol_context\` | \`get_symbol_context({ symbolName: "calculatePrice" })\` |
| Check what imports a file | \`get_file_dependents\` | \`get_file_dependents({ filePath: "..." })\` |

## Top-Level Structure
`;

    return {
        content: [
            {
                type: 'text',
                text: welcomeMessage + JSON.stringify(summary, null, 2)
            }
        ],
    };
}

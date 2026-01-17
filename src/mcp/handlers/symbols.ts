import { ensureCacheUpToDate } from '../../index.js';
import { getDB } from '../../db.js';
import { resolveToolArgs } from '../utils.js';
import path from 'path';
import fs from 'fs';

export async function handleReadSymbol(args: any) {
    const { repoPath, filePath } = resolveToolArgs(args);
    const symbolName = String(args?.symbolName);
    const context = (args?.context || 'definition') as 'definition' | 'full';

    await ensureCacheUpToDate(repoPath);
    const db = getDB(repoPath);

    // 1. Find the symbol
    // We search for:
    // A) Exact name match (Top level or Member)
    // B) "Parent.Member" match (if query contains dot)
    // Ranking: Top-level > Member (unless dot usage)

    let queryArgs: any[] = [];
    let sql = `
        SELECT e.name, e.kind, e.start_line, e.end_line, e.signature, e.doc, 
               f.path as file_path, e.classification, e.capabilities,
               p.name as parent_name, p.kind as parent_kind
        FROM exports e
        JOIN files f ON e.file_path = f.path
        LEFT JOIN exports p ON e.parent_id = p.id
        WHERE 
    `;

    if (symbolName.includes('.')) {
        // Dot syntax: "CMPubSub.publishSubscriptionEvent"
        const [parent, member] = symbolName.split('.');
        sql += `(p.name = ? AND e.name = ?)`;
        queryArgs.push(parent, member);
    } else {
        // Standard syntax: "publishSubscriptionEvent" or "CMPubSub"
        sql += `(e.name = ?)`;
        queryArgs.push(symbolName);
    }

    if (filePath) {
        sql += ' AND f.path = ?';
        queryArgs.push(filePath);
    }

    // Ranking Logic:
    // 1. Top-Level Exports (parent_id IS NULL)
    // 2. Members (parent_id IS NOT NULL)
    sql += `
        ORDER BY 
        CASE WHEN e.parent_id IS NULL THEN 0 ELSE 1 END,
        CASE WHEN e.kind = 'ExportSpecifier' THEN 2 ELSE 0 END
        LIMIT 10
    `;

    const results = db.prepare(sql).all(...queryArgs) as any[];

    if (results.length === 0) {
        // Fallback: Check if it might be a method of a class (fuzzy match on content)
        const potentialParents = db.prepare(`
            SELECT name, kind, file_path 
            FROM exports 
            WHERE kind IN ('ClassDeclaration', 'ClassExpression', 'TsInterfaceDeclaration')
            AND id IN (
                SELECT rowid FROM content_fts WHERE content MATCH ?
            )
            LIMIT 3
        `).all(symbolName);

        if (potentialParents.length > 0) {
            const suggestions = potentialParents.map((p: any) => `\`${p.name}\` (in ${path.relative(repoPath, p.file_path)})`).join(', ');
            return {
                content: [{
                    type: 'text',
                    text: `Symbol "${symbolName}" not found as a top-level export.\n` +
                        `However, it likely exists inside: ${suggestions}.\n` +
                        `Try: read_symbol({ symbolName: "${(potentialParents[0] as any).name}", context: "full" }) to see the class body.`
                }],
            };
        }

        return {
            content: [{
                type: 'text',
                text: `Symbol "${symbolName}" not found in the codebase.`
            }],
        };
    }

    const result = results[0];

    // --- De-Barrelling Auto-Resolution ---
    // If the found symbol is just a re-export (e.g. export { Foo } from './foo'),
    // we should traverse to the original file to give the user the ACTUAL code.
    if (result.kind === 'ExportSpecifier' || result.kind === 'ExportAllDeclaration') {
        const importSource = db.prepare(`
            SELECT resolved_path 
            FROM imports 
            WHERE file_path = ? 
            AND (imported_symbols LIKE ? OR imported_symbols = '*')
        `).get(result.file_path, `%${symbolName}%`) as any;

        if (importSource && importSource.resolved_path) {
            // Recursively redirect the search to the definition file
            // Max recursion is naturally limited by the tool call being one-shot here, 
            // but we are effectively chaining the query.
            return handleReadSymbol({
                ...args,
                filePath: importSource.resolved_path,
                // keep same symbolName
            });
        }
    }
    // -------------------------------------

    // Read source file
    const sourceCode = fs.readFileSync(result.file_path, 'utf8');
    const lines = sourceCode.split('\n');

    // Calculate symbol size and truncate if needed for definition mode
    const sourceLineCount = result.end_line - result.start_line + 1;
    const MAX_LINES_DEFINITION = 150;

    let symbolSource: string;
    let truncated = false;

    if (context === 'definition' && sourceLineCount > MAX_LINES_DEFINITION) {
        // For large symbols, show first MAX_LINES with continuation message
        const previewLines = lines.slice(result.start_line - 1, result.start_line - 1 + MAX_LINES_DEFINITION);
        symbolSource = previewLines.join('\n') +
            `\n\n... [Truncated ${sourceLineCount - MAX_LINES_DEFINITION} more lines] ...\n` +
            `\nℹ️  Symbol has ${sourceLineCount} total lines. To see the full implementation:\n` +
            `   • Use Read tool: Read({ file_path: "${result.file_path}", offset: ${result.start_line}, limit: ${sourceLineCount} })\n` +
            `   • Or use context="full" to see with dependencies and usage examples`;
        truncated = true;
    } else {
        // Normal case: include full source
        symbolSource = lines.slice(result.start_line - 1, result.end_line).join('\n');
    }

    // Construct Definition Data
    // Use Hierarchical Name if applicable
    const displayName = result.parent_name
        ? `${result.parent_name}.${result.name}`
        : result.name;

    const definitionData = {
        name: displayName,
        kind: result.kind,
        file: path.relative(repoPath, result.file_path),
        startLine: result.start_line,
        endLine: result.end_line,
        totalLines: sourceLineCount,
        ...(truncated && { truncated: true, previewLines: MAX_LINES_DEFINITION }),
        doc: result.doc || undefined,
        classification: result.classification,
        capabilities: JSON.parse(result.capabilities || '[]'),
        parent: result.parent_name ? {
            name: result.parent_name,
            kind: result.parent_kind
        } : undefined,
        source: symbolSource
    };

    if (context === 'definition') {
        return {
            content: [{ type: 'text', text: JSON.stringify(definitionData, null, 2) }]
        };
    }

    // Context = full
    const fullData: any = {
        definition: definitionData
    };

    // 2. Get direct dependencies (what this symbol imports)
    const dependencies = db.prepare(`
        SELECT module_specifier as module, imported_symbols as symbols, resolved_path
        FROM imports
        WHERE file_path = ?
    `).all(result.file_path) as any[];

    fullData.dependencies = dependencies.map((imp: any) => ({
        module: imp.module,
        symbols: imp.symbols,
        resolvedPath: imp.resolved_path || null,
        relativePath: imp.resolved_path ? path.relative(repoPath, imp.resolved_path) : null,
        isExternal: !imp.resolved_path
    }));

    // 3. Get usage examples (who imports this symbol)
    // Find all files that re-export this file (proxies/barrels) recursively
    const proxies = new Set<string>();
    proxies.add(result.file_path);

    let currentLevel = [result.file_path];
    while (currentLevel.length > 0) {
        const nextLevel: string[] = [];
        for (const p of currentLevel) {
            const proxyResults = db.prepare(`
                SELECT i.file_path
                FROM imports i
                JOIN exports e ON i.file_path = e.file_path
                WHERE i.resolved_path = ?
                AND (e.kind = 'ExportAllDeclaration' OR e.kind = 'ExportMapping')
            `).all(p) as any[];

            for (const r of proxyResults) {
                if (!proxies.has(r.file_path)) {
                    proxies.add(r.file_path);
                    nextLevel.push(r.file_path);
                }
            }
        }
        currentLevel = nextLevel;
    }

    const proxyList = Array.from(proxies);
    const placeholders = proxyList.map(() => '?').join(',');

    // A) Get Verified Dependents (Strict Graph)
    const verifiedDependents = db.prepare(`
        SELECT i.file_path, i.imported_symbols, f.classification, f.summary
        FROM imports i
        JOIN files f ON i.file_path = f.path
        WHERE i.resolved_path IN (${placeholders})
        AND (i.imported_symbols LIKE ? OR i.imported_symbols = '' OR i.imported_symbols = '*')
        LIMIT 10
    `).all(...proxyList, `%${symbolName}%`) as any[];

    const verifiedUsages = [];
    const processedPaths = new Set<string>();

    for (const dep of verifiedDependents) {
        if (dep.file_path === result.file_path) continue;
        processedPaths.add(dep.file_path);

        try {
            const depSourceCode = fs.readFileSync(dep.file_path, 'utf8');
            const depLines = depSourceCode.split('\n');

            for (let i = 0; i < depLines.length; i++) {
                if (depLines[i].includes(symbolName)) {
                    const contextStart = Math.max(0, i - 1);
                    const contextEnd = Math.min(depLines.length, i + 2);
                    verifiedUsages.push({
                        file: path.relative(repoPath, dep.file_path),
                        classification: dep.classification,
                        importedSymbols: dep.imported_symbols,
                        usage: {
                            line: i + 1,
                            code: depLines.slice(contextStart, contextEnd).join('\n')
                        }
                    });
                    break;
                }
            }
        } catch (err) { }
    }

    // B) Get Fuzzy Mentions (Smart Grep fallback)
    // Only search if we want "full" context and haven't hit the limit
    let looseMentions: any[] = [];
    try {
        const ftsResults = db.prepare(`
            SELECT file_path, snippet(content_fts, 1, '>>', '<<', '...', 10) as highlight
            FROM content_fts
            WHERE content_fts MATCH ?
            LIMIT 8
        `).all(symbolName) as any[];

        looseMentions = ftsResults
            .filter(r => !processedPaths.has(r.file_path) && r.file_path !== result.file_path)
            .slice(0, 5) // Limit to top 5 most relevant mentions
            .map(r => {
                const fileMeta = db.prepare('SELECT classification FROM files WHERE path = ?').get(r.file_path) as any;
                return {
                    file: path.relative(repoPath, r.file_path),
                    classification: fileMeta?.classification || 'Unknown',
                    reason: 'Text mention (no explicit import)',
                    snippet: r.highlight
                };
            });
    } catch (e) {
        // FTS might fail if symbols have special chars, ignore for now
    }

    fullData.usageStats = {
        totalVerified: (db.prepare(`
            SELECT COUNT(*) as count FROM imports 
            WHERE resolved_path IN (${placeholders})
            AND (imported_symbols LIKE ? OR imported_symbols = '' OR imported_symbols = '*')
        `).get(...proxyList, `%${symbolName}%`) as any).count
    };

    fullData.verifiedUsages = verifiedUsages;
    fullData.looseMentions = looseMentions;

    return {
        content: [{ type: 'text', text: JSON.stringify(fullData, null, 2) }],
    };
}

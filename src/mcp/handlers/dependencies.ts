import { ensureCacheUpToDate } from '../../index.js';
import { getDB } from '../../db.js';
import { resolveToolArgs } from '../utils.js';
import { diagnoseResolution } from '../../resolver/index.js';
import { IMPACT_ANALYSIS_QUERY } from '../../graph-queries.js';
import path from 'path';

export async function handleGetFileDependencies(args: any) {
    const { repoPath, filePath } = resolveToolArgs(args);
    if (!filePath) {
        return { content: [{ type: 'text', text: 'Error: filePath is required' }], isError: true };
    }

    await ensureCacheUpToDate(repoPath);
    const db = getDB(repoPath);

    const imports = db.prepare(`
        SELECT module_specifier as module, imported_symbols as symbols, resolved_path
        FROM imports
        WHERE file_path = ?
    `).all(filePath) as any[];

    // Enhance output with resolution status AND diagnostics
    const enhanced = imports.map(imp => {
        const base = {
            module: imp.module,
            symbols: imp.symbols,
            resolvedPath: imp.resolved_path || null,
            relativePath: imp.resolved_path ? path.relative(repoPath, imp.resolved_path) : null,
            isExternal: !imp.resolved_path
        };

        // Add diagnostic info if resolution failed and it's not obviously an external lib (simple check)
        if (!imp.resolved_path) {
            const diagnostic = diagnoseResolution(imp.module, filePath, repoPath);
            if (!diagnostic.resolved) {
                return {
                    ...base,
                    resolutionError: diagnostic.error,
                    suggestion: diagnostic.suggestion
                };
            }
        }
        return base;
    });

    return {
        content: [{ type: 'text', text: JSON.stringify(enhanced, null, 2) }],
    };
}

export async function handleGetFileDependents(args: any) {
    const { repoPath, filePath: targetFilePath } = resolveToolArgs(args);
    if (!targetFilePath) {
        return { content: [{ type: 'text', text: 'Error: filePath is required' }], isError: true };
    }

    await ensureCacheUpToDate(repoPath);
    const db = getDB(repoPath);

    // Use resolved_path for accurate matching
    const results = db.prepare(`
        SELECT i.module_specifier, i.file_path, i.imported_symbols
        FROM imports i
        WHERE i.resolved_path = ?
    `).all(targetFilePath) as any[];

    const dependents = results.map((r: any) => ({
        file: r.file_path,
        relativePath: path.relative(repoPath, r.file_path),
        importStatement: r.module_specifier,
        importedSymbols: r.imported_symbols
    }));

    return {
        content: [{ type: 'text', text: JSON.stringify(dependents, null, 2) }],
    };
}

export async function handleAnalyzeChangeImpact(args: any) {
    const { repoPath, filePath } = resolveToolArgs(args);
    const symbolName = String(args?.symbolName);
    const depth = args?.depth ? Number(args.depth) : 3;

    await ensureCacheUpToDate(repoPath);
    const db = getDB(repoPath);

    // 1. Find the symbol definition(s)
    let query = 'SELECT e.id, f.path as file_path FROM exports e JOIN files f ON e.file_path = f.path WHERE e.name = ?';
    const params: any[] = [symbolName];
    if (filePath) {
        query += ' AND f.path = ?';
        params.push(filePath);
    }
    const symbols = db.prepare(query).all(...params) as any[];

    if (symbols.length === 0) {
        return {
            content: [{ type: 'text', text: `Symbol "${symbolName}" not found.` }],
            isError: true
        };
    }

    const impactResults = [];
    for (const sym of symbols) {
        // Run recursive CTE
        const dependents = db.prepare(IMPACT_ANALYSIS_QUERY).all(sym.file_path, `%${symbolName}%`, depth);
        impactResults.push({
            symbol: symbolName,
            definedIn: path.relative(repoPath, sym.file_path),
            impact: dependents.map((d: any) => ({
                file: path.relative(repoPath, d.consumer_path),
                depth: d.depth,
                importer: path.relative(repoPath, d.source_path),
                importedAs: d.imported_symbols
            }))
        });
    }

    return {
        content: [{ type: 'text', text: JSON.stringify(impactResults, null, 2) }],
    };
}

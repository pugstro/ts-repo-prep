import { ensureCacheUpToDate } from '../../index.js';
import { getDB } from '../../db.js';
import { resolveToolArgs } from '../utils.js';
import path from 'path';
import fs from 'fs';

export async function handleGetSymbolDefinition(args: any) {
    const { repoPath, filePath } = resolveToolArgs(args);
    const symbolName = String(args?.symbolName);

    await ensureCacheUpToDate(repoPath);
    const db = getDB(repoPath);

    // Find the symbol - order by kind to prefer actual implementations over re-exports
    let query = `
        SELECT e.name, e.kind, e.start_line, e.end_line, e.signature, e.doc, f.path as file_path, e.classification, e.capabilities
        FROM exports e
        JOIN files f ON e.file_path = f.path
        WHERE e.name = ?
    `;
    const params: any[] = [symbolName];

    if (filePath) {
        query += ' AND f.path = ?';
        params.push(filePath);
    }
    // Order to prefer implementations over re-exports
    query += ' ORDER BY CASE WHEN e.kind = \'ExportSpecifier\' THEN 1 ELSE 0 END, (e.end_line - e.start_line) DESC LIMIT 10';

    const results = db.prepare(query).all(...params) as any[];

    if (results.length === 0) {
        return {
            content: [{
                type: 'text',
                text: `Symbol "${symbolName}" not found in the codebase.`
            }],
        };
    }

    // If multiple matches without filePath specified and they're different implementations (not re-exports)
    const implementations = results.filter((r: any) => r.kind !== 'ExportSpecifier');
    if (implementations.length > 1 && !filePath) {
        const matches = implementations.map(r => ({
            file: path.relative(repoPath, r.file_path),
            name: r.name,
            kind: r.kind,
            line: r.start_line
        }));
        return {
            content: [{
                type: 'text',
                text: `Multiple implementations found. Please specify filePath:\n${JSON.stringify(matches, null, 2)}`
            }],
        };
    }

    const result = results[0];

    // Read source file and extract the symbol's source code
    const sourceCode = fs.readFileSync(result.file_path, 'utf8');
    const lines = sourceCode.split('\n');

    // Extract lines from start_line to end_line (1-indexed)
    const symbolSource = lines.slice(result.start_line - 1, result.end_line).join('\n');

    return {
        content: [{
            type: 'text',
            text: JSON.stringify({
                name: result.name,
                kind: result.kind,
                file: path.relative(repoPath, result.file_path),
                startLine: result.start_line,
                endLine: result.end_line,
                doc: result.doc || undefined,
                classification: result.classification,
                capabilities: JSON.parse(result.capabilities || '[]'),
                source: symbolSource
            }, null, 2)
        }],
    };
}

export async function handleGetSymbolsBatch(args: any) {
    const symbols = (args?.symbols as any[]) || [];

    if (symbols.length === 0) {
        return {
            content: [{ type: 'text', text: 'Error: No symbols specified' }],
            isError: true,
        };
    }

    // Use the first symbol with a filePath to infer repoPath if not provided
    const hintFile = symbols.find(s => s.filePath)?.filePath;
    const { repoPath } = resolveToolArgs({ repoPath: args.repoPath, filePath: hintFile });

    await ensureCacheUpToDate(repoPath);
    const db = getDB(repoPath);

    const results: any[] = [];
    const notFound: string[] = [];

    for (const sym of symbols) {
        const symbolName = String(sym.symbolName);
        // Resolve per-symbol filePath relative to the determined repoPath
        const resolvedFilePath = sym.filePath ? path.resolve(repoPath, sym.filePath) : undefined;

        // Find the symbol - order by kind to prefer actual implementations over re-exports
        let query = `
            SELECT e.name, e.kind, e.start_line, e.end_line, e.signature, e.doc, f.path as file_path, e.classification, e.capabilities
            FROM exports e
            JOIN files f ON e.file_path = f.path
            WHERE e.name = ?
        `;
        const params: any[] = [symbolName];

        if (resolvedFilePath) {
            query += ' AND f.path = ?';
            params.push(resolvedFilePath);
        }
        query += ' ORDER BY CASE WHEN e.kind = \'ExportSpecifier\' THEN 1 ELSE 0 END, (e.end_line - e.start_line) DESC LIMIT 1';

        const result = db.prepare(query).get(...params) as any;

        if (!result) {
            notFound.push(resolvedFilePath ? `${symbolName} in ${resolvedFilePath}` : symbolName);
            continue;
        }

        // Read source file and extract the symbol's source code
        const sourceCode = fs.readFileSync(result.file_path, 'utf8');
        const lines = sourceCode.split('\n');

        // Extract lines from start_line to end_line (1-indexed)
        const symbolSource = lines.slice(result.start_line - 1, result.end_line).join('\n');

        results.push({
            name: result.name,
            kind: result.kind,
            file: path.relative(repoPath, result.file_path),
            startLine: result.start_line,
            endLine: result.end_line,
            doc: result.doc || undefined,
            classification: result.classification,
            capabilities: JSON.parse(result.capabilities || '[]'),
            source: symbolSource
        });
    }

    const response: any = {
        symbols: results,
        notFound: notFound.length > 0 ? notFound : undefined
    };

    return {
        content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
    };
}

export async function handleGetSymbolContext(args: any) {
    const { repoPath, filePath } = resolveToolArgs(args);
    const symbolName = String(args?.symbolName);
    const includeUsages = args?.includeUsages !== false; // default true
    const maxUsageExamples = args?.maxUsageExamples ? Number(args.maxUsageExamples) : 3;

    await ensureCacheUpToDate(repoPath);
    const db = getDB(repoPath);

    // 1. Get the symbol definition (same as get_symbol_definition)
    let query = `
        SELECT e.name, e.kind, e.start_line, e.end_line, e.signature, e.doc, f.path as file_path, e.classification, e.capabilities
        FROM exports e
        JOIN files f ON e.file_path = f.path
        WHERE e.name = ?
    `;
    const params: any[] = [symbolName];

    if (filePath) {
        query += ' AND f.path = ?';
        params.push(filePath);
    }
    query += ' ORDER BY CASE WHEN e.kind = \'ExportSpecifier\' THEN 1 ELSE 0 END, (e.end_line - e.start_line) DESC LIMIT 10';

    const results = db.prepare(query).all(...params) as any[];

    if (results.length === 0) {
        return {
            content: [{
                type: 'text',
                text: `Symbol "${symbolName}" not found in the codebase.`
            }],
        };
    }

    // If multiple matches without filePath specified
    const implementations = results.filter((r: any) => r.kind !== 'ExportSpecifier');
    if (implementations.length > 1 && !filePath) {
        const matches = implementations.map(r => ({
            file: path.relative(repoPath, r.file_path),
            name: r.name,
            kind: r.kind,
            line: r.start_line
        }));
        return {
            content: [{
                type: 'text',
                text: `Multiple implementations found. Please specify filePath:\n${JSON.stringify(matches, null, 2)}`
            }],
        };
    }

    const result = results[0];

    // Read source file and extract the symbol's source code
    const sourceCode = fs.readFileSync(result.file_path, 'utf8');
    const lines = sourceCode.split('\n');
    const symbolSource = lines.slice(result.start_line - 1, result.end_line).join('\n');

    const contextData: any = {
        definition: {
            name: result.name,
            kind: result.kind,
            file: path.relative(repoPath, result.file_path),
            startLine: result.start_line,
            endLine: result.end_line,
            doc: result.doc || undefined,
            classification: result.classification,
            capabilities: JSON.parse(result.capabilities || '[]'),
            source: symbolSource
        }
    };

    // 2. Get direct dependencies (what this symbol imports)
    const dependencies = db.prepare(`
        SELECT module_specifier as module, imported_symbols as symbols, resolved_path
        FROM imports
        WHERE file_path = ?
    `).all(result.file_path) as any[];

    contextData.dependencies = dependencies.map((imp: any) => ({
        module: imp.module,
        symbols: imp.symbols,
        resolvedPath: imp.resolved_path || null,
        relativePath: imp.resolved_path ? path.relative(repoPath, imp.resolved_path) : null,
        isExternal: !imp.resolved_path
    }));

    // 3. Get usage examples (who imports this symbol)
    if (includeUsages) {
        const dependents = db.prepare(`
            SELECT i.file_path, i.imported_symbols
            FROM imports i
            WHERE i.resolved_path = ?
            AND (i.imported_symbols LIKE ? OR i.imported_symbols = '' OR i.imported_symbols = '*')
            LIMIT ?
        `).all(result.file_path, `%${symbolName}%`, maxUsageExamples) as any[];

        const usageExamples = [];
        for (const dep of dependents) {
            try {
                const depSourceCode = fs.readFileSync(dep.file_path, 'utf8');
                const depLines = depSourceCode.split('\n');

                // Find lines that reference the symbol (simple heuristic)
                const usageLines: { line: number; code: string }[] = [];
                for (let i = 0; i < depLines.length; i++) {
                    if (depLines[i].includes(symbolName)) {
                        // Get 2 lines of context (before and after)
                        const contextStart = Math.max(0, i - 1);
                        const contextEnd = Math.min(depLines.length, i + 2);
                        const contextLines = depLines.slice(contextStart, contextEnd);

                        usageLines.push({
                            line: i + 1,
                            code: contextLines.join('\n')
                        });

                        // Only take first usage from each file to save space
                        break;
                    }
                }

                if (usageLines.length > 0) {
                    usageExamples.push({
                        file: path.relative(repoPath, dep.file_path),
                        importedSymbols: dep.imported_symbols,
                        usage: usageLines[0]
                    });
                }
            } catch (err) {
                // File might not exist or be readable, skip
                continue;
            }
        }

        contextData.usageExamples = usageExamples;
    }

    return {
        content: [{ type: 'text', text: JSON.stringify(contextData, null, 2) }],
    };
}

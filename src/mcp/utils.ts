/**
 * Shared utilities for MCP handlers.
 */

import path from 'path';
import fs from 'fs';

/**
 * recursively searches up the directory tree for a repository root marker.
 */
export function findRepoRoot(startPath: string): string | null {
  let current = startPath;
  const root = path.parse(current).root;

  while (current !== root) {
    if (fs.existsSync(path.join(current, '.repo-prep.db'))) return current;
    if (fs.existsSync(path.join(current, '.git'))) return current;
    if (fs.existsSync(path.join(current, 'package.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break; // Safety break
    current = parent;
  }
  return null;
}

/**
 * Standardized argument resolution for all MCP tools.
 * auto-resolves repoPath and filePath to absolute paths.
 */
export function resolveToolArgs(args: any): { repoPath: string; filePath?: string } {
  let repoPathStr = args?.repoPath ? String(args.repoPath) : undefined;
  let filePathStr = args?.filePath ? String(args.filePath) : undefined;
  let repoPath: string;

  // 1. Resolve Repo Path
  if (repoPathStr) {
    if (!path.isAbsolute(repoPathStr)) {
      repoPathStr = path.resolve(process.cwd(), repoPathStr);
    }
    repoPath = repoPathStr;
  } else if (filePathStr) {
    // Try to infer from file path
    const absFile = path.resolve(process.cwd(), filePathStr);
    const inferred = findRepoRoot(path.dirname(absFile));
    repoPath = inferred || process.cwd(); // Fallback to CWD if inference fails
  } else {
    repoPath = process.cwd();
  }

  // 2. Resolve File Path (if exists)
  let finalFilePath: string | undefined;
  if (filePathStr) {
    if (path.isAbsolute(filePathStr)) {
      finalFilePath = filePathStr;
    } else {
      // Resolve relative paths against the DETERMINED repoPath, not CWD
      // This allows "src/utils.ts" to work regardless of where the CWD is, 
      // as long as repoPath is correct (or inferred correctly).
      finalFilePath = path.resolve(repoPath, filePathStr);
    }
  }

  return { repoPath, filePath: finalFilePath };
}

/**
 * Normalizes a repository path to an absolute path.
 * Handles both absolute and relative paths.
 * @deprecated Use resolveToolArgs instead for new tools.
 */
export function normalizeRepoPath(repoPath: string): string {
  if (path.isAbsolute(repoPath)) return repoPath;
  return path.resolve(process.cwd(), repoPath);
}

/**
 * Extracts source code from a file between given line numbers.
 * @param filePath Absolute path to the source file
 * @param startLine Starting line number (1-based, inclusive)
 * @param endLine Ending line number (1-based, inclusive)
 * @returns Extracted source code as string
 */
export function extractSymbolSource(filePath: string, startLine: number, endLine: number): string {
  const sourceCode = fs.readFileSync(filePath, 'utf8');
  const lines = sourceCode.split('\n');
  return lines.slice(startLine - 1, endLine).join('\n');
}

/**
 * Formats a path as relative to the repository root for display.
 * @param repoPath Repository root path
 * @param absolutePath Absolute file path
 * @returns Relative path from repo root
 */
export function formatRelativePath(repoPath: string, absolutePath: string): string {
  return path.relative(repoPath, absolutePath);
}

/**
 * Parses a resource URI in the format: repo://<path>/resource-name
 * @param uri Resource URI string
 * @returns Object with repoPath and resource name, or null if invalid
 */
export function parseResourceURI(uri: string): { repoPath: string; resource: string } | null {
  if (!uri.startsWith('repo://')) return null;

  if (uri.endsWith('/dependency-graph')) {
    const rawPath = uri.replace('repo://', '').replace('/dependency-graph', '');
    return { repoPath: rawPath, resource: 'dependency-graph' };
  }

  if (uri.endsWith('/statistics')) {
    const rawPath = uri.replace('repo://', '').replace('/statistics', '');
    return { repoPath: rawPath, resource: 'statistics' };
  }

  return null;
}

/**
 * Finds a symbol definition in the database.
 * Prefers actual implementations over re-exports.
 * @param db Database instance
 * @param symbolName Symbol name to find
 * @param filePath Optional file path for disambiguation
 * @returns Database row or null if not found
 */
export function findSymbolDefinition(db: any, symbolName: string, filePath?: string): any {
  let query = `
    SELECT e.name, e.kind, e.start_line, e.end_line, e.signature, e.doc,
           f.path as file_path, e.classification, e.capabilities
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
  query += ' ORDER BY CASE WHEN e.kind = \'ExportSpecifier\' THEN 1 ELSE 0 END, (e.end_line - e.start_line) DESC LIMIT 1';

  return db.prepare(query).get(...params);
}

/**
 * Finds all definitions of a symbol (for disambiguation).
 * @param db Database instance
 * @param symbolName Symbol name to find
 * @param filePath Optional file path for filtering
 * @returns Array of database rows
 */
export function findAllSymbolDefinitions(db: any, symbolName: string, filePath?: string): any[] {
  let query = `
    SELECT e.name, e.kind, e.start_line, e.end_line, e.signature, e.doc,
           f.path as file_path, e.classification, e.capabilities
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

  return db.prepare(query).all(...params);
}

/**
 * Utilities for classifying code elements and detecting capabilities.
 */

/**
 * Classifies a code element based on file path, name, kind, and content.
 * @param fileName The file path
 * @param name Symbol name
 * @param kind AST node kind
 * @param content Code snippet
 * @returns Classification string
 */
export function getClassification(
  fileName: string,
  name: string,
  kind: string,
  content: string
): string {
  const lowerFileName = fileName.toLowerCase();
  const lowerName = name.toLowerCase();

  if (lowerFileName.includes('components/') || lowerFileName.endsWith('.tsx')) return 'Component';
  if (lowerFileName.startsWith('use') || lowerName.startsWith('use')) return 'Hook';
  if (lowerFileName.includes('models/') || lowerName.endsWith('model')) return 'Model';

  if (
    lowerFileName.includes('services/') ||
    lowerFileName.includes('controllers/') ||
    lowerFileName.includes('handlers/') ||
    lowerFileName.includes('mcp/') ||
    lowerFileName.endsWith('service.ts') ||
    lowerFileName.endsWith('controller.ts') ||
    lowerFileName.endsWith('handler.ts') ||
    lowerName.endsWith('service') ||
    lowerName.endsWith('controller') ||
    lowerName.endsWith('handler')
  ) {
    return 'Service';
  }

  if (
    lowerFileName.includes('repositories/') ||
    lowerFileName.includes('repos/') ||
    lowerFileName.endsWith('repository.ts') ||
    lowerFileName.endsWith('repo.ts') ||
    lowerName.endsWith('repository') ||
    lowerName.endsWith('repo')
  ) {
    return 'Repository';
  }

  if (kind === 'TsInterfaceDeclaration' || kind === 'TsTypeAliasDeclaration') {
    return 'Type Definition';
  }
  return 'Other';
}

/**
 * Detects capabilities (side-effects) from code content.
 * @param content Code snippet to analyze
 * @returns Array of capability strings (Network, Database, File System, Browser Storage)
 */
export function getCapabilities(content: string): string[] {
  const caps: string[] = [];
  // Network: check for fetch call, axios, or http/https library imports/usage
  // Avoid matching 'http' in URLs within strings/comments if possible (hard with regex, but we can be stricter)
  if (/\b(fetch|axios|superagent|got)\s*\(|import\s+.*\b(http|https|node-fetch)\b/i.test(content)) {
    caps.push('Network');
  }

  // Database: check mostly for ORMs or SQL patterns
  // Removed "repository" and simple "db" as they are common variable names in non-DB contexts
  if (/\b(knex|prisma|typeorm|mongoose|sequelize|pg|mysql|sqlite3)\b/i.test(content)) {
    caps.push('Database');
  } else if (/\b(SELECT\s+.*FROM|INSERT\s+INTO|UPDATE\s+.*SET|DELETE\s+FROM)\b/i.test(content)) {
    // Basic SQL detection
    caps.push('Database');
  } else if (/\.query\s*\(|\.execute\s*\(/i.test(content) && /db|database|client|pool/i.test(content)) {
    // Heuristic: .query() or .execute() call on a variable named likely as a DB handler
    caps.push('Database');
  }

  // File System
  if (/\bfs\./i.test(content) || /\b(readFileSync|writeFileSync|readFile|writeFile|readdir)\b/.test(content)) {
    caps.push('File System');
  } else if (/import\s+.*\bfs\b/.test(content)) {
    caps.push('File System');
  }

  // Browser Storage
  if (/\b(localStorage|sessionStorage|indexedDB)\./.test(content)) {
    caps.push('Browser Storage');
  } else if (/\bdocument\.cookie\b/.test(content)) {
    caps.push('Browser Storage');
  }
  return caps;
}

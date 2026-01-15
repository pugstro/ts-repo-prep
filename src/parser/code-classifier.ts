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
  if (fileName.includes('components/') || fileName.endsWith('.tsx')) return 'Component';
  if (fileName.startsWith('use') || name.startsWith('use')) return 'Hook';
  if (fileName.includes('models/') || name.endsWith('Model')) return 'Model';
  if (fileName.includes('services/') || name.endsWith('Service') || name.endsWith('Controller')) {
    return 'Service';
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
  if (/fetch|axios|http|https/i.test(content)) {
    caps.push('Network');
  }
  if (/db|query|repository|Transaction|knex|prisma|typeorm/i.test(content)) {
    caps.push('Database');
  }
  if (/fs\.|path\.|readFileSync|writeFile/i.test(content)) {
    caps.push('File System');
  }
  if (/localStorage|sessionStorage|Cookies/i.test(content)) {
    caps.push('Browser Storage');
  }
  return caps;
}

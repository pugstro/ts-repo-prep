/**
 * Utility for cleaning and formatting code signatures.
 * Removes implementation details while preserving type information.
 */

/**
 * Cleans a code signature by removing JSDoc and implementation bodies.
 * For types/interfaces, keeps the full definition.
 * For functions/classes, keeps only the signature (not the body).
 *
 * @param fullText The full code snippet from AST
 * @param kind The AST node kind (e.g., 'TsInterfaceDeclaration', 'FunctionDeclaration')
 * @returns Cleaned signature string
 */
export function cleanSignature(fullText: string, kind?: string): string {
  if (!fullText) return '';

  // Remove JSDoc comments from the start of the signature if present
  // (We store docs separately, so we don't want them in the signature)
  let cleaned = fullText.replace(/\/\*\*[\s\S]*?\*\/\s*/, '').trim();

  // For Types/Interfaces, we WANT the body/shape!
  if (kind === 'TsInterfaceDeclaration' || kind === 'TsTypeAliasDeclaration') {
    return cleaned;
  }

  // For Classes/Functions, keep the signature but truncate the body
  let endIdx = cleaned.length;
  const braceIdx = cleaned.indexOf('{');
  const arrowIdx = cleaned.indexOf('=>');
  const semiIdx = cleaned.indexOf(';');

  const indices = [braceIdx, arrowIdx, semiIdx].filter(i => i !== -1);
  if (indices.length > 0) {
    endIdx = Math.min(...indices);
    if (endIdx === arrowIdx) endIdx += 2; // Keep '=>' for arrow functions
  }

  return cleaned.substring(0, endIdx).trim();
}

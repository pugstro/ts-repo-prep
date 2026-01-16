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

  // 1. Remove JSDoc comments / leading comments
  // Robust regex to handle:
  // - Normal JSDoc: /** ... */
  // - Partial header fragments: ... */ (if snippet started late)
  // - Import garbage: ... } from '...'; (if snippet started too early/captured previous lines)
  let cleaned = fullText
    .replace(/^([\s\S]*?\*\/)?\s*/, '')
    .replace(/^.*\} from ['"].*['"];?\s*/, '')
    .replace(/^import .*['"];?\s*/, '')
    .trim();

  // For Types/Interfaces, we WANT the body/shape!
  if (kind === 'TsInterfaceDeclaration' || kind === 'TsTypeAliasDeclaration') {
    return cleaned;
  }

  // 2. For Classes/Functions, truncate the body but respect generics/params
  // We want to find the first '{' that indicates the start of the body.
  // This usually means it's not inside <...> or (...).

  let depthParen = 0;
  let depthAngle = 0;
  let endIdx = cleaned.length;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (char === '(') depthParen++;
    else if (char === ')') depthParen--;
    else if (char === '<') depthAngle++;
    else if (char === '>') depthAngle--;
    else if (char === '{') {
      // If we hit a brace at top level (no parens/angles open), this is the body start
      if (depthParen === 0 && depthAngle === 0) {
        endIdx = i;
        break;
      }
    }
    else if (char === ';' && depthParen === 0 && depthAngle === 0) {
      // End of signature for abstract methods / declarations
      endIdx = i;
      break;
    }
    // Handle arrow function '=>'
    else if (char === '=' && cleaned[i + 1] === '>' && depthParen === 0 && depthAngle === 0) {
      endIdx = i + 2; // Include '=>'
      break;
    }
  }

  return cleaned.substring(0, endIdx).trim();
}


/**
 * Utilities for extracting and processing JSDoc comments from source code.
 */

export interface JSDocComment {
  start: number;
  end: number;
  text: string;
}

/**
 * Extracts all JSDoc comments from source code using regex.
 * @param code The full source code string
 * @returns Array of JSDoc comments with their positions
 */
export function extractJSDocComments(code: string): JSDocComment[] {
  const jsDocComments: JSDocComment[] = [];
  const jsDocRegex = /\/\*\*[\s\S]*?\*\//g;
  let match;
  while ((match = jsDocRegex.exec(code)) !== null) {
    jsDocComments.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0]
    });
  }
  return jsDocComments;
}

/**
 * Finds the JSDoc comment associated with a declaration at a given position.
 * SWC often includes the JSDoc in the declaration's span, so we check if
 * a JSDoc starts at or shortly after the span start (within whitespace).
 *
 * @param spanStartCharPos Character position where the declaration starts
 * @param jsDocComments Array of all JSDoc comments in the file
 * @param code Full source code (for whitespace checking)
 * @returns The JSDoc comment text, or empty string if none found
 */
export function findJSDocForPosition(
  spanStartCharPos: number,
  jsDocComments: JSDocComment[],
  code: string
): string {
  for (const comment of jsDocComments) {
    // Check if JSDoc starts at the span start (included in span)
    if (comment.start === spanStartCharPos) {
      return comment.text;
    }
    // Check if JSDoc starts shortly after span start (within whitespace)
    if (comment.start > spanStartCharPos && comment.start < spanStartCharPos + 50) {
      const between = code.substring(spanStartCharPos, comment.start);
      if (/^\s*$/.test(between)) {
        return comment.text;
      }
    }
  }
  return '';
}

/**
 * Extracts a summary from a JSDoc comment (first sentence/line).
 * @param doc JSDoc comment text
 * @returns Summary string, or empty if no doc
 */
export function getSummary(doc: string): string {
  if (!doc) return '';
  const cleaned = doc.replace(/\/\*\*|\*\/|\*/g, '').trim();
  const firstLine = cleaned.split('\n')[0].trim();
  return firstLine.length > 200 ? firstLine.substring(0, 197) + '...' : firstLine;
}

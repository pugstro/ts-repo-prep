/**
 * Utilities for tracking line numbers and positions in parsed code.
 * Handles byte-to-character position conversions for multi-byte UTF-8.
 */

/**
 * Builds a map of line start positions (byte offsets) for quick line number lookup.
 * @param code The full source code string
 * @returns Array where index is line number (0-based) and value is byte offset
 */
export function buildLineMap(code: string): number[] {
  const lines = code.split('\n');
  const lineStarts: number[] = [];
  let currentPos = 0;
  for (const line of lines) {
    lineStarts.push(currentPos);
    currentPos += line.length + 1; // +1 for newline character
  }
  return lineStarts;
}

/**
 * Converts a character position to a 1-based line number.
 * @param charPos Character position in the source code (0-based)
 * @param lineStarts Array of line start positions from buildLineMap
 * @returns 1-based line number
 */
export function getLine(charPos: number, lineStarts: number[]): number {
  for (let i = 0; i < lineStarts.length; i++) {
    if (lineStarts[i + 1] > charPos || i === lineStarts.length - 1) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * Converts a byte position to a character position.
 * Necessary because SWC returns byte positions, but we need character positions for multi-byte UTF-8.
 * @param bytePos Byte position in the buffer
 * @param codeBuffer The raw file buffer
 * @returns Character position
 */
export function byteToChar(bytePos: number, codeBuffer: Buffer): number {
  // For performance, if the file is likely ASCII, return bytePos
  // But for safety in a global project, we use the buffer-to-string-length trick.
  // In a tight loop, this is the bottleneck.
  return codeBuffer.slice(0, bytePos).toString('utf8').length;
}

/**
 * Extracts a snippet of code from a span (SWC AST node position).
 * @param span SWC span object with start/end byte positions
 * @param baseOffset Base offset to subtract from span positions
 * @param codeBuffer The raw file buffer
 * @returns Extracted code snippet as string
 */
export function getSnippet(span: any, baseOffset: number, codeBuffer: Buffer): string {
  const start = span.start - baseOffset;
  const end = span.end - baseOffset;
  if (start < 0 || end > codeBuffer.length) return '';
  return codeBuffer.slice(start, end).toString('utf8');
}

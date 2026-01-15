/**
 * Main TypeScript/JavaScript parser using SWC.
 * Extracts exports, imports, and metadata from source files.
 */

import swc from '@swc/core';
import fs from 'fs';
import { buildLineMap, getSnippet } from './position-utils.js';
import { extractJSDocComments, getSummary } from './jsdoc-utils.js';
import { getClassification } from './code-classifier.js';
import { extractImports, extractExports } from './ast-walker.js';

export async function parseFile(filePath: string) {
  // Read file
  let codeBuffer: Buffer;
  try {
    codeBuffer = fs.readFileSync(filePath);
  } catch (err) {
    return { exports: [], imports: [] };
  }

  const code = codeBuffer.toString('utf8');

  // Build line map for position tracking
  const lineStarts = buildLineMap(code);

  try {
    // Parse with SWC
    const isTsx = filePath.endsWith('.tsx');
    const module = swc.parseSync(code, {
      syntax: "typescript",
      tsx: isTsx,
      decorators: true,
      comments: true,
    });

    const baseOffset = module.span.start;

    // Extract JSDoc comments
    const jsDocComments = extractJSDocComments(code);

    // Helper function for extracting code snippets
    const snippetExtractor = (span: any) => getSnippet(span, baseOffset, codeBuffer);

    // Extract imports
    const imports = extractImports(module.body);

    // Extract exports
    const exports = extractExports(
      module.body,
      baseOffset,
      codeBuffer,
      code,
      lineStarts,
      jsDocComments,
      filePath,
      snippetExtractor
    );

    // Get file-level classification
    const fileClassification = getClassification(filePath, '', '', code);

    // Get file summary from first JSDoc or first export's JSDoc
    const fileSummary = getSummary(
      jsDocComments.length > 0 && jsDocComments[0].start === 0
        ? jsDocComments[0].text
        : (exports.length > 0 ? exports[0].doc : '')
    );

    return {
      exports,
      imports,
      classification: fileClassification,
      summary: fileSummary
    };
  } catch (error: any) {
    // Output error to console so we can see it during 'npx tsx src/cli.ts'
    console.error(`Error parsing ${filePath}: ${error.message}`);
    return { exports: [], imports: [] };
  }
}

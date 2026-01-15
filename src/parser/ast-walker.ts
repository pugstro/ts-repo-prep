/**
 * AST traversal logic for extracting imports and exports from parsed SWC module.
 */

import { getLine, byteToChar } from './position-utils.js';
import { findJSDocForPosition, type JSDocComment } from './jsdoc-utils.js';
import { getClassification, getCapabilities } from './code-classifier.js';
import { cleanSignature } from './signature-cleaner.js';

/**
 * Extracts all imports from the SWC AST module body.
 * @param moduleBody Array of top-level AST nodes
 * @returns Array of import objects
 */
export function extractImports(moduleBody: any[]): any[] {
  const imports: any[] = [];

  for (const item of moduleBody) {
    if (item.type === 'ImportDeclaration') {
      imports.push({
        module: item.source.value,
        name: item.specifiers.map((s: any) => {
          if (s.type === 'ImportDefaultSpecifier') return 'default';
          if (s.type === 'ImportNamespaceSpecifier') return '*';
          return (s as any).local?.value || (s as any).imported?.value || '*';
        }).join(', ')
      });
    }

    // ExportAllDeclaration also acts as an import
    if (item.type === 'ExportAllDeclaration') {
      imports.push({
        module: item.source.value,
        name: '*'
      });
    }
  }

  return imports;
}

/**
 * Extracts all exports from the SWC AST module body.
 * @param moduleBody Array of top-level AST nodes
 * @param baseOffset Base offset from SWC module.span.start
 * @param codeBuffer Raw file buffer for extracting snippets
 * @param code Source code string for JSDoc matching
 * @param lineStarts Line start positions from buildLineMap
 * @param jsDocComments All JSDoc comments extracted from the file
 * @param filePath File path for classification
 * @param getSnippet Function to extract code snippet from span
 * @returns Array of export objects
 */
export function extractExports(
  moduleBody: any[],
  baseOffset: number,
  codeBuffer: Buffer,
  code: string,
  lineStarts: number[],
  jsDocComments: JSDocComment[],
  filePath: string,
  getSnippet: (span: any) => string
): any[] {
  const exports: any[] = [];

  for (const item of moduleBody) {
    // Regular ExportDeclaration
    if (item.type === 'ExportDeclaration') {
      const d = item.declaration as any;
      const kind = d.type;
      let name = '';

      if (kind === 'VariableDeclaration') {
        name = d.declarations.map((v: any) => v.id.value).join(', ');
      } else {
        name = d.id?.value || d.identifier?.value || 'anonymous';
      }

      const startCharPos = byteToChar(item.span.start - baseOffset, codeBuffer);
      const endCharPos = byteToChar(item.span.end - baseOffset, codeBuffer);

      const doc = findJSDocForPosition(startCharPos, jsDocComments, code);
      const snippet = getSnippet(item.span);

      exports.push({
        name,
        kind,
        signature: cleanSignature(snippet, kind),
        line: getLine(startCharPos, lineStarts),
        endLine: getLine(endCharPos, lineStarts),
        doc,
        classification: getClassification(filePath, name, kind, snippet),
        capabilities: JSON.stringify(getCapabilities(snippet))
      });
    }

    // Named exports: export { foo, bar }
    if (item.type === 'ExportNamedDeclaration') {
      for (const spec of item.specifiers) {
        if (spec.type === 'ExportSpecifier') {
          const startCharPos = byteToChar(item.span.start - baseOffset, codeBuffer);
          const endCharPos = byteToChar(item.span.end - baseOffset, codeBuffer);

          const doc = findJSDocForPosition(startCharPos, jsDocComments, code);

          exports.push({
            name: spec.exported?.value || spec.orig.value,
            kind: 'ExportSpecifier',
            signature: `export { ${spec.orig.value} }`,
            line: getLine(startCharPos, lineStarts),
            endLine: getLine(endCharPos, lineStarts),
            doc,
            classification: 'Export mapping',
            capabilities: '[]'
          });
        }
      }
    }

    // Default exports: export default ...
    if (item.type === 'ExportDefaultDeclaration') {
      const startCharPos = byteToChar(item.span.start - baseOffset, codeBuffer);
      const endCharPos = byteToChar(item.span.end - baseOffset, codeBuffer);

      const doc = findJSDocForPosition(startCharPos, jsDocComments, code);
      const snippet = getSnippet(item.span);

      exports.push({
        name: 'default',
        kind: 'DefaultExport',
        signature: cleanSignature(snippet, 'DefaultExport'),
        line: getLine(startCharPos, lineStarts),
        endLine: getLine(endCharPos, lineStarts),
        doc,
        classification: 'Default Export',
        capabilities: JSON.stringify(getCapabilities(snippet))
      });
    }

    // Re-exports: export * from "..."
    if (item.type === 'ExportAllDeclaration') {
      const startCharPos = byteToChar(item.span.start - baseOffset, codeBuffer);
      const endCharPos = byteToChar(item.span.end - baseOffset, codeBuffer);
      const source = item.source.value;

      const doc = findJSDocForPosition(startCharPos, jsDocComments, code);

      exports.push({
        name: '*',
        kind: 'ExportAllDeclaration',
        signature: `export * from "${source}"`,
        line: getLine(startCharPos, lineStarts),
        endLine: getLine(endCharPos, lineStarts),
        doc,
        classification: 'Re-export',
        capabilities: '[]'
      });
    }
  }

  return exports;
}

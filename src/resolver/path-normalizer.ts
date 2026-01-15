/**
 * Utilities for normalizing file paths and resolving extensions.
 */

import path from 'path';
import fs from 'fs';

export const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.d.ts', '.js', '.jsx', ''];

/**
 * Normalizes a resolved path by trying various extension combinations.
 * Handles ESM imports like "./index.js" that should resolve to "./index.ts"
 *
 * @param resolvedPath The resolved file path (may or may not have extension)
 * @returns The normalized path with correct extension, or empty string if not found
 */
export function normalizeResolvedPath(resolvedPath: string): string {
  // If the path already has an extension, try swapping it for TypeScript extensions
  // This handles ESM imports like "./index.js" that should resolve to "./index.ts"
  const ext = path.extname(resolvedPath);
  if (ext === '.js' || ext === '.jsx') {
    const basePath = resolvedPath.slice(0, -ext.length);
    const tsExtensions = ext === '.jsx' ? ['.tsx', '.ts'] : ['.ts', '.tsx'];
    for (const tsExt of tsExtensions) {
      const tsPath = basePath + tsExt;
      if (fs.existsSync(tsPath) && fs.statSync(tsPath).isFile()) {
        return tsPath;
      }
    }
    // Also try the original .js file in case it exists
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
      return resolvedPath;
    }
  }

  // Try to find the actual file with various extensions
  for (const addExt of SUPPORTED_EXTENSIONS) {
    const fullPath = resolvedPath + addExt;
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return fullPath;
    }
  }

  // Try index file in directory
  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
    for (const idxExt of ['.ts', '.tsx', '.js', '.jsx']) {
      const indexPath = path.join(resolvedPath, 'index' + idxExt);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }
  }

  // Return empty if we can't resolve
  return '';
}

/**
 * Utilities for finding TypeScript configuration and workspace roots.
 */

import path from 'path';
import fs from 'fs';

/**
 * Finds the nearest tsconfig.json by walking up from a given directory.
 * @param startPath Starting file or directory path
 * @returns Directory containing tsconfig.json, or null if not found
 */
export function findNearestTsConfig(startPath: string): string | null {
  let currentDir = fs.statSync(startPath).isDirectory() ? startPath : path.dirname(startPath);

  while (currentDir !== path.dirname(currentDir)) { // Stop at root
    const tsconfigPath = path.join(currentDir, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Finds workspace root by looking for package.json with "workspaces" field.
 * @param startPath Starting file or directory path
 * @returns Workspace root directory, or null if not found
 */
export function findWorkspaceRoot(startPath: string): string | null {
  let currentDir = fs.statSync(startPath).isDirectory() ? startPath : path.dirname(startPath);

  while (currentDir !== path.dirname(currentDir)) {
    const pkgPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.workspaces) {
          return currentDir;
        }
      } catch (e) {
        // Invalid JSON, continue searching
      }
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

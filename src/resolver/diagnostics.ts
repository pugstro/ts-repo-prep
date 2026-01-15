/**
 * Diagnostic utilities for debugging import resolution failures.
 */

import path from 'path';
import fs from 'fs';
import { normalizeResolvedPath } from './path-normalizer.js';
import { initResolver } from './index.js';

export interface ResolutionDiagnostic {
  resolved: boolean;
  resolvedPath?: string;
  error?: string;
  suggestion?: string;
}

/**
 * Diagnoses import resolution failures and provides helpful error messages.
 * @param importSpecifier The import string (e.g., "@/utils", "./file", "react")
 * @param importingFilePath Path of the file doing the import
 * @param repoPath Repository root path
 * @returns Diagnostic result with resolution status and suggestions
 */
export function diagnoseResolution(
  importSpecifier: string,
  importingFilePath: string,
  repoPath: string
): ResolutionDiagnostic {
  // 1. Check relative imports
  if (importSpecifier.startsWith('.')) {
    const importingDir = path.dirname(importingFilePath);
    const resolvedPath = path.resolve(importingDir, importSpecifier);
    const normalized = normalizeResolvedPath(resolvedPath);
    if (!normalized) {
      return {
        resolved: false,
        error: `File not found at relative path: ${resolvedPath}`,
        suggestion: 'Check if the file exists and has a supported extension (.ts, .tsx, .js, .jsx)'
      };
    }
    return { resolved: true, resolvedPath: normalized };
  }

  // 2. Check TSConfig Path Aliases
  const resolver = initResolver(importingFilePath);
  if (resolver) {
    if (resolver.matchPath) {
      const aliasResolved = resolver.matchPath(importSpecifier);
      if (aliasResolved) {
        const normalized = normalizeResolvedPath(aliasResolved);
        if (normalized) {
          return { resolved: true, resolvedPath: normalized };
        }
        return {
          resolved: false,
          error: `Path alias matched to '${aliasResolved}' but file does not exist`,
          suggestion: 'Check if the target file exists or if the alias mapping in tsconfig.json is correct'
        };
      }
    }

    // Check BaseUrl
    if (!importSpecifier.startsWith('@')) {
      const baseUrlResolved = path.resolve(resolver.baseUrl, importSpecifier);
      const normalized = normalizeResolvedPath(baseUrlResolved);
      if (normalized) {
        return { resolved: true, resolvedPath: normalized };
      }
    }

    // 3. Workspace Packages
    const workspacePkg = resolver.workspacePackages.get(importSpecifier);
    if (workspacePkg) {
      const srcIndex = path.join(workspacePkg.path, 'src/index.ts');
      if (fs.existsSync(srcIndex)) {
        return { resolved: true, resolvedPath: srcIndex };
      }

      const entryPoint = path.join(workspacePkg.path, workspacePkg.main);
      const resolved = normalizeResolvedPath(entryPoint);
      if (resolved) {
        return { resolved: true, resolvedPath: resolved };
      }

      return {
        resolved: false,
        error: `Workspace package '${importSpecifier}' found at ${workspacePkg.path} but entry point not found`,
        suggestion: `Check main field in ${path.join(workspacePkg.path, 'package.json')}`
      };
    }
  } else {
    return {
      resolved: false,
      error: 'No tsconfig.json found',
      suggestion: 'Ensure a tsconfig.json exists in the project root or parent directories'
    };
  }

  // 4. Fallback / Bare Specifier
  if (importSpecifier.startsWith('@')) {
    return {
      resolved: false,
      error: `Path alias '${importSpecifier}' not found in tsconfig.json paths`,
      suggestion: 'Check tsconfig.json "paths" configuration'
    };
  }

  return {
    resolved: false,
    error: 'Module not found (treated as external)',
    suggestion: 'Install dependency or check import path'
  };
}

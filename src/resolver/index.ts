/**
 * Main module resolution logic for TypeScript/JavaScript imports.
 * Handles tsconfig path aliases, workspace packages, and file dependencies.
 */

import path from 'path';
import fs from 'fs';
import { loadConfig, createMatchPath, ConfigLoaderSuccessResult } from 'tsconfig-paths';
import { findNearestTsConfig, findWorkspaceRoot } from './config-finder.js';
import { scanWorkspacePackages, scanFileDependencies, type WorkspacePackage } from './workspace-scanner.js';
import { normalizeResolvedPath } from './path-normalizer.js';

export interface ResolverConfig {
  baseUrl: string;
  paths: { [key: string]: string[] };
  matchPath: (requestedModule: string) => string | undefined;
  workspacePackages: Map<string, WorkspacePackage>;
}

// Cache resolver config per repo
const resolverCache = new Map<string, ResolverConfig | null>();

/**
 * Initializes a resolver for a given file path by finding its tsconfig.json.
 * @param searchPath File or directory path to start searching from
 * @returns ResolverConfig or null if no tsconfig found
 */
export function initResolver(searchPath: string): ResolverConfig | null {
  // Find the nearest tsconfig.json directory
  const configDir = findNearestTsConfig(searchPath);
  if (!configDir) {
    return null;
  }

  // Check cache
  if (resolverCache.has(configDir)) {
    return resolverCache.get(configDir) || null;
  }

  const configResult = loadConfig(configDir);

  if (configResult.resultType === 'failed') {
    // No tsconfig or invalid - use defaults
    resolverCache.set(configDir, null);
    return null;
  }

  const config = configResult as ConfigLoaderSuccessResult;

  // Infer baseUrl if missing but paths exist
  // This handles modern tsconfig files that define paths without explicit baseUrl
  let baseUrl = config.absoluteBaseUrl;
  if (!baseUrl && config.paths && Object.keys(config.paths).length > 0) {
    // Infer baseUrl as the directory containing tsconfig.json
    // This is TypeScript's default behavior when baseUrl is not specified
    baseUrl = config.configFileAbsolutePath
      ? path.dirname(config.configFileAbsolutePath)
      : configDir;
  }

  const matchPath = createMatchPath(
    baseUrl,
    config.paths,
    config.mainFields,
    config.addMatchAll
  );

  // Scan workspace packages from root
  const workspaceRoot = findWorkspaceRoot(configDir);
  let workspacePackages = new Map<string, WorkspacePackage>();

  if (workspaceRoot) {
    const pkgPath = path.join(workspaceRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        workspacePackages = scanWorkspacePackages(workspaceRoot, pkg);
      } catch (e) {
        // Invalid package.json, skip workspace scanning
      }
    }
  }

  // Scan file: dependencies from the current project's package.json
  const localPkgJson = path.join(configDir, 'package.json');
  if (fs.existsSync(localPkgJson)) {
    const fileDeps = scanFileDependencies(localPkgJson);
    fileDeps.forEach((pkg, name) => workspacePackages.set(name, pkg));
  }

  const resolverConfig: ResolverConfig = {
    baseUrl: baseUrl || '',
    paths: config.paths,
    matchPath,
    workspacePackages
  };

  resolverCache.set(configDir, resolverConfig);
  return resolverConfig;
}

/**
 * Resolves an import specifier to an absolute file path.
 * @param importSpecifier The import string (e.g., "@/utils", "./file", "react")
 * @param importingFilePath Path of the file doing the import
 * @param repoPath Repository root path (for context, not used currently)
 * @returns Absolute file path, or empty string if external/not found
 */
export function resolveImportPath(
  importSpecifier: string,
  importingFilePath: string,
  repoPath: string
): string {
  // 1. Handle relative imports first
  if (importSpecifier.startsWith('.')) {
    const importingDir = path.dirname(importingFilePath);
    const resolvedPath = path.resolve(importingDir, importSpecifier);
    return normalizeResolvedPath(resolvedPath);
  }

  // 2. Try path alias resolution via tsconfig
  // Use the importing file's directory to find the nearest tsconfig (for monorepos)
  const resolver = initResolver(importingFilePath);
  if (resolver) {
    const aliasResolved = resolver.matchPath(importSpecifier);
    if (aliasResolved) {
      return normalizeResolvedPath(aliasResolved);
    }

    // Try baseUrl resolution for non-relative paths
    if (!importSpecifier.startsWith('@') || importSpecifier.startsWith('@/')) {
      const baseUrlResolved = path.resolve(resolver.baseUrl, importSpecifier);
      const normalized = normalizeResolvedPath(baseUrlResolved);
      if (normalized) {
        return normalized;
      }
    }

    // 3. Try workspace package resolution
    const workspacePkg = resolver.workspacePackages.get(importSpecifier);
    if (workspacePkg) {
      // Priority 1: Try src/index.ts for TypeScript source resolution (better for AI context)
      const srcIndex = path.join(workspacePkg.path, 'src/index.ts');
      if (fs.existsSync(srcIndex)) {
        return srcIndex;
      }

      // Priority 2: Try the main entry point defined in package.json
      const entryPoint = path.join(workspacePkg.path, workspacePkg.main);
      const resolved = normalizeResolvedPath(entryPoint);
      if (resolved) {
        return resolved;
      }
    }
  }

  // 4. Bare specifiers (node_modules) - return empty to indicate external
  return '';
}

/**
 * Clears the resolver cache for a specific repo or all repos.
 * @param repoPath Optional specific repo path to clear, or clear all if omitted
 */
export function clearResolverCache(repoPath?: string): void {
  if (repoPath) {
    resolverCache.delete(repoPath);
  } else {
    resolverCache.clear();
  }
}

// Re-export types and utilities for backward compatibility
export { diagnoseResolution, type ResolutionDiagnostic } from './diagnostics.js';
export { type WorkspacePackage } from './workspace-scanner.js';

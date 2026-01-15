/**
 * Utilities for scanning workspace packages and file dependencies in monorepos.
 */

import path from 'path';
import fs from 'fs';

export interface WorkspacePackage {
  name: string;
  path: string;
  main: string;
}

/**
 * Scans workspace packages defined in root package.json "workspaces" field.
 * @param workspaceRoot Root directory containing package.json with workspaces
 * @param packageJson Parsed root package.json object
 * @returns Map of package name to WorkspacePackage
 */
export function scanWorkspacePackages(workspaceRoot: string, packageJson: any): Map<string, WorkspacePackage> {
  const packages = new Map<string, WorkspacePackage>();
  const workspaces = packageJson.workspaces || [];

  for (const pattern of workspaces) {
    // Handle patterns like "apps/*" or "services/*"
    const baseDir = pattern.replace('/*', '');
    const fullBaseDir = path.join(workspaceRoot, baseDir);

    if (!fs.existsSync(fullBaseDir)) continue;

    const dirs = fs.readdirSync(fullBaseDir);

    for (const dir of dirs) {
      const pkgJsonPath = path.join(fullBaseDir, dir, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
          if (pkg.name) {
            packages.set(pkg.name, {
              name: pkg.name,
              path: path.dirname(pkgJsonPath),
              main: pkg.main || 'dist/index.js'
            });
          }
        } catch (e) {
          // Skip invalid package.json
        }
      }
    }
  }

  return packages;
}

/**
 * Scans package.json for "file:" dependencies.
 * @param pkgJsonPath Path to package.json
 * @returns Map of package name to WorkspacePackage
 */
export function scanFileDependencies(pkgJsonPath: string): Map<string, WorkspacePackage> {
  const packages = new Map<string, WorkspacePackage>();

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    for (const [name, version] of Object.entries(deps)) {
      if (typeof version === 'string' && version.startsWith('file:')) {
        const relativePath = version.substring(5); // remove 'file:'
        const pkgDir = path.dirname(pkgJsonPath);
        const resolvedPath = path.resolve(pkgDir, relativePath);

        // Check if target package.json exists to get 'main'
        const targetPkgJson = path.join(resolvedPath, 'package.json');
        if (fs.existsSync(targetPkgJson)) {
          try {
            const targetPkg = JSON.parse(fs.readFileSync(targetPkgJson, 'utf8'));
            packages.set(name, {
              name,
              path: resolvedPath,
              main: targetPkg.main || 'dist/index.js'
            });
          } catch (e) {
            // Ignore invalid target package.json
          }
        }
      }
    }
  } catch (e) {
    // Ignore invalid source package.json
  }

  return packages;
}

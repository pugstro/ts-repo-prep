import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Gets the current git branch name for a repository.
 * Returns null if the path is not a git repository or an error occurs.
 */
export function getCurrentBranch(repoPath: string): string | null {
    try {
        // First check if .git exists to avoid unnecessary exec
        if (!fs.existsSync(path.join(repoPath, '.git'))) {
            return null;
        }

        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd: repoPath,
            stdio: ['ignore', 'pipe', 'ignore'],
            encoding: 'utf8'
        }).trim();

        if (branch === 'HEAD') {
            // Detached HEAD - maybe return short commit hash?
            return execSync('git rev-parse --short HEAD', {
                cwd: repoPath,
                stdio: ['ignore', 'pipe', 'ignore'],
                encoding: 'utf8'
            }).trim();
        }

        // Sanitize branch name for filenames
        // Replace chars that might be problematic in filenames: / \ : * ? " < > |
        return branch.replace(/[\/\\:*"<>|?]/g, '-');
    } catch (e) {
        return null;
    }
}

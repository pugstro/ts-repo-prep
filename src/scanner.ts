
import fg from 'fast-glob';
import fs from 'fs';
import ignore from 'ignore';
import path from 'path';

export async function scanRepo(root: string) {
  const ig = ignore();
  const gitignorePath = path.join(root, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    ig.add(fs.readFileSync(gitignorePath, 'utf8'));
  }

  // Expanded patterns to include infrastructure configs and schemas
  const patterns = [
    '**/*.{ts,tsx,yaml,yml}',
    '**/*.prisma',
    '**/*.{graphql,gql}',
    '**/Dockerfile*',
    '**/.env.example'
  ];
  const entries = await fg(patterns, {
    cwd: root,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/vendor/**'],
  });

  const filtered = entries.filter((file) => {
    const relative = path.relative(root, file);
    return !ig.ignores(relative);
  });

  return filtered.map((file) => ({
    path: file,
    mtime: fs.statSync(file).mtimeMs,
  }));
}

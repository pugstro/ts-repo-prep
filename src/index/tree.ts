import path from 'path';
import { DetailLevel, FileSummary, ProjectNode } from '../types.js';

export function buildTree(files: FileSummary[], rootPath: string, level: DetailLevel): ProjectNode {
    const root: ProjectNode = {
        name: path.basename(rootPath) || rootPath,
        type: 'directory',
        path: rootPath,
        children: [],
    };

    files.forEach(file => {
        const relativePath = path.relative(rootPath, file.path);
        const parts = relativePath.split(path.sep);
        let current = root;

        parts.forEach((part, index) => {
            const isFile = index === parts.length - 1;
            const fullPath = path.join(rootPath, ...parts.slice(0, index + 1));

            let child = current.children?.find(c => c.name === part);
            if (!child) {
                child = {
                    name: part,
                    type: isFile ? 'file' : 'directory',
                    path: fullPath,
                    children: isFile ? undefined : [],
                    summary: isFile ? {
                        classification: file.classification,
                        summaryText: file.summary,
                        exports: file.exports,
                        imports: file.imports,
                        chunks: file.chunks
                    } : undefined,
                };

                // Filter summary based on level if needed
                if (child.summary) {
                    if (level === 'structure' || level === 'signatures') {
                        delete child.summary.chunks;
                        delete child.summary.imports;
                    }
                }

                current.children?.push(child);
            }
            current = child;
        });
    });

    return root;
}

import { ensureCacheUpToDate, processRepo } from '../../index.js';
import { resolveToolArgs } from '../utils.js';
import { getDB } from '../../db.js';
import logger from '../../logger.js';

export async function handleSetupRepository(args: any) {
    const { repoPath } = resolveToolArgs(args);

    logger.info({ repoPath }, 'Setting up repository...');

    // 1. Ensure cache is up-to-date (handles initial indexing or incremental sync)
    await ensureCacheUpToDate(repoPath);

    const db = getDB(repoPath);

    // 2. Gather statistics
    const fileCount = db.prepare('SELECT COUNT(*) as count FROM files').get().count;
    const exportCount = db.prepare('SELECT COUNT(*) as count FROM exports').get().count;
    const importCount = db.prepare('SELECT COUNT(*) as count FROM imports').get().count;

    // 3. Get high-level summary (lite level - just the file tree)
    const summary = await processRepo(repoPath, 5, 'lite');

    const welcomeMessage = `
# Repository Prepared: ${repoPath}

I have analyzed the repository. Here is the high-level overview:

- **Files indexed**: ${fileCount}
- **Symbols (functions/classes) found**: ${exportCount}
- **Dependencies tracked**: ${importCount}

## Next Steps for AI:
1. **Explore Structure**: Review the file tree below to understand the project layout.
2. **Find Entry Points**: Use \`search_symbols\` for keywords like "Server", "App", "main", or "Controller".
3. **Deep Dive**: Use \`get_project_summary\` with a \`subPath\` (e.g., "src/") to see signatures in specific areas.
4. **Implementation Details**: Once you find a file or symbol of interest, use \`summarize_file\` or \`get_symbol_context\`.

---
## Project Structure (Lite)
`;

    return {
        content: [
            {
                type: 'text',
                text: welcomeMessage + JSON.stringify(summary, null, 2)
            }
        ],
    };
}

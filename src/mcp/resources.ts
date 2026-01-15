/**
 * MCP resource handlers for listing and reading resources.
 */

import { getDB } from '../db.js';
import { ensureCacheUpToDate } from '../index.js';
import { normalizeRepoPath, parseResourceURI } from './utils.js';
import { RESOURCE_SCHEMAS } from './schemas.js';

/**
 * Handles ListResources request - returns available resources.
 */
export async function handleListResources(request: any) {
  return {
    resources: RESOURCE_SCHEMAS
  };
}

/**
 * Handles ReadResource request - returns resource content.
 */
export async function handleReadResource(request: any) {
  const uri = request.params.uri;

  // Parse the URI
  const parsed = parseResourceURI(uri);
  if (!parsed) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  const repoPath = normalizeRepoPath(parsed.repoPath || process.cwd());
  const resource = parsed.resource;

  await ensureCacheUpToDate(repoPath);
  const db = getDB(repoPath);

  if (resource === 'statistics') {
    const stats = {
      files: db.prepare('SELECT COUNT(*) as count FROM files').get().count,
      exports: db.prepare('SELECT COUNT(*) as count FROM exports').get().count,
      imports: db.prepare('SELECT COUNT(*) as count FROM imports').get().count,
    };
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify(stats, null, 2)
      }]
    };
  }

  if (resource === 'dependency-graph') {
    // Return a simplified graph
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify({
          message: "Full graph generation not yet implemented for resource API, use tools."
        }, null, 2)
      }]
    };
  }

  throw new Error(`Resource not found: ${uri}`);
}

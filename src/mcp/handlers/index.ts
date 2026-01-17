import { handleGetProjectSummary, handleSummarizeFile, handleRefreshIndex } from './project.js';
import { handleSearch } from './search.js';
import { handleInspectFileDeps, handleAnalyzeChangeImpact } from './dependencies.js';
import { handleReadSymbol } from './symbols.js';
import { handleSetupRepository } from './setup.js';
import { handleSearchConfig } from './config.js';
import { createHandler } from './wrapper.js';

// Define the handler registry
const handlers = new Map<string, (args: any) => Promise<any>>([
  // Project handlers
  ['repointel_setup_repository', createHandler('repointel_setup_repository', handleSetupRepository)],
  ['repointel_get_project_summary', createHandler('repointel_get_project_summary', handleGetProjectSummary)],
  ['repointel_summarize_file', createHandler('repointel_summarize_file', handleSummarizeFile)],
  ['repointel_refresh_index', createHandler('repointel_refresh_index', handleRefreshIndex)],

  // Unified Search
  ['repointel_search', createHandler('repointel_search', handleSearch)],

  // Unified Config
  ['repointel_search_config', createHandler('repointel_search_config', handleSearchConfig)],

  // Unified Dependencies
  ['repointel_inspect_file_deps', createHandler('repointel_inspect_file_deps', handleInspectFileDeps)],
  ['repointel_analyze_change_impact', createHandler('repointel_analyze_change_impact', handleAnalyzeChangeImpact)],

  // Unified Symbol Retrieval
  ['repointel_read_symbol', createHandler('repointel_read_symbol', handleReadSymbol)],
]);

/**
 * Routes a tool call to the appropriate handler.
 * @param name Tool name
 * @param args Tool arguments
 * @returns Tool response
 */
export async function handleToolCall(name: string, args: any) {
  const handler = handlers.get(name);
  if (!handler) {
    throw new Error(`Tool not found: ${name}`);
  }
  return handler(args);
}

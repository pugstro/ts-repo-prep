import { handleGetProjectSummary, handleSummarizeFile, handleRefreshIndex } from './project.js';
import { handleSearchSymbols, handleSearchByCapability, handleGetInfrastructureMetadata } from './search.js';
import { handleGetFileDependencies, handleGetFileDependents, handleAnalyzeChangeImpact } from './dependencies.js';
import { handleGetSymbolDefinition, handleGetSymbolsBatch, handleGetSymbolContext } from './symbols.js';
import { handleSetupRepository } from './setup.js';
import { createHandler } from './wrapper.js';

// Define the handler registry
const handlers = new Map<string, (args: any) => Promise<any>>([
  // Project handlers
  ['repointel_setup_repository', createHandler('repointel_setup_repository', handleSetupRepository)],
  ['repointel_get_project_summary', createHandler('repointel_get_project_summary', handleGetProjectSummary)],
  ['repointel_summarize_file', createHandler('repointel_summarize_file', handleSummarizeFile)],
  ['repointel_refresh_index', createHandler('repointel_refresh_index', handleRefreshIndex)],

  // Search handlers
  ['repointel_search_symbols', createHandler('repointel_search_symbols', handleSearchSymbols)],
  ['repointel_search_by_capability', createHandler('repointel_search_by_capability', handleSearchByCapability)],
  ['repointel_get_infrastructure_metadata', createHandler('repointel_get_infrastructure_metadata', handleGetInfrastructureMetadata)],

  // Dependency handlers
  ['repointel_get_file_dependencies', createHandler('repointel_get_file_dependencies', handleGetFileDependencies)],
  ['repointel_get_file_dependents', createHandler('repointel_get_file_dependents', handleGetFileDependents)],
  ['repointel_analyze_change_impact', createHandler('repointel_analyze_change_impact', handleAnalyzeChangeImpact)],

  // Symbol handlers
  ['repointel_get_symbol_definition', createHandler('repointel_get_symbol_definition', handleGetSymbolDefinition)],
  ['repointel_get_symbols_batch', createHandler('repointel_get_symbols_batch', handleGetSymbolsBatch)],
  ['repointel_get_symbol_context', createHandler('repointel_get_symbol_context', handleGetSymbolContext)],
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

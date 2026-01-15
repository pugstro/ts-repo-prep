/**
 * MCP tool handler router.
 * Routes tool calls to appropriate handler functions.
 */

import { handleGetProjectSummary, handleSummarizeFile, handleRefreshIndex } from './project.js';
import { handleSearchSymbols, handleSearchByCapability, handleGetInfrastructureMetadata } from './search.js';
import { handleGetFileDependencies, handleGetFileDependents, handleAnalyzeChangeImpact } from './dependencies.js';
import { handleGetSymbolDefinition, handleGetSymbolsBatch, handleGetSymbolContext } from './symbols.js';

/**
 * Routes a tool call to the appropriate handler.
 * @param name Tool name
 * @param args Tool arguments
 * @returns Tool response
 */
export async function handleToolCall(name: string, args: any) {
  // Project handlers
  if (name === 'get_project_summary') return handleGetProjectSummary(args);
  if (name === 'summarize_file') return handleSummarizeFile(args);
  if (name === 'refresh_index') return handleRefreshIndex(args);

  // Search handlers
  if (name === 'search_symbols') return handleSearchSymbols(args);
  if (name === 'search_by_capability') return handleSearchByCapability(args);
  if (name === 'get_infrastructure_metadata') return handleGetInfrastructureMetadata(args);

  // Dependency handlers
  if (name === 'get_file_dependencies') return handleGetFileDependencies(args);
  if (name === 'get_file_dependents') return handleGetFileDependents(args);
  if (name === 'analyze_change_impact') return handleAnalyzeChangeImpact(args);

  // Symbol handlers
  if (name === 'get_symbol_definition') return handleGetSymbolDefinition(args);
  if (name === 'get_symbols_batch') return handleGetSymbolsBatch(args);
  if (name === 'get_symbol_context') return handleGetSymbolContext(args);

  throw new Error(`Tool not found: ${name}`);
}

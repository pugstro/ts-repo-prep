/**
 * MCP tool and resource schema definitions.
 * 
 * PHILOSOPHY: These tools are designed as a "pre-flight intelligence layer" for AI agents.
 * They provide HIGH-SIGNAL, LOW-TOKEN alternatives to raw file reads.
 * Use these BEFORE committing to heavy file operations to save context window budget.
 */

export const TOOL_SCHEMAS = [
  {
    name: 'repointel_setup_repository',
    description: 'The FIRST tool you should call for any new repository. ' +
      'Performs initial indexing and returns architecture overview, detected services, and navigation strategy. ' +
      'STRATEGY: Call this once per repo to "onboard" yourself. Re-call after major refactors. ' +
      'TOKEN EFFICIENCY: Returns curated intelligence, not raw file dumps.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
      },
      required: ['repoPath'],
    },
  },
  {
    name: 'repointel_get_project_summary',
    description: 'Get a hierarchical summary of the project structure. ' +
      'STRATEGY: Use this to build a mental map of a directory BEFORE diving into files. ' +
      'Prefer this over "ls" or "find" for understanding codebase layout. ' +
      'FEATURES: Automatically truncates signatures for large projects while preserving full structure. ' +
      'NOTE: Call setup_repository FIRST if you haven\'t yet.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        subPath: { type: 'string', description: 'Optional sub-path to focus on (relative to repoPath)' },
        maxDepth: { type: 'number', description: 'Maximum tree depth to return (default: unlimited). Use 1 for top-level only.' }
      },
      required: ['repoPath'],
    },
  },
  {
    name: 'repointel_summarize_file',
    description: 'Get a token-efficient summary of a specific file. ' +
      'STRATEGY: Use this BEFORE reading the full file to decide if it\'s relevant. ' +
      'FEATURES: Shows exported signatures without full implementation code. ' +
      'Use "detailed" level only when you need the complete content.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Absolute path to the file' },
        detailLevel: {
          type: 'string',
          enum: ['structure', 'signatures', 'detailed'],
          description: 'Level of detail. structure=names only, signatures=names+args (default), detailed=full content.'
        }
      },
      required: ['filePath'],
    },
  },
  {
    name: 'repointel_search',
    description: 'Unified search for symbols or semantic concepts. ' +
      'STRATEGY: Use "symbol" mode when you know a name (supports typos with "Did you mean?" suggestions). ' +
      'Use "concept" mode to find files by PURPOSE (e.g., "authentication logic"). ' +
      'FEATURES: Fuzzy matching for symbol names. Returns file paths and summaries.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        query: { type: 'string', description: 'Search term or natural language intent' },
        mode: { type: 'string', enum: ['symbol', 'concept'], description: 'Search mode. Default: "symbol"' }
      },
      required: ['repoPath', 'query'],
    },
  },
  {
    name: 'repointel_read_symbol',
    description: 'Retrieve source code for a specific symbol by name. ' +
      'STRATEGY: Use when you know the symbol name but not its exact file location. ' +
      'FEATURES: Automatically resolves re-exported (barrel) symbols to their actual definition. ' +
      'TRUNCATION: Large symbols are truncated to 150 lines by default with clear instructions for full retrieval. ' +
      'Use context="full" for dependencies and usage examples (higher token cost).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        symbolName: { type: 'string', description: 'Name of the symbol to retrieve' },
        filePath: { type: 'string', description: 'Optional: specific file path if symbol name is ambiguous' },
        context: { type: 'string', enum: ['definition', 'full'], description: 'Retrieval depth. Default: "definition" (truncated to 150 lines).' }
      },
      required: ['repoPath', 'symbolName'],
    },
  },
  {
    name: 'repointel_inspect_file_deps',
    description: 'Inspect dependencies or dependents of a specific file. ' +
      'STRATEGY: Use direction="imports" to see what this file depends on. ' +
      'Use direction="imported_by" to understand who uses this file (impact analysis). ' +
      'FEATURES: Returns resolved import paths, not just raw import statements.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        filePath: { type: 'string', description: 'Absolute path to the file' },
        direction: { type: 'string', enum: ['imports', 'imported_by'], description: 'Analysis direction' }
      },
      required: ['repoPath', 'filePath', 'direction'],
    },
  },
  {
    name: 'repointel_search_config',
    description: 'Search for configuration values across .env, docker-compose, and YAML files. ' +
      'STRATEGY: Use this to find environment variables, ports, and service definitions. ' +
      'FEATURES: Supports dot-notation for nested keys (e.g., "services.backend.environment.DATABASE_HOST"). ' +
      'Searches .env files, docker-compose.yml, and general YAML configs. ' +
      'TRUNCATION: Results limited to 50 by default; use "limit" to adjust.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        key: { type: 'string', description: 'Config key to find. Supports dot-notation for nested keys (e.g., "database.postgres.host")' },
        kind: { type: 'string', enum: ['Service', 'Image', 'Port', 'Env'], description: 'Metadata kind to dump (alternative to key search)' },
        limit: { type: 'number', description: 'Max results to return (default: 50)' }
      },
      required: ['repoPath'],
    },
  },
  {
    name: 'repointel_analyze_change_impact',
    description: 'Analyze the "blast radius" of changing a symbol. ' +
      'STRATEGY: Use BEFORE refactoring to understand what files would be affected. ' +
      'Returns a dependency tree showing direct and transitive dependents. ' +
      'FEATURES: Traces through re-exports to find actual usages.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        symbolName: { type: 'string', description: 'Name of the symbol being changed' },
        filePath: { type: 'string', description: 'Optional: specific file path if symbol name is ambiguous' },
        depth: { type: 'number', description: 'How many dependency hops to trace (default: 3)' }
      },
      required: ['repoPath', 'symbolName'],
    },
  },
  {
    name: 'repointel_refresh_index',
    description: 'Trigger an incremental re-index of the repository. ' +
      'STRATEGY: Use after making significant file changes to ensure your intelligence is current. ' +
      'FEATURES: Only re-indexes files that have changed (mtime-based), making it fast for large repos.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
      },
      required: ['repoPath'],
    },
  },
];

export const RESOURCE_SCHEMAS = [
  {
    uri: `repo://current/dependency-graph`,
    name: "Project Dependency Graph",
    mimeType: "application/json",
    description: "Full dependency graph of the current repository"
  },
  {
    uri: `repo://current/statistics`,
    name: "Repository Statistics",
    mimeType: "application/json",
    description: "Statistics about files, exports, and imports"
  }
];

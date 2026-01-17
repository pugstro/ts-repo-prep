/**
 * MCP tool and resource schema definitions.
 */

export const TOOL_SCHEMAS = [
  {
    name: 'repointel_setup_repository',
    description: 'The FIRST tool you should call for any new repository. ' +
      'It performs initial indexing, verifies the environment, and returns repository statistics ' +
      'along with a high-level file tree. Use this to "onboard" yourself to a codebase.',
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
    description: 'Get a hierarchical summary of the project. \n' +
      'STRATEGY: Adaptive. By default, tries to return the full tree with export signatures. ' +
      'If the project is too large for the context window, it automatically truncates details (hides signatures) but ALWAYS returns the full file/folder structure. ' +
      'Use this to get the "Map" of the codebase. CALL setup_repository FIRST if you haven\'t yet.',
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
    description: 'Get a summary of a specific file. Defaults to showing exported signatures. Use "detailed" for full code/docs.',
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
    description: 'Unified search for symbols or semantic concepts. \n' +
      'Use "symbol" mode to find a specific class, function, or variable by name (fuzzy match). \n' +
      'Use "concept" mode to find files by purpose or logic (semantic search on file summaries).',
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
    description: 'Retrieve code for a specific symbol. \n' +
      'Use context="definition" (default) to get just the source code. \n' +
      'Use context="full" to get source code + dependency usage examples + internal dependencies.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        symbolName: { type: 'string', description: 'Name of the symbol to retrieve' },
        filePath: { type: 'string', description: 'Optional: specific file path if symbol name is ambiguous' },
        context: { type: 'string', enum: ['definition', 'full'], description: 'Retrieval depth. Default: "definition"' }
      },
      required: ['repoPath', 'symbolName'],
    },
  },
  {
    name: 'repointel_inspect_file_deps',
    description: 'Inspect dependencies or dependents of a specific file. \n' +
      'Use direction="imports" to see what this file uses. \n' +
      'Use direction="imported_by" to see what other files use this file.',
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
    description: 'Search for configuration values or infrastructure metadata. \n' +
      'Provide "key" to find a specific env var or config value across files. \n' +
      'Provide "kind" to dump all metadata of a specific type (e.g. all Ports).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        key: { type: 'string', description: 'Specific config key to find (e.g. "API_KEY")' },
        kind: { type: 'string', enum: ['Service', 'Image', 'Port', 'Env'], description: 'Metadata kind to dump' }
      },
      required: ['repoPath'], // technically neither is required by schema validation but helpful to have one? Actually let's make repoPath required. The handler should check that at least one of key/kind is present.
    },
  },
  {
    name: 'repointel_analyze_change_impact',
    description: 'Analyze what would be affected by changing a symbol. Returns a dependency tree showing direct and transitive dependents. Use this before refactoring to understand the "blast radius" of a change.',
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
    description: 'Manually trigger an incremental re-index of the repository. ' +
      'Use this after making significant file changes to ensure the AI context is up-to-date.',
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

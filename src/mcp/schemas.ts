/**
 * MCP tool and resource schema definitions.
 */

export const TOOL_SCHEMAS = [
  {
    name: 'get_project_summary',
    description: 'Get a hierarchical summary of the project. \n' +
      'STRATEGY: Adaptive. By default, tries to return the full tree with export signatures. ' +
      'If the project is too large for the context window, it automatically truncates details (hides signatures) but ALWAYS returns the full file/folder structure. ' +
      'Use this to get the "Map" of the codebase.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        subPath: { type: 'string', description: 'Optional sub-path to focus on (relative to repoPath)' }
      },
      required: ['repoPath'],
    },
  },
  {
    name: 'summarize_file',
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
    name: 'search_symbols',
    description: 'Search for symbols (functions, classes) globally by name. Best for jumping to a known component (e.g. "AuthController") without traversing the tree.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        query: { type: 'string', description: 'Name of the symbol to search for (fuzzy match)' },
      },
      required: ['repoPath', 'query'],
    },
  },
  {
    name: 'get_file_dependencies',
    description: 'Get a list of files that the target file imports.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        filePath: { type: 'string', description: 'Absolute path to the file' },
      },
      required: ['repoPath', 'filePath'],
    },
  },
  {
    name: 'get_file_dependents',
    description: 'Get a list of files that import the target file.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        filePath: { type: 'string', description: 'Absolute path to the file' },
      },
      required: ['repoPath', 'filePath'],
    },
  },
  {
    name: 'get_symbol_definition',
    description: 'Get the full source code implementation of a specific exported symbol. ' +
      'Use this when you need to understand how a function, class, or constant is implemented.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        symbolName: { type: 'string', description: 'Name of the exported symbol to retrieve' },
        filePath: { type: 'string', description: 'Optional: specific file path if symbol name is ambiguous' }
      },
      required: ['repoPath', 'symbolName'],
    },
  },
  {
    name: 'get_infrastructure_metadata',
    description: 'Query infrastructure and configuration metadata (from Dockerfiles, YAML, or .env files). ' +
      'Use this to see base images, ports, environment variables, or service definitions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        kind: { type: 'string', enum: ['Service', 'Image', 'Port', 'Env'], description: 'Filter by metadata kind' },
      },
      required: ['repoPath'],
    },
  },
  {
    name: 'search_by_capability',
    description: 'Find symbols that have specific high-level capabilities (side-effects). ' +
      'Valid capabilities: Network, Database, File System, Browser Storage.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        capability: { type: 'string', description: 'Capability to search for (e.g. "Network", "Database")' },
      },
      required: ['repoPath', 'capability'],
    },
  },
  {
    name: 'get_symbols_batch',
    description: 'Get full source code for multiple symbols in one call. ' +
      'Much more efficient than making repeated get_symbol_definition calls when you need to retrieve several related symbols. ' +
      'Saves round-trips and context window space.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        symbols: {
          type: 'array',
          description: 'Array of symbols to retrieve',
          items: {
            type: 'object',
            properties: {
              symbolName: { type: 'string', description: 'Name of the exported symbol' },
              filePath: { type: 'string', description: 'Optional: specific file path if symbol name is ambiguous' }
            },
            required: ['symbolName']
          }
        }
      },
      required: ['repoPath', 'symbols'],
    },
  },
  {
    name: 'get_symbol_context',
    description: 'Get comprehensive context for a symbol: its definition, usage examples from files that import it, and its direct dependencies. ' +
      'This is much more efficient than calling get_symbol_definition + get_file_dependents + parsing usage sites separately. ' +
      'Use this when you need to understand how a symbol is used in practice.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        symbolName: { type: 'string', description: 'Name of the exported symbol' },
        filePath: { type: 'string', description: 'Optional: specific file path if symbol name is ambiguous' },
        includeUsages: { type: 'boolean', description: 'Include usage examples from dependent files (default: true)' },
        maxUsageExamples: { type: 'number', description: 'Maximum number of usage examples to return (default: 3)' }
      },
      required: ['repoPath', 'symbolName'],
    },
  },
  {
    name: 'refresh_index',
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
  {
    name: 'analyze_change_impact',
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

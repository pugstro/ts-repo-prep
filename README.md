# ts-repo-prep

A TypeScript repository analyzer and indexer that creates a queryable SQLite database of your codebase, optimized for AI-assisted development through the Model Context Protocol (MCP).

## Features

- **Ultra-fast parsing** using SWC (~1,500 files/second)
- **Bidirectional dependency tracking** (find imports and dependents)
- **Smart import resolution** (tsconfig path aliases, monorepos, ESM/CJS)
- **Infrastructure parsing** (Prisma schemas, GraphQL, Docker, YAML)
- **MCP Server integration** with 12 powerful tools for AI assistants
- **Incremental caching** (only re-parses changed files)
- **Capability detection** (network, database, filesystem, browser storage)

### MCP Server Mode

Start the MCP server for AI assistant integration:

```bash
ts-repo-prep-mcp
```

Or during development:

```bash
npm run mcp
```

## MCP Tools

The MCP server exposes 12 tools for AI assistants:

### Core Tools

1. **get_project_summary** - Get hierarchical project structure with adaptive detail levels
2. **summarize_file** - Get detailed info about a specific file
3. **search_symbols** - Fuzzy search for functions, classes, types by name
4. **get_file_dependencies** - List what a file imports
5. **get_file_dependents** - Find who imports a file (reverse lookup)
6. **get_symbol_definition** - Extract full source code for a symbol
7. **get_infrastructure_metadata** - Query Docker, YAML, env configs
8. **search_by_capability** - Find symbols by side-effects (network, database, etc.)
9. **refresh_index** - Manually trigger re-indexing
10. **get_symbols_batch** - Retrieve multiple symbol definitions in one call
11. **get_symbol_context** - Get comprehensive context for a symbol
12. **analyze_change_impact** - Analyze what depends on a symbol

## MCP Resources

The server provides 2 read-only resources:

1. **repo://current/dependency-graph** - Full JSON dependency graph
2. **repo://current/statistics** - Repository stats (file counts, lines of code, etc.)

## Database Schema

Creates a `.repo-prep.db` SQLite database with:

- **files** - File metadata, mtime, classification, summary
- **exports** - Exported symbols with signatures, docs, line numbers, capabilities
- **imports** - Import statements with resolved paths
- **configs** - Infrastructure metadata from non-code files

All with strategic indexes for fast queries.

## Architecture

- **Scanner** - File discovery with gitignore support
- **Parser** - SWC-based AST extraction
- **Resolver** - Import path resolution with tsconfig support
- **Database** - SQLite storage with WAL mode
- **Exporter** - JSON output generation
- **MCP Server** - Model Context Protocol implementation

## Performance

Real-world metrics from 1,385 file repository:

- Indexing time: ~900ms
- Database size: ~2.4MB
- Exports: 2,227 symbols
- Imports: 4,162 statements
- Signature extraction: 99.7% success rate
- Import resolution: 35.7% (remainder are external node_modules)

## Configuration

The tool automatically discovers:

- `.gitignore` patterns (respects for file scanning)
- `tsconfig.json` (for path alias resolution)
- `package.json` (for workspace packages)

## Technologies

- **@swc/core** - Ultra-fast TypeScript/JavaScript parsing
- **better-sqlite3** - Synchronous SQLite database
- **ts-morph** - TypeScript compiler API wrapper
- **@modelcontextprotocol/sdk** - MCP server implementation
- **fast-glob** - High-performance file globbing
- **pino** - Structured logging

## License

MIT

# mcp-repo-intelligence

An AI-powered repository intelligence server that creates a queryable SQLite database of your codebase, optimized for AI-assisted development through the Model Context Protocol (MCP).

## Features

- **Ultra-fast parsing** using SWC (~1,500 files/second)
- **Bidirectional dependency tracking** (find imports and dependents)
- **Smart import resolution** (tsconfig path aliases, monorepos, ESM/CJS)
- **Infrastructure parsing** (Prisma schemas, GraphQL, Docker, YAML)
- **MCP Server integration** with 13 powerful tools for AI assistants
- **Incremental caching** (only re-parses changed files)
- **Capability detection** (network, database, filesystem, browser storage)
- **Git branch awareness** (maintains separate indexes for different branches)

### Intelligent Setup (v1.2.0)

Automatically analyzes your repository structure to provide the most efficient context:

- **Smart Classification**: Detects if your repo is Small, Medium, Large, or a Polyglot Monorepo.
- **System Map**: Generates an architectural map of top-level components (e.g., `Active (TS/JS Source)`, `Detected (Non-TS Backend)`).
- **Token Optimization**: Prevents AI from wasting tokens on non-code directories (config, assets, other languages) while still providing structural awareness.

### MCP Server Mode

Start the MCP server for AI assistant integration:

```bash
mcp-repo-intelligence
```

Or during development:

```bash
npm run mcp
```

## MCP Tools

The MCP server exposes 13 tools (all prefixed with `repointel_` for easy discovery):

### Core Tools

| Tool                              | Description                                                       |
| --------------------------------- | ----------------------------------------------------------------- |
| `repointel_setup_repository`    | **FIRST tool to call** - indexes the repo and returns stats |
| `repointel_get_project_summary` | Hierarchical project structure with adaptive detail               |
| `repointel_summarize_file`      | Detailed info about a specific file                               |
| `repointel_refresh_index`       | Trigger re-indexing after changes                                 |

### Search Tools

| Tool                                      | Description                                    |
| ----------------------------------------- | ---------------------------------------------- |
| `repointel_search_symbols`              | Fuzzy search for functions, classes, types     |
| `repointel_search_by_capability`        | Find by side-effects (network, database, etc.) |
| `repointel_get_infrastructure_metadata` | Query Docker, YAML, env configs                |

### Dependency Tools

| Tool                                | Description                        |
| ----------------------------------- | ---------------------------------- |
| `repointel_get_file_dependencies` | List what a file imports           |
| `repointel_get_file_dependents`   | Find who imports a file            |
| `repointel_analyze_change_impact` | Analyze refactoring "blast radius" |

### Symbol Tools

| Tool                                | Description                            |
| ----------------------------------- | -------------------------------------- |
| `repointel_get_symbol_definition` | Extract full source code for a symbol  |
| `repointel_get_symbols_batch`     | Retrieve multiple symbols in one call  |
| `repointel_get_symbol_context`    | Get definition + usages + dependencies |

## MCP Resources

The server provides 2 read-only resources:

1. **repo://current/dependency-graph** - Full JSON dependency graph
2. **repo://current/statistics** - Repository stats (file counts, lines of code, etc.)

## Database Schema

Creates a `.repo-prep.db` SQLite database (or `.repo-prep.[branch].db` when in a git repository) with:

- **files** - File metadata, mtime, classification, summary
- **exports** - Exported symbols with signatures, docs, line numbers, capabilities
- **imports** - Import statements with resolved paths
- **configs** - Infrastructure metadata from non-code files

All with strategic indexes for fast queries.

## CLI Usage

```bash
# Index a repository
repo-intelligence /path/to/repo

# Export to JSON (optional)
repo-intelligence /path/to/repo -o export.json
```

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

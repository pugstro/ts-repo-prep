# MCP Repo Intelligence (v2.2)

**Zero-Blind-Spot Intelligence for Large TypeScript Repositories.**

This MCP server transforms any TypeScript codebase into a queryable knowledge graph. It enables AI agents to instantly find code definitions, understand complex architecture (including barrel files and monorepos), and track symbol usage across the entire stack—from source code to configuration files.

## High-Level Capabilities

* **Instant Code Navigation**: Jump directly to any class, interface, function, **or specific method** without needing to know the file structure.
* **Smart Grep**: Finds every mention of a symbol, distinguishing between strict code imports (Verified Usages) and loose text references in Config/CI/Docker (Loose Mentions).
* **Architectural Awareness**: 🆕 Automatically detects Monorepos (Workspaces), Microservices (Docker), and Standalone apps. Tells you exactly how to **Run**, **Build**, and **Test** the project immediately upon setup.
* **Logic & Intent Analysis**: Search for concepts ("where is auth handled?") or specific logic ("publishSubscriptionEvent") with equal precision.
* **🕸️Monorepo Aware**: Flattens complexity by resolving aliases (`@app/core`) and following re-exports (barrel files) recursively.

## Philosophy

MCP Repo Intelligence is a **curated intelligence layer** that minimizes token waste by pre-answering repetitive "where" and "what" questions. It **complements** traditional tools (grep, cat) rather than replacing them—providing instant answers to questions that would otherwise require reading multiple files.

**Token Economics**: Finding a symbol location takes ~50 tokens (vs ~10,000 tokens reading 10+ files manually).

## Tools

### `repointel_read_symbol`

**The "Laser" Tool.** Finds a specific symbol, its definition, and **everywhere it is used**.

* **Input**:
  * `symbolName` (e.g., `CMPubSub`, `publishSubscriptionEvent`, or `CMPubSub.publishSubscriptionEvent`)
  * `context` (optional): `"definition"` (default, shows first 150 lines) or `"full"` (includes dependencies & usage)
* **Output**:
  * **Definition**: The exact source code (truncated to 150 lines for large symbols).
  * **Verified Usages**: Files that import and use the symbol (Code dependency graph).
  * **Loose Mentions**: Text references in non-code files (Infrastructure impact).

### `repointel_search`

**The "Compass" Tool.** Finds files and symbols based on semantic meaning or fuzzy names.

* **Input**: `query` (e.g., "Subscription events", "Auth controller")
* **Output**: List of relevant files with architectural summaries.

### `repointel_search_config`

**The "Config Finder" Tool.** Searches for configuration keys across .env, YAML, and docker-compose files.

* **Input**: `key` (e.g., `"DATABASE_URL"`), `limit` (optional, default 50)
* **Output**: All occurrences with file paths, line numbers, and values.

### `repointel_summarize_file`

**The "Microscope" Tool.** Deeply analyzes a single file.

* **Input**: `path`
* **Output**: Exports, imports, dependencies, and complex logic breakdown.

### `repointel_setup_repository`

**The "Indexer" Tool.** Scans the codebase and builds the SQLite intelligence database.

* **Input**: `repoPath`
* **Action**: Parses thousands of files in seconds to build the knowledge graph.
* **Performance**: ~1.9s to fully index 1,850 TypeScript files (Microservices Monorepo).

  ---

*Powered by SQLite FTS5 & SWC for blistering speed.*

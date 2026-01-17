# MCP Repo Intelligence (v2.1)

**Zero-Blind-Spot Intelligence for Large TypeScript Repositories.**

This MCP server transforms any TypeScript codebase into a queryable knowledge graph. It enables AI agents to instantly find code definitions, understand complex architecture (including barrel files and monorepos), and track symbol usage across the entire stack—from source code to configuration files.

## High-Level Capabilities

* **Instant Code Navigation**: Jump directly to any class, interface, function, **or specific method** without needing to know the file structure.
* **Smart Grep**: Finds every mention of a symbol, distinguishing between strict code imports (Verified Usages) and loose text references in Config/CI/Docker (Loose Mentions).
* **Architectural Awareness**: 🆕 Automatically detects Monorepos (Workspaces), Microservices (Docker), and Standalone apps. Tells you exactly how to **Run**, **Build**, and **Test** the project immediately upon setup.
* **Logic & Intent Analysis**: Search for concepts ("where is auth handled?") or specific logic ("publishSubscriptionEvent") with equal precision.
* **🕸️Monorepo Aware**: Flattens complexity by resolving aliases (`@app/core`) and following re-exports (barrel files) recursively.

## Tools

### `repointel_read_symbol`

**The "Laser" Tool.** Finds a specific symbol, its definition, and **everywhere it is used**.

* **Input**: `symbolName` (e.g., `CMPubSub`, `publishSubscriptionEvent`, or `CMPubSub.publishSubscriptionEvent`)
* **Output**:
  * **Definition**: The exact source code (method/class body).
  * **Verified Usages**: Files that import and use the symbol (Code dependency graph).
  * **Loose Mentions**: Text references in non-code files (Infrastructure impact).

### `repointel_search`

**The "Compass" Tool.** Finds files and symbols based on semantic meaning or fuzzy names.

* **Input**: `query` (e.g., "Subscription events", "Auth controller")
* **Output**: List of relevant files with architectural summaries.

### `repointel_summarize_file`

**The "Microscope" Tool.** Deeply analyzes a single file.

* **Input**: `path`
* **Output**: Exports, imports, dependencies, and complex logic breakdown.

### `repointel_setup_repository`

**The "Indexer" Tool.** Scans the codebase and builds the SQLite intelligence database.

* **Input**: `repoPath`
* **Action**: Parses thousands of files in seconds to build the knowledge graph.
* **Performance**: ~1.9s to fully index 1,850 TypeScript files (Microservices Monorepo).

## Getting Started

1. **Install**: `npm install -g mcp-repo-intelligence` (or verify it is running in your MCP client).
2. **Connect**: Add to your MCP config.
3. **Use**: Ask your AI to "Index this repository" or "Find where X is defined".

---

*Powered by SQLite FTS5 & SWC for blistering speed.*

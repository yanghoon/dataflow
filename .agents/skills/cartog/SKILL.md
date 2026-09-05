---
name: cartog
description: >-
  Use this skill when you need to search the codebase for symbols, functions, classes, or understand code dependencies. It provides a fast, LSP-backed code search using the local Cartog infrastructure.
---

# Cartog Codebase Search Skill

This workspace is equipped with **Cartog**, a local code search engine and LSP infrastructure running via Docker Compose. Whenever you need to search the codebase, find symbols, or analyze structure, do not rely purely on `grep_search`. Instead, use the `run_command` tool to query Cartog.

The main wrapper script is located at `.agents/skills/cartog/scripts/cartog.sh`.

## Available Commands

### 1. Code Search (Most Common)
To search for code, symbols, or perform semantic queries, run:
```bash
sh .agents/skills/cartog/scripts/cartog.sh search "YOUR_QUERY"
```

**Helpful Options:**
- `--limit <N>`: Maximum results to return (default is 30). Use a smaller limit (e.g., 5 or 10) to save context window if you only need top matches.
- `--tokens <N>`: Limit output to approximately N tokens to prevent context overflow.
- `--kind <KIND>`: Filter by symbol kind (e.g., `function`, `class`, `method`, `variable`, `import`, `interface`, `module`, `all`).

**Example Usage:**
```bash
# Search for a repository interface/class and limit output
sh .agents/skills/cartog/scripts/cartog.sh search --kind class --limit 10 "UserRepository"
```

### 2. Code Indexing
If your search results are missing recently added files, or if you just did a large refactor, you should re-index the codebase:
```bash
sh .agents/skills/cartog/scripts/cartog.sh index
```
*(Note: This might take a few moments as it leverages the LSP server to rebuild the database.)*

### 3. Check Infrastructure Stats
To verify how many files and symbols are currently indexed in the Cartog database:
```bash
sh .agents/skills/cartog/scripts/cartog.sh stats
```

## Best Practices
- Always execute these commands from the project root directory.
- The `cartog.sh` script will automatically start the Docker containers (`docker compose up -d`) if they are down, so you do not need to manually manage the infrastructure.
- Prefer using `--limit` when you expect a large number of matches to keep responses fast and concise.

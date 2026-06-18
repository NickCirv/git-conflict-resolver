<div align="center">

# git-conflict-resolver

**Resolve Git merge conflicts interactively from the terminal — hunk-by-hunk, side-by-side, zero dependencies.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue?labelColor=0B0A09)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?labelColor=0B0A09)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?labelColor=0B0A09)](package.json)

</div>

## Install

```bash
npx github:NickCirv/git-conflict-resolver list
```

Or install globally:

```bash
npm install -g github:NickCirv/git-conflict-resolver
```

## Usage

```bash
gcr <command> [file] [options]
```

```bash
# See all conflicted files and conflict counts
gcr list

# Visual side-by-side diff for a file
gcr show src/index.js

# Interactive hunk-by-hunk resolution
gcr resolve src/index.js

# Batch accept all our changes in a file
gcr accept-ours package.json

# Batch accept all their changes in a file
gcr accept-theirs src/config.ts

# Machine-readable conflict count (for scripts)
gcr count

# JSON output of all conflict locations
gcr json | jq '.totalConflicts'
```

| Command | Description |
|---------|-------------|
| `gcr list` | List all conflicted files with conflict counts |
| `gcr show <file>` | Show conflicts side-by-side (ours vs theirs) |
| `gcr show <file> --inline` | Show conflicts inline (`<<<<<<<` / `=======` / `>>>>>>>`) |
| `gcr count` | Print total conflict count (machine-readable) |
| `gcr resolve <file>` | Interactive hunk-by-hunk resolution |
| `gcr accept-ours <file>` | Resolve all conflicts using our version |
| `gcr accept-theirs <file>` | Resolve all conflicts using their version |
| `gcr json` | Output all conflict locations as JSON |

## What it does

After a merge conflict, `gcr list` shows exactly which files are broken and how many hunks need resolving. `gcr resolve <file>` walks you through each conflict with a colour-coded side-by-side view — accept ours, accept theirs, open in `$EDITOR`, or skip — and auto-stages the file when all hunks are resolved. Batch commands (`accept-ours` / `accept-theirs`) let you resolve an entire file in one shot when the choice is obvious. The `json` command outputs structured conflict data for scripting and CI pipelines.

---
<sub>Zero dependencies · Node ≥18 · MIT · by <a href="https://github.com/NickCirv">NickCirv</a></sub>

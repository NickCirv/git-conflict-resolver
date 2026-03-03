# git-conflict-resolver

Find, display, and resolve Git merge conflicts interactively — zero dependencies, pure Node.js.

```
$ gcr list

Files with conflicts (2):

  x src/index.js   (3 conflicts)
  x package.json   (1 conflict)

Total: 4 conflict(s) across 2 file(s)

Merge Context
------------------------------------------------------------
OURS  (HEAD):    a1b2c3d feat: add new feature (Nick)
THEIRS (MERGE_HEAD): d3e4f5g fix: patch upstream bug (Alice)
------------------------------------------------------------
```

## Features

- **List** all files with merge conflicts and conflict counts
- **Side-by-side diff** — ours vs theirs, color-coded green/red
- **Inline display** — traditional `<<<<<<<` / `=======` / `>>>>>>>` view
- **Interactive resolution** — hunk-by-hunk: accept ours / accept theirs / open in editor / skip
- **Batch resolution** — `accept-ours` or `accept-theirs` to resolve all conflicts in a file at once
- **Count** total conflicts across all conflicted files (machine-readable)
- **Auto-stage** — resolved files are automatically staged with `git add`
- **Commit context** — shows commit messages of conflicting commits so you know what changed
- **JSON output** — all conflict locations with line numbers for scripting

## Install

```bash
npm install -g git-conflict-resolver
```

Or run directly with npx:

```bash
npx git-conflict-resolver list
```

## Requirements

- Node.js 18+
- Git

## Usage

```
gcr <command> [file] [options]
```

### Commands

| Command | Description |
|---------|-------------|
| `gcr list` | List all conflicted files with counts |
| `gcr show <file>` | Show conflicts in a file (side-by-side) |
| `gcr show <file> --inline` | Show conflicts inline (<<<, ===, >>>) |
| `gcr count` | Print total conflict count (machine-readable) |
| `gcr resolve <file>` | Interactive hunk-by-hunk resolution |
| `gcr accept-ours <file>` | Resolve all conflicts using our version |
| `gcr accept-theirs <file>` | Resolve all conflicts using their version |
| `gcr json` | Output all conflict locations as JSON |

### Options

| Option | Description |
|--------|-------------|
| `--help`, `-h` | Show help |
| `--version`, `-v` | Show version |

## Examples

```bash
# See what's conflicted
gcr list

# Visual side-by-side diff
gcr show src/index.js

# Interactive resolution — choose per hunk
gcr resolve src/index.js

# Batch: accept all our changes in a file
gcr accept-ours package.json

# Batch: accept all their changes in a file
gcr accept-theirs src/config.ts

# Machine-readable count
gcr count
# -> 4

# JSON for scripting
gcr json | jq '.totalConflicts'
gcr json | jq '.conflicts[].file'
```

## Workflow

```bash
# 1. After a merge conflict:
git merge feature-branch

# 2. See what's broken
gcr list

# 3. Resolve interactively
gcr resolve src/index.js

# 4. Or batch-accept
gcr accept-ours package-lock.json

# 5. Commit (files are already staged)
git commit
```

## Interactive Resolution

When you run `gcr resolve <file>`, each conflict hunk is shown side-by-side and you choose:

```
Conflict 1/3 (line 42)
------------------------------------------------------------
OURS                           | THEIRS
-------------------------------+----------------------------
  42 const timeout = 5000      |   42 const timeout = 30000
  43 const retries = 3         |   43 const retries = 5
------------------------------------------------------------

Options:
  [o] Accept ours
  [t] Accept theirs
  [e] Open in editor
  [s] Skip
  [q] Quit
```

## JSON Output

```json
{
  "conflicts": [
    {
      "file": "src/index.js",
      "count": 3,
      "hunks": [
        { "startLine": 42, "endLine": 48, "oursLines": 2, "theirsLines": 2 },
        { "startLine": 91, "endLine": 97, "oursLines": 3, "theirsLines": 1 }
      ]
    }
  ],
  "totalFiles": 1,
  "totalConflicts": 3
}
```

## Security

- Uses only `execFileSync` and `spawnSync` with explicit argument arrays — no shell injection risk
- Zero external dependencies — no supply chain risk
- No external network requests
- No credentials or secrets handled

## License

MIT

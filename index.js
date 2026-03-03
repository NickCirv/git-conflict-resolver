#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes — no external deps
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  bgRed:   '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgBlue:  '\x1b[44m',
};

const VERSION = '1.0.0';

// ─── Helpers ────────────────────────────────────────────────────────────────

function git(...args) {
  try {
    const result = execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return result.trim();
  } catch (err) {
    return null;
  }
}

function gitOrThrow(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `git ${args[0]} failed`);
  }
  return result.stdout.trim();
}

function isGitRepo() {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' });
  return result.status === 0;
}

function getRepoRoot() {
  return git('rev-parse', '--show-toplevel') || process.cwd();
}

function print(msg = '') { process.stdout.write(msg + '\n'); }
function err(msg)  { process.stderr.write(`${C.red}Error:${C.reset} ${msg}\n`); }
function warn(msg) { process.stderr.write(`${C.yellow}Warning:${C.reset} ${msg}\n`); }
function hr()      { print(`${C.dim}${'─'.repeat(60)}${C.reset}`); }

// ─── Conflict Detection ──────────────────────────────────────────────────────

function getConflictedFiles() {
  const result = git('diff', '--name-only', '--diff-filter=U');
  if (!result) return [];
  return result.split('\n').filter(Boolean);
}

function parseConflicts(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const hunks = [];
  let state = 'normal';
  let hunkStart = -1;
  let ours = [];
  let theirs = [];
  let lineNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    lineNum = i + 1;

    if (line.startsWith('<<<<<<<')) {
      state = 'ours';
      hunkStart = lineNum;
      ours = [];
      theirs = [];
    } else if (line.startsWith('=======') && state === 'ours') {
      state = 'theirs';
    } else if (line.startsWith('>>>>>>>') && state === 'theirs') {
      hunks.push({ startLine: hunkStart, endLine: lineNum, ours: [...ours], theirs: [...theirs] });
      state = 'normal';
    } else if (state === 'ours') {
      ours.push({ lineNum: lineNum, text: line });
    } else if (state === 'theirs') {
      theirs.push({ lineNum: lineNum, text: line });
    }
  }

  return { content, lines, hunks };
}

// ─── Display ─────────────────────────────────────────────────────────────────

function showHunkSideBySide(hunk, index, total) {
  const width = Math.max(30, Math.floor((process.stdout.columns || 80) / 2) - 3);

  print(`\n${C.bold}${C.yellow}Conflict ${index + 1}/${total}${C.reset} (line ${hunk.startLine})`);
  hr();

  const maxLen = Math.max(hunk.ours.length, hunk.theirs.length);
  const header = `${'OURS'.padEnd(width)} │ ${'THEIRS'.padEnd(width)}`;
  print(`${C.bold}${C.green}${header.slice(0, width)}${C.reset} │ ${C.bold}${C.red}${'THEIRS'.padEnd(width)}${C.reset}`);
  print(`${C.dim}${'─'.repeat(width)}─┼─${'─'.repeat(width)}${C.reset}`);

  for (let i = 0; i < maxLen; i++) {
    const oLine = hunk.ours[i]   ? hunk.ours[i].text   : '';
    const tLine = hunk.theirs[i] ? hunk.theirs[i].text : '';
    const oNum  = hunk.ours[i]   ? `${C.dim}${String(hunk.ours[i].lineNum).padStart(4)}${C.reset} ` : '      ';
    const tNum  = hunk.theirs[i] ? `${C.dim}${String(hunk.theirs[i].lineNum).padStart(4)}${C.reset} ` : '      ';

    const oPad = oLine.substring(0, width - 5).padEnd(width - 5);
    const tPad = tLine.substring(0, width - 5).padEnd(width - 5);
    print(`${C.green}${oNum}${oPad}${C.reset} │ ${C.red}${tNum}${tPad}${C.reset}`);
  }

  hr();
}

function showFileConflicts(filePath, { sideBySide = true } = {}) {
  if (!fs.existsSync(filePath)) {
    err(`File not found: ${filePath}`);
    return null;
  }

  const { hunks } = parseConflicts(filePath);

  if (hunks.length === 0) {
    print(`${C.green}✓${C.reset} No conflicts in ${C.bold}${filePath}${C.reset}`);
    return hunks;
  }

  print(`\n${C.bold}${C.cyan}${filePath}${C.reset} — ${C.yellow}${hunks.length} conflict(s)${C.reset}`);

  if (sideBySide) {
    hunks.forEach((hunk, i) => showHunkSideBySide(hunk, i, hunks.length));
  } else {
    hunks.forEach((hunk, i) => {
      print(`\n${C.bold}${C.yellow}Conflict ${i + 1}/${hunks.length}${C.reset} (line ${hunk.startLine})`);
      print(`${C.green}<<<<<<< OURS${C.reset}`);
      hunk.ours.forEach(l   => print(`${C.green}${l.text}${C.reset}`));
      print(`${C.yellow}=======${C.reset}`);
      hunk.theirs.forEach(l => print(`${C.red}${l.text}${C.reset}`));
      print(`${C.red}>>>>>>> THEIRS${C.reset}`);
    });
  }

  return hunks;
}

// ─── Resolution ──────────────────────────────────────────────────────────────

function resolveHunk(content, hunk, choice) {
  const lines = content.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      // Skip to end of this conflict block
      const chosen = choice === 'ours' ? [] : [];
      let inOurs = true;
      i++; // skip <<<<<<<

      while (i < lines.length) {
        if (lines[i].startsWith('=======')) {
          inOurs = false;
          i++;
          continue;
        }
        if (lines[i].startsWith('>>>>>>>')) {
          i++;
          break;
        }
        if ((choice === 'ours' && inOurs) || (choice === 'theirs' && !inOurs)) {
          chosen.push(lines[i]);
        }
        i++;
      }
      result.push(...chosen);
    } else {
      result.push(lines[i]);
      i++;
    }
  }

  return result.join('\n');
}

function resolveAllInFile(filePath, choice) {
  if (!fs.existsSync(filePath)) {
    err(`File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const { hunks } = parseConflicts(filePath);

  if (hunks.length === 0) {
    warn(`No conflicts found in ${filePath}`);
    return false;
  }

  // Resolve all hunks iteratively (re-read content each time since line numbers shift)
  let currentContent = content;
  for (let i = 0; i < hunks.length; i++) {
    currentContent = resolveHunk(currentContent, null, choice);
    // Only one pass needed — resolveHunk handles all hunks in one sweep
    break;
  }

  fs.writeFileSync(filePath, currentContent, 'utf8');
  stageFile(filePath);
  print(`${C.green}✓${C.reset} Resolved ${hunks.length} conflict(s) in ${C.bold}${filePath}${C.reset} using ${C.bold}${choice}${C.reset}`);
  return true;
}

function stageFile(filePath) {
  const result = spawnSync('git', ['add', filePath], { encoding: 'utf8' });
  if (result.status === 0) {
    print(`${C.dim}  Staged: ${filePath}${C.reset}`);
  } else {
    warn(`Could not stage ${filePath}: ${result.stderr?.trim()}`);
  }
}

function openInEditor(filePath) {
  const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
  const result = spawnSync(editor, [filePath], { stdio: 'inherit' });
  if (result.status !== 0) {
    warn(`Editor exited with code ${result.status}`);
  }
}

// ─── Interactive Mode ─────────────────────────────────────────────────────────

async function interactiveResolve(filePath) {
  if (!fs.existsSync(filePath)) {
    err(`File not found: ${filePath}`);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(resolve => rl.question(q, resolve));

  const { hunks } = parseConflicts(filePath);
  if (hunks.length === 0) {
    print(`${C.green}✓${C.reset} No conflicts in ${filePath}`);
    rl.close();
    return;
  }

  print(`\n${C.bold}${C.cyan}Interactive resolution: ${filePath}${C.reset}`);
  print(`${hunks.length} conflict(s) to resolve\n`);

  let content = fs.readFileSync(filePath, 'utf8');
  let resolved = 0;
  let skipped  = 0;

  for (let i = 0; i < hunks.length; i++) {
    const hunk = hunks[i];
    showHunkSideBySide(hunk, i, hunks.length);

    print(`\n${C.bold}Options:${C.reset}`);
    print(`  ${C.green}[o]${C.reset} Accept ours`);
    print(`  ${C.red}[t]${C.reset} Accept theirs`);
    print(`  ${C.blue}[e]${C.reset} Open in editor`);
    print(`  ${C.yellow}[s]${C.reset} Skip`);
    print(`  ${C.dim}[q]${C.reset} Quit\n`);

    let choice = '';
    while (!['o', 't', 'e', 's', 'q'].includes(choice)) {
      choice = (await ask(`Choose [o/t/e/s/q]: `)).trim().toLowerCase();
    }

    if (choice === 'q') {
      print(`\n${C.yellow}Quitting. ${resolved} resolved, ${skipped} skipped.${C.reset}`);
      break;
    }

    if (choice === 's') {
      skipped++;
      continue;
    }

    if (choice === 'e') {
      // Write current content, open editor, re-read
      fs.writeFileSync(filePath, content, 'utf8');
      openInEditor(filePath);
      content = fs.readFileSync(filePath, 'utf8');
      resolved++;
      continue;
    }

    const side = choice === 'o' ? 'ours' : 'theirs';
    content = resolveHunk(content, hunk, side);
    resolved++;
  }

  fs.writeFileSync(filePath, content, 'utf8');

  const remaining = parseConflicts(filePath).hunks.length;
  if (remaining === 0) {
    stageFile(filePath);
    print(`\n${C.green}✓${C.reset} All conflicts resolved and staged.`);
  } else {
    warn(`${remaining} conflict(s) still remain in ${filePath} — not staging.`);
  }

  rl.close();
}

// ─── Context: Conflicting Commits ─────────────────────────────────────────────

function showConflictContext() {
  print(`\n${C.bold}${C.cyan}Merge Context${C.reset}`);
  hr();

  const mergeHead  = git('rev-parse', 'MERGE_HEAD');
  const cherryHead = git('rev-parse', 'CHERRY_PICK_HEAD');
  const rebaseHead = git('rev-parse', 'REBASE_HEAD');

  const ourHead   = git('rev-parse', 'HEAD');
  const theirHead = mergeHead || cherryHead || rebaseHead;

  if (ourHead) {
    const msg = git('log', '-1', '--pretty=format:%h %s (%an)', ourHead);
    print(`${C.green}OURS  (HEAD):${C.reset}   ${msg || 'unknown'}`);
  }

  if (theirHead) {
    const label = mergeHead ? 'MERGE_HEAD' : cherryHead ? 'CHERRY_PICK_HEAD' : 'REBASE_HEAD';
    const msg   = git('log', '-1', '--pretty=format:%h %s (%an)', theirHead);
    print(`${C.red}THEIRS (${label}):${C.reset} ${msg || 'unknown'}`);
  } else {
    print(`${C.dim}No active merge/rebase/cherry-pick detected.${C.reset}`);
  }

  hr();
}

// ─── JSON Output ──────────────────────────────────────────────────────────────

function jsonReport() {
  const root  = getRepoRoot();
  const files = getConflictedFiles();
  const report = { conflicts: [] };

  for (const rel of files) {
    const abs = path.resolve(root, rel);
    if (!fs.existsSync(abs)) continue;
    const { hunks } = parseConflicts(abs);
    report.conflicts.push({
      file: rel,
      count: hunks.length,
      hunks: hunks.map(h => ({
        startLine: h.startLine,
        endLine:   h.endLine,
        oursLines: h.ours.length,
        theirsLines: h.theirs.length,
      })),
    });
  }

  report.totalFiles    = report.conflicts.length;
  report.totalConflicts = report.conflicts.reduce((s, f) => s + f.count, 0);
  print(JSON.stringify(report, null, 2));
}

// ─── Commands ─────────────────────────────────────────────────────────────────

function cmdList() {
  if (!isGitRepo()) { err('Not inside a git repository.'); process.exit(1); }
  const files = getConflictedFiles();
  if (files.length === 0) {
    print(`${C.green}✓${C.reset} No merge conflicts found.`);
    return;
  }
  print(`\n${C.bold}${C.yellow}Files with conflicts (${files.length}):${C.reset}\n`);
  let total = 0;
  for (const f of files) {
    const abs = path.resolve(getRepoRoot(), f);
    const { hunks } = fs.existsSync(abs) ? parseConflicts(abs) : { hunks: [] };
    total += hunks.length;
    print(`  ${C.red}✗${C.reset} ${C.bold}${f}${C.reset} ${C.dim}(${hunks.length} conflict${hunks.length !== 1 ? 's' : ''})${C.reset}`);
  }
  print(`\n${C.dim}Total: ${total} conflict(s) across ${files.length} file(s)${C.reset}`);
  showConflictContext();
}

function cmdShow(file, opts = {}) {
  if (!isGitRepo()) { err('Not inside a git repository.'); process.exit(1); }
  const abs = path.resolve(getRepoRoot(), file);
  showFileConflicts(abs, { sideBySide: !opts.inline });
}

function cmdCount() {
  if (!isGitRepo()) { err('Not inside a git repository.'); process.exit(1); }
  const files = getConflictedFiles();
  let total = 0;
  for (const f of files) {
    const abs = path.resolve(getRepoRoot(), f);
    if (fs.existsSync(abs)) {
      total += parseConflicts(abs).hunks.length;
    }
  }
  print(String(total));
}

async function cmdResolve(file) {
  if (!isGitRepo()) { err('Not inside a git repository.'); process.exit(1); }
  const abs = path.resolve(getRepoRoot(), file);
  await interactiveResolve(abs);
}

function cmdAcceptOurs(file) {
  if (!isGitRepo()) { err('Not inside a git repository.'); process.exit(1); }
  const abs = path.resolve(getRepoRoot(), file);
  resolveAllInFile(abs, 'ours');
}

function cmdAcceptTheirs(file) {
  if (!isGitRepo()) { err('Not inside a git repository.'); process.exit(1); }
  const abs = path.resolve(getRepoRoot(), file);
  resolveAllInFile(abs, 'theirs');
}

function cmdJson() {
  if (!isGitRepo()) { err('Not inside a git repository.'); process.exit(1); }
  jsonReport();
}

// ─── Help & Version ───────────────────────────────────────────────────────────

function showHelp() {
  print(`
${C.bold}${C.cyan}git-conflict-resolver${C.reset} ${C.dim}v${VERSION}${C.reset}
${C.dim}Find, display, and resolve Git merge conflicts interactively${C.reset}

${C.bold}USAGE${C.reset}
  gcr <command> [file] [options]

${C.bold}COMMANDS${C.reset}
  ${C.green}list${C.reset}                    List all conflicted files with counts
  ${C.green}show${C.reset} <file>             Show conflicts in a file (side-by-side)
  ${C.green}show${C.reset} <file> ${C.dim}--inline${C.reset}   Show conflicts inline (<<<,===,>>>)
  ${C.green}count${C.reset}                   Print total number of conflicts (machine-readable)
  ${C.green}resolve${C.reset} <file>          Interactive hunk-by-hunk resolution
  ${C.green}accept-ours${C.reset} <file>      Resolve all conflicts in file using our version
  ${C.green}accept-theirs${C.reset} <file>    Resolve all conflicts in file using their version
  ${C.green}json${C.reset}                    Output all conflict locations as JSON

${C.bold}OPTIONS${C.reset}
  ${C.yellow}--help${C.reset}, ${C.yellow}-h${C.reset}              Show this help
  ${C.yellow}--version${C.reset}, ${C.yellow}-v${C.reset}           Show version

${C.bold}EXAMPLES${C.reset}
  gcr list
  gcr show src/index.js
  gcr resolve src/index.js
  gcr accept-ours package.json
  gcr accept-theirs src/config.ts
  gcr count
  gcr json | jq '.totalConflicts'

${C.bold}AFTER RESOLVING${C.reset}
  Files are automatically staged with ${C.cyan}git add${C.reset} after resolution.
  When all conflicts are resolved, run: ${C.cyan}git commit${C.reset}
`);
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

const [,, cmd, ...rest] = process.argv;

if (!cmd || cmd === '--help' || cmd === '-h') {
  showHelp();
  process.exit(0);
}

if (cmd === '--version' || cmd === '-v') {
  print(VERSION);
  process.exit(0);
}

const hasInline = rest.includes('--inline');
const args      = rest.filter(a => !a.startsWith('--'));

switch (cmd) {
  case 'list':
    cmdList();
    break;
  case 'show':
    if (!args[0]) { err('Usage: gcr show <file>'); process.exit(1); }
    cmdShow(args[0], { inline: hasInline });
    break;
  case 'count':
    cmdCount();
    break;
  case 'resolve':
    if (!args[0]) { err('Usage: gcr resolve <file>'); process.exit(1); }
    await cmdResolve(args[0]);
    break;
  case 'accept-ours':
    if (!args[0]) { err('Usage: gcr accept-ours <file>'); process.exit(1); }
    cmdAcceptOurs(args[0]);
    break;
  case 'accept-theirs':
    if (!args[0]) { err('Usage: gcr accept-theirs <file>'); process.exit(1); }
    cmdAcceptTheirs(args[0]);
    break;
  case 'json':
    cmdJson();
    break;
  default:
    err(`Unknown command: ${cmd}`);
    print(`Run ${C.cyan}gcr --help${C.reset} to see available commands.`);
    process.exit(1);
}

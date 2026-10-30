#!/usr/bin/env node
// @ts-nocheck

// Finds the imports of the .ts, .js and .svelte files under src/ that start with `.`, `$` or `#`
// and end in no .js, .ts, .svelte, .json or .css, suggests the specifier Node resolves, and
// offers to write it.

import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';

const SRC = path.join(process.cwd(), 'src');
const SRC_LIB = path.join(SRC, 'lib');

// `import x from '…'`, `export { x } from '…'` and `import '…'`, on one line or several
const IMPORT = /^[ \t]*(?:import|export)\s+(?:[^'"`;]*?\s+from\s+)?['"]([.$#][^'"]*)['"]/gm;
const HAS_EXTENSION = /\.(js|svelte|ts|json|css)$/;
// SvelteKit's own modules, and rime's generated ones
const SKIPPED = ['$app/', '$env/', '$rime/', '${'];

/** Every .ts, .js and .svelte file under `dir`. */
const listFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      return listFiles(fullPath);
    }
    if (item.isFile() && /\.(ts|js|svelte)$/.test(item.name)) {
      return [fullPath];
    }
    return [];
  });

/** The file with everything outside its <script> blocks turned to spaces, newlines kept. */
const scriptsOnly = (content) => {
  const blank = (text) => text.replace(/[^\n]/g, ' ');
  let out = '';
  let last = 0;
  for (const match of content.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script>/g)) {
    const start = match.index + match[1].length;
    out += blank(content.slice(last, start)) + match[2];
    last = start + match[2].length;
  }
  return out + blank(content.slice(last));
};

const getLineNumber = (content, index) => content.substring(0, index).split('\n').length;

// Finds [start, end) ranges of string/template literals and comments so
// that import-like text embedded in them (e.g. test fixtures) can be
// excluded from matches on real import statements.
function computeStringRanges(content) {
  const ranges = [];
  let i = 0;
  const n = content.length;

  while (i < n) {
    const ch = content[i];

    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      const start = i;
      i++;
      while (i < n) {
        if (content[i] === '\\') {
          i += 2;
          continue;
        }
        if (content[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      ranges.push([start, i]);
    } else if (ch === '/' && content[i + 1] === '/') {
      const start = i;
      while (i < n && content[i] !== '\n') i++;
      ranges.push([start, i]);
    } else if (ch === '/' && content[i + 1] === '*') {
      const start = i;
      i += 2;
      while (i < n && !(content[i] === '*' && content[i + 1] === '/')) i++;
      i = Math.min(i + 2, n);
      ranges.push([start, i]);
    } else {
      i++;
    }
  }

  return ranges;
}

const isInsideStringRange = (ranges, index) =>
  ranges.some(([start, end]) => index > start && index < end);

/**
 * The specifier with the extension Node needs, or null when no file answers it. Only a relative
 * or a `#lib/` specifier resolves.
 */
const resolveSpecifier = (importPath, filePath) => {
  const isRelative = importPath.startsWith('./') || importPath.startsWith('../');
  if (!isRelative && !importPath.startsWith('#lib/')) return null;
  const base = isRelative
    ? path.resolve(path.dirname(filePath), importPath)
    : SRC_LIB + importPath.slice('#lib'.length);
  if (fs.existsSync(`${base}.ts`) || fs.existsSync(`${base}.js`)) return `${importPath}.js`;
  if (fs.existsSync(path.join(base, 'index.ts'))) return `${importPath}/index.js`;
  return null;
};

/** The imports of one file that miss an extension, with what to write instead. */
const scanFile = (filePath) => {
  const source = fs.readFileSync(filePath, 'utf-8');
  const content = filePath.endsWith('.svelte') ? scriptsOnly(source) : source;
  const file = path.relative(process.cwd(), filePath);
  const stringRanges = computeStringRanges(content);
  const found = [];

  for (const match of content.matchAll(IMPORT)) {
    // Skip matches that only appear inside a string/template literal
    // (e.g. test fixtures like `const content = "import X from './a';"`)
    if (isInsideStringRange(stringRanges, match.index)) continue;

    const importPath = match[1];
    if (SKIPPED.some((prefix) => importPath.startsWith(prefix))) continue;
    if (HAS_EXTENSION.test(importPath)) continue;

    found.push({
      file,
      import: importPath,
      replacement: importPath === '.' ? './index.js' : resolveSpecifier(importPath, filePath),
      // Where the specifier starts, for applyFixes
      offset: match.index + match[0].length - 1 - importPath.length,
      line: getLineNumber(content, match.index)
    });
  }

  return found;
};

/** Prints each finding with its suggestion. */
const report = (results) => {
  if (results.length === 0) {
    console.log('✅ No imports missing extensions found!');
    return;
  }
  console.log(`❌ Found ${results.length} imports missing extensions:\n`);
  results.forEach(({ file, import: importPath, replacement, line }) => {
    console.log(`📄 ${file}:${line}`);
    console.log(`   Import: "${importPath}"`);
    if (replacement === null) {
      console.log(`   Suggested: (could not resolve)`);
    } else {
      console.log(`   Suggested: "${replacement}"`);
    }
    console.log('');
  });
};

/** Writes each suggestion at the offset of its import, file by file. */
function applyFixes(results) {
  const fileChanges = new Map();

  // Group changes by file
  results.forEach(({ file, import: importPath, replacement, offset }) => {
    if (!fileChanges.has(file)) {
      fileChanges.set(file, []);
    }
    fileChanges.get(file).push({ importPath, replacement, offset });
  });

  // Apply changes file by file
  fileChanges.forEach((changes, filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    let changeCount = 0;

    // The last offset first, so earlier offsets stay valid
    for (const { importPath, replacement, offset } of changes.sort((a, b) => b.offset - a.offset)) {
      if (!replacement) continue;
      content = content.slice(0, offset) + replacement + content.slice(offset + importPath.length);
      changeCount++;
    }

    if (changeCount > 0) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed ${changeCount} imports in ${filePath}`);
    }
  });

  console.log('\n✅ All fixes applied successfully!');
}

/** Asks whether to apply the fixes, and applies them unless the answer is no. */
const askAndApply = (results) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.question('\n🔧 Apply these fixes? (Y/n): ', (answer) => {
    rl.close();
    if (answer.toLowerCase() === 'n' || answer.toLowerCase() === 'no') {
      console.log('❌ Fixes cancelled.');
      return;
    }
    console.log('\n🔧 Applying fixes...\n');
    applyFixes(results);
  });
};

console.log('🔍 Scanning for imports missing file extensions...\n');
const results = listFiles(SRC).flatMap(scanFile);
report(results);
if (results.length) askAndApply(results);

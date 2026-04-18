#!/usr/bin/env node
// @ts-nocheck

import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';

/**
 * Finds all imports that start with '.' or '$' and don't end with .js or .svelte
 */
function findMissingExtensions() {
  const srcDir = path.join(process.cwd(), 'src');
  const results = [];

  // Regex to find imports that need extensions
  const importRegex = /import\s+.*?\s+from\s+['"`]([.$][^'"`]*?)['"`]/g;
  const extensionRegex = /\.(js|svelte|ts|json)$/;

  function scanDirectory(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        scanDirectory(fullPath);
      } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.js'))) {
        scanFile(fullPath);
      }
    }
  }

  function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(process.cwd(), filePath);
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];

      // Ignore SvelteKit imports
      if (
        importPath.startsWith('$app/') ||
        importPath.startsWith('$env/') ||
        importPath.startsWith('${')
      ) {
        continue;
      }

      // Auto-replace "." with "./index.js"
      if (importPath === '.') {
        results.push({
          file: relativePath,
          import: importPath,
          replacement: './index.js',
          line: getLineNumber(content, match.index)
        });
        continue;
      }

      // Check if it's a relative or aliased import and missing proper extension
      if (
        (importPath.startsWith('.') || importPath.startsWith('$')) &&
        !extensionRegex.test(importPath)
      ) {
        const replacement = suggestReplacement(importPath, filePath);
        results.push({
          file: relativePath,
          import: importPath,
          replacement: replacement,
          line: getLineNumber(content, match.index)
        });
      }
    }
  }

  function getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  function suggestReplacement(importPath, filePath) {
    const fileDir = path.dirname(filePath);

    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      // Relative import - resolve relative to current file
      const resolvedPath = path.resolve(fileDir, importPath);

      // Try .ts file
      if (fs.existsSync(resolvedPath + '.ts')) {
        return importPath + '.js';
      }

      // Try .js file
      if (fs.existsSync(resolvedPath + '.js')) {
        return importPath + '.js';
      }

      // Try directory with index.ts
      if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
        if (fs.existsSync(path.join(resolvedPath, 'index.ts'))) {
          return importPath + '/index.js';
        }
      }
    } else if (importPath.startsWith('$lib/')) {
      // $lib alias - resolve relative to src/lib
      const aliasPath = importPath.replace(
        /^\$lib\//,
        path.join(process.cwd(), 'src', 'lib') + '/'
      );

      // Try .ts file
      if (fs.existsSync(aliasPath + '.ts')) {
        return importPath + '.js';
      }

      // Try .js file
      if (fs.existsSync(aliasPath + '.js')) {
        return importPath + '.js';
      }

      // Try directory with index.ts
      if (fs.existsSync(aliasPath) && fs.statSync(aliasPath).isDirectory()) {
        if (fs.existsSync(path.join(aliasPath, 'index.ts'))) {
          return importPath + '/index.js';
        }
      }
    }

    return importPath + ' (could not resolve)';
  }

  console.log('🔍 Scanning for imports missing file extensions...\n');

  scanDirectory(srcDir);

  if (results.length === 0) {
    console.log('✅ No imports missing extensions found!');
  } else {
    console.log(`❌ Found ${results.length} imports missing extensions:\n`);

    results.forEach(({ file, import: importPath, replacement, line }) => {
      console.log(`📄 ${file}:${line}`);
      console.log(`   Import: "${importPath}"`);
      console.log(`   Suggested: "${replacement}"`);
      console.log('');
    });

    // Ask user if they want to apply the fixes
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('\n🔧 Apply these fixes? (Y/n): ', (answer) => {
      rl.close();

      if (answer.toLowerCase() === 'n' || answer.toLowerCase() === 'no') {
        console.log('❌ Fixes cancelled.');
        return;
      }

      console.log('\n🔧 Applying fixes...\n');
      applyFixes(results);
    });
  }

  function applyFixes(results) {
    const fileChanges = new Map();

    // Group changes by file
    results.forEach(({ file, import: importPath, replacement }) => {
      if (!fileChanges.has(file)) {
        fileChanges.set(file, []);
      }
      fileChanges.get(file).push({ importPath, replacement });
    });

    // Apply changes file by file
    fileChanges.forEach((changes, filePath) => {
      let content = fs.readFileSync(filePath, 'utf-8');
      let changeCount = 0;

      changes.forEach(({ importPath, replacement }) => {
        // Skip if couldn't resolve
        if (replacement.includes('(could not resolve)')) {
          return;
        }

        // Create regex to match the import statement
        const importRegex = new RegExp(
          `(import\\s+.*?\\s+from\\s+['"\`])${escapeRegex(importPath)}(['"\`])`,
          'g'
        );

        const newContent = content.replace(importRegex, `$1${replacement}$2`);
        if (newContent !== content) {
          content = newContent;
          changeCount++;
        }
      });

      if (changeCount > 0) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed ${changeCount} imports in ${filePath}`);
      }
    });

    console.log('\n✅ All fixes applied successfully!');
  }

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

findMissingExtensions();

// @ts-nocheck
import { generate } from '@babel/generator';
import * as t from '@babel/types';
import { babelParse } from 'ast-kit';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../../logger.server.js';
import {
  CONFIG_DIR,
  GENERATED_DIR,
  OUTPUT_DIR,
  paramsPath,
  schemaPath
} from '../../constants.server.js';

/**
 * $ prefix-based sanitizer that rules:
 * - All server-only config properties begin with $ (e.g., $url, $hooks)
 * - All server-only field methods begin with $ (e.g., $beforeSave, $beforeRead)
 * - Content must be pure functions or imports from .server.ts files
 * - Outputs to .generated folder, preserving original folder structure
 */

// The top-level config — real, hand-authored. Unlike every other .server.ts file under
// +rime/ (copied verbatim, server-only, no client counterpart needed), this one always needs
// a sanitized client copy too — the panel still needs +rime.generated/rime.config.ts.
const TOP_LEVEL_CONFIG = 'rime.config.server.ts';

/** Whether the sanitizer reads `name` as code, and splits it when it holds `$` content. */
const isConfigModule = (name) => /\.(ts|js)$/.test(name) && !/\.server\.(ts|js)$/.test(name);

const isServerFile = (name) => name.endsWith('.server.ts');

/** Where a split file's server copy goes: `news.ts` → `news.server.ts`, `news.js` → `news.server.js`. */
const serverHalfOf = (filePath) => filePath.replace(/\.(ts|js)$/, '.server.$1');

export async function sanitize() {
  const root = process.cwd();
  const configDir = path.resolve(root, CONFIG_DIR);
  const outputDir = path.resolve(root, GENERATED_DIR);

  logger.debug('Sanitizing config...');

  // List all existing files recursively in the output directory
  const existingFiles = new Set();
  if (fs.existsSync(outputDir)) {
    const scanExistingFiles = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanExistingFiles(fullPath);
        } else {
          existingFiles.add(path.relative(outputDir, fullPath));
        }
      }
    };
    scanExistingFiles(outputDir);
  } else {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Track files that will be written during sanitization
  const outputFiles = new Set();

  // Track files that get split into both client and server versions
  const splitFiles = new Set();

  // Scan all .ts and .js files (excluding .server.ts and .server.js)
  const allFiles = scanFiles(configDir, isConfigModule);

  // Pre-scan files to determine which ones will be split (contain server content)
  const sourcesByFile = new Map();
  for (const filePath of allFiles) {
    // Forward slashes, to match how imports are compared later
    const relativePath = path.relative(configDir, filePath).split(path.sep).join('/');
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ast = babelParse(content, 'ts', { sourceType: 'module', attachComment: false });
      if (analyzeFile(ast).hasServerContent) splitFiles.add(relativePath);
      sourcesByFile.set(
        relativePath,
        moduleSources(ast.body).map((node) => node.source.value)
      );
    } catch (err) {
      logger.warn(`Failed to analyze ${relativePath} during pre-scan: ${err.message}`);
    }
  }

  splitImporters(sourcesByFile, splitFiles);

  // Also scan and copy all existing .server.ts files — except the top-level config, which
  // gets its own client+server split below instead of a plain verbatim copy.
  const serverFiles = scanFiles(configDir, isServerFile).filter(
    (filePath) => path.relative(configDir, filePath) !== TOP_LEVEL_CONFIG
  );

  // Scan and copy all other files (.server.js, .svelte, .json, etc.)
  const otherFiles = scanFiles(configDir, (name) => !name.endsWith('.ts') && !isConfigModule(name));

  // Top-level config split: same client/server treatment as every other split file below,
  // just addressed by its fixed name instead of found via the scan (it's .server.ts-suffixed,
  // so allFiles never sees it). Runs after the pre-scan above so splitFiles is
  // fully populated — this file's own `import { Pages } from './pages'`-style imports need to
  // know which nested files themselves got split.
  await processTopLevelConfig(configDir, outputDir, outputFiles, splitFiles);

  for (const filePath of allFiles) {
    const relativePath = path.relative(configDir, filePath);
    logger.debug(`   Processing: ${relativePath}`);

    // Check if corresponding .server.ts or .server.js already exists
    const originalServerPath = serverHalfOf(filePath);
    if (fs.existsSync(originalServerPath)) {
      throw new Error(
        `Error: ${originalServerPath} already exists. Remove it before running sanitization.`
      );
    }

    // Process the file and output to .generated
    await processConfigFile(filePath, configDir, outputDir, outputFiles, splitFiles);
  }

  // Copy existing .server.ts files
  for (const filePath of serverFiles) {
    const relativePath = path.relative(configDir, filePath);
    writeOutput(outputDir, relativePath, fs.readFileSync(filePath, 'utf-8'), outputFiles);
  }

  // Copy other files (.server.js, .svelte, .json, etc.)
  for (const filePath of otherFiles) {
    const relativePath = path.relative(configDir, filePath);
    writeOutput(outputDir, relativePath, fs.readFileSync(filePath, 'utf-8'), outputFiles);
  }

  // Delete files that exist in current list but not in output list. Two files are excluded:
  // other codegen steps write them straight into OUTPUT_DIR and sanitize() never adds them to
  // outputFiles, so without this every sanitize run deletes them out from under their writer's
  // own cache guard.
  //   schema.server.ts  write.server.ts, see schemaPath() in constants.server.ts
  //   params.ts         generateRoutes, see paramsPath() in constants.server.ts
  const WRITTEN_ELSEWHERE = new Set([path.basename(schemaPath()), path.basename(paramsPath())]);
  for (const existingFile of existingFiles) {
    if (!WRITTEN_ELSEWHERE.has(existingFile) && !outputFiles.has(existingFile)) {
      const fileToDelete = path.join(outputDir, existingFile);
      fs.unlinkSync(fileToDelete);
      logger.debug(`   Deleted: ${existingFile}`);
    }
  }

  logger.debug('Sanitization complete');
}

/**
 * The top-level config (`<CONFIG_DIR>/rime.config.server.ts`, `src/+rime/` by default) — real,
 * hand-authored. Client copy via analyzeFile + sanitizeClientAst + removeUnusedImports, written
 * into +rime.generated/, plus a server copy via updateServerImports so its own imports of nested
 * split files resolve like every other split file's do.
 */
async function processTopLevelConfig(configDir, outputDir, outputFiles, splitFiles) {
  const sourcePath = path.join(configDir, TOP_LEVEL_CONFIG);
  if (!fs.existsSync(sourcePath)) return; // ensureUserConfigExist() already guards this

  const content = fs.readFileSync(sourcePath, 'utf-8');
  const ast = babelParse(content, 'ts', { sourceType: 'module', attachComment: false });
  const analysis = analyzeFile(ast);

  const clientPath = path.join(outputDir, 'rime.config.ts');
  const serverPath = path.join(outputDir, TOP_LEVEL_CONFIG);
  outputFiles.add(path.relative(outputDir, clientPath));
  outputFiles.add(path.relative(outputDir, serverPath));

  const clientAst = sanitizeClientAst(ast, analysis);
  const cleanedAst = removeUnusedImports(clientAst);
  const clientCode = generate(cleanedAst, { compact: false, comments: true }).code;
  if (shouldWriteFile(clientPath, clientCode)) {
    fs.writeFileSync(clientPath, clientCode);
    logger.debug(`   Sanitized: rime.config.ts`);
  }

  const serverContent = updateServerImports(content, splitFiles, '.');
  if (shouldWriteFile(serverPath, serverContent)) {
    fs.writeFileSync(serverPath, serverContent);
    logger.debug(`   Created: ${TOP_LEVEL_CONFIG}`);
  }
}

/** Every file under `dir` whose name passes `keep`, the generated folder left out. */
function scanFiles(dir, keep) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) return item.name === OUTPUT_DIR ? [] : scanFiles(fullPath, keep);
    return item.isFile() && keep(item.name) ? [fullPath] : [];
  });
}

async function processConfigFile(originalPath, configDir, outputDir, outputFiles, splitFiles) {
  const content = fs.readFileSync(originalPath, 'utf-8');
  const relativePath = path.relative(configDir, originalPath);

  try {
    if (!splitFiles.has(relativePath.split(path.sep).join('/'))) {
      // No server content and no split import: one copy for both sides
      writeOutput(outputDir, relativePath, content, outputFiles);
      return;
    }

    // Server version: full content with updated imports
    const serverContent = updateServerImports(content, splitFiles, path.dirname(relativePath));
    writeOutput(outputDir, serverHalfOf(relativePath), serverContent, outputFiles);

    // Sanitized client version
    writeOutput(outputDir, relativePath, clientCopy(content), outputFiles);
  } catch (error) {
    logger.error(`    Failed to process ${originalPath}:`, error.message);
    throw error;
  }
}

/** The name of an object key written as `name` or `'name'`; '' for a computed key. */
const keyName = (member) => {
  if (member.computed) return '';
  if (t.isIdentifier(member.key)) return member.key.name;
  if (t.isStringLiteral(member.key)) return member.key.value;
  return '';
};

/**
 * Whether `node` is a server-only member of an object literal, in any of its spellings:
 *
 * ```js
 * { $url: toUrl, $url(doc) { … }, '$url': (doc) => … }
 * ```
 */
const isDollarMember = (node) =>
  (t.isObjectProperty(node) || t.isObjectMethod(node)) && keyName(node).startsWith('$');

/** What a `$` member runs or holds: a method's body, a property's value. */
const dollarMemberValue = (node) => (t.isObjectMethod(node) ? node.body : node.value);

function analyzeFile(ast) {
  const analysis = {
    hasServerContent: false,
    serverFunctions: new Set(),
    functionsUsedInDollarProps: new Set()
  };

  // Walk the AST to find $ patterns
  function walkNode(node) {
    if (!node || typeof node !== 'object') return;

    // Find imports from .server.ts files
    if (t.isImportDeclaration(node)) {
      const source = node.source.value;
      if (source.includes('.server')) {
        analysis.hasServerContent = true;
      }
    }

    // Find $ prefixed object properties
    if (isDollarMember(node)) {
      analysis.hasServerContent = true;
      // Track functions used within $ properties
      collectIdentifiers(dollarMemberValue(node), analysis.functionsUsedInDollarProps);
    }

    // Find $ prefixed method calls (e.g., .$beforeSave())
    if (
      t.isCallExpression(node) &&
      t.isMemberExpression(node.callee) &&
      t.isIdentifier(node.callee.property) &&
      node.callee.property.name.startsWith('$')
    ) {
      analysis.hasServerContent = true;
    }

    // Find local functions that might be used by $ methods
    if (
      t.isVariableDeclarator(node) &&
      t.isIdentifier(node.id) &&
      (t.isArrowFunctionExpression(node.init) || t.isFunctionExpression(node.init))
    ) {
      // Check if this function is used by server content
      if (isFunctionUsedByServerContent(node.id.name, ast)) {
        analysis.serverFunctions.add(node.id.name);
      }
    }

    if (t.isFunctionDeclaration(node) && node.id) {
      if (isFunctionUsedByServerContent(node.id.name, ast)) {
        analysis.serverFunctions.add(node.id.name);
      }
    }

    // Recursively walk child nodes
    for (const key in node) {
      if (Object.prototype.hasOwnProperty.call(node, key) && key !== 'parent') {
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(walkNode);
        } else if (child && typeof child === 'object') {
          walkNode(child);
        }
      }
    }
  }

  walkNode(ast);
  return analysis;
}

function isFunctionUsedByServerContent(functionName, ast) {
  // Simple heuristic: if function is used as argument to $ methods or imported from server
  let isUsedByServer = false;

  function checkUsage(node) {
    if (!node || typeof node !== 'object') return;

    // Check if function is used as argument to $ methods
    if (
      t.isCallExpression(node) &&
      t.isMemberExpression(node.callee) &&
      t.isIdentifier(node.callee.property) &&
      node.callee.property.name.startsWith('$')
    ) {
      // Check if our function is used as an argument
      node.arguments.forEach((arg) => {
        if (t.isIdentifier(arg) && arg.name === functionName) {
          isUsedByServer = true;
        }
      });
    }

    // Check if function is used in $ properties
    if (isDollarMember(node)) {
      function checkValue(value) {
        if (t.isIdentifier(value) && value.name === functionName) {
          isUsedByServer = true;
        } else if (t.isObjectExpression(value)) {
          value.properties.forEach((prop) => {
            if (t.isObjectProperty(prop)) {
              checkValue(prop.value);
            }
          });
        } else if (t.isArrayExpression(value)) {
          value.elements.forEach((el) => {
            if (el) checkValue(el);
          });
        }
      }

      checkValue(dollarMemberValue(node));
    }

    // Recursively check child nodes
    for (const key in node) {
      if (Object.prototype.hasOwnProperty.call(node, key) && key !== 'parent') {
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(checkUsage);
        } else if (child && typeof child === 'object') {
          checkUsage(child);
        }
      }
    }
  }

  checkUsage(ast);
  return isUsedByServer;
}

/** Adds to `names` every identifier in the subtree of `node`. */
function collectIdentifiers(node, names) {
  if (!node || typeof node !== 'object') return;
  if (t.isIdentifier(node)) names.add(node.name);
  for (const key in node) {
    if (key === 'parent') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach((c) => collectIdentifiers(c, names));
    } else {
      collectIdentifiers(child, names);
    }
  }
}

function sanitizeClientAst(ast, analysis) {
  const clonedAst = JSON.parse(JSON.stringify(ast));

  function sanitizeNode(node) {
    if (!node || typeof node !== 'object') return node;

    // Remove imports from .server.ts files
    if (t.isImportDeclaration(node)) {
      const source = node.source.value;
      if (source.includes('.server')) {
        return null; // Mark for removal
      }
    }

    // Replace rime with rimeClient in imports
    if (t.isImportDeclaration(node)) {
      node.specifiers.forEach((spec) => {
        if (
          t.isImportSpecifier(spec) &&
          t.isIdentifier(spec.imported) &&
          spec.imported.name === 'rime'
        ) {
          spec.imported.name = 'rimeClient';
          if (t.isIdentifier(spec.local)) {
            spec.local.name = 'rimeClient';
          }
        }
      });
    }

    // Replace rime function calls with rimeClient
    if (t.isCallExpression(node) && t.isIdentifier(node.callee) && node.callee.name === 'rime') {
      node.callee.name = 'rimeClient';
    }

    // Remove $ prefixed object properties
    if (t.isObjectExpression(node)) {
      node.properties = node.properties.filter((prop) => !isDollarMember(prop));
    }

    // Remove $ prefixed method calls from call chains
    if (
      t.isCallExpression(node) &&
      t.isMemberExpression(node.callee) &&
      t.isIdentifier(node.callee.property) &&
      node.callee.property.name.startsWith('$')
    ) {
      // Return the object the method was called on (strip the method call)
      return sanitizeNode(node.callee.object);
    }

    // Recursively sanitize child nodes
    for (const key in node) {
      if (Object.prototype.hasOwnProperty.call(node, key) && key !== 'parent') {
        const child = node[key];
        if (Array.isArray(child)) {
          node[key] = child.map(sanitizeNode).filter((item) => item !== null);
        } else if (child && typeof child === 'object') {
          const sanitized = sanitizeNode(child);
          if (sanitized === null) {
            delete node[key];
          } else {
            node[key] = sanitized;
          }
        }
      }
    }

    return node;
  }

  // Apply sanitization, then drop what only the removed server content read
  sanitizeNode(clonedAst);
  removeServerOnlyDeclarations(clonedAst, analysis);

  // Final cleanup: remove orphaned expression statements (standalone identifiers)
  if (clonedAst.body) {
    clonedAst.body = clonedAst.body.filter((node) => {
      // Remove expression statements that are just standalone identifiers
      if (t.isExpressionStatement(node) && t.isIdentifier(node.expression)) {
        return false; // Remove orphaned references like "legendField;"
      }
      return true;
    });
  }

  return clonedAst;
}

/** Every name the code reads, outside import lines, declaration names and `$` properties. */
function referencedNames(program) {
  return namesReadBy(program.body);
}

/** The names `node` reads, by the same rules as `referencedNames`. */
function namesReadBy(node) {
  const used = new Set();

  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (t.isImportDeclaration(node)) return;
    if (t.isVariableDeclarator(node)) {
      visit(node.init);
      return;
    }
    if (t.isFunctionDeclaration(node)) {
      visit(node.body);
      return;
    }
    if (isDollarMember(node)) return;
    if (t.isIdentifier(node)) used.add(node.name);
    for (const key in node) {
      if (key === 'parent') continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  }

  if (Array.isArray(node)) {
    node.forEach(visit);
  } else {
    visit(node);
  }
  return used;
}

const declarationOf = (statement) =>
  t.isExportNamedDeclaration(statement) ? statement.declaration : statement;

/**
 * What each top-level declaration reads: one entry per variable, function or other statement.
 *
 * ```ts
 * const a = 1, b = a; // [{ node: a, names: {} }, { node: b, names: { a } }]
 * ```
 */
function readersOf(program) {
  return program.body.flatMap((statement) => {
    const declaration = declarationOf(statement);
    if (t.isVariableDeclaration(declaration)) {
      return declaration.declarations.map((node) => ({ node, names: namesReadBy(node) }));
    }
    return [{ node: declaration, names: namesReadBy(statement) }];
  });
}

/**
 * Removes the top-level declarations that only the removed server content read. A name still read
 * by the client copy stays; the pass repeats, so a helper read only by a removed helper goes too.
 * A declaration's reads of its own name do not keep it.
 *
 * ```ts
 * const slug = 'news';                      // kept: the label reads it
 * const toUrl = (doc) => '/' + slug + doc.id; // removed: only $url read it
 * const setHome = Hooks.beforeUpsert(async function setHome(args) {…}); // removed: only itself
 * export const News = Collection.create(slug, { label: slug, $url: toUrl });
 * ```
 */
function removeServerOnlyDeclarations(program, analysis) {
  const serverNames = new Set([
    ...analysis.serverFunctions,
    ...analysis.functionsUsedInDollarProps
  ]);

  let removed = true;
  while (removed) {
    removed = false;
    const readers = readersOf(program);
    const readElsewhere = (name, own) =>
      readers.some((reader) => reader.node !== own && reader.names.has(name));
    const serverOnly = (id, own) =>
      t.isIdentifier(id) && serverNames.has(id.name) && !readElsewhere(id.name, own);

    // What a removed declaration read may now be read by nobody: it is a candidate too
    const remove = (node) => {
      removed = true;
      collectIdentifiers(node, serverNames);
    };

    program.body = program.body.filter((statement) => {
      const declaration = declarationOf(statement);
      if (t.isFunctionDeclaration(declaration) && serverOnly(declaration.id, declaration)) {
        remove(declaration.body);
        return false;
      }
      if (t.isVariableDeclaration(declaration)) {
        const kept = declaration.declarations.filter((declarator) => {
          if (!serverOnly(declarator.id, declarator)) return true;
          remove(declarator.init);
          return false;
        });
        declaration.declarations = kept;
        return kept.length > 0;
      }
      return true;
    });
  }
}

/**
 * The client copy of a config file: its server content removed, and what only that content used.
 *
 * ```ts
 * clientCopy(`export const News = Collection.create('news', { label: 'News', $url: (doc) => doc.id });`);
 * // export const News = Collection.create('news', { label: 'News' });
 * ```
 */
export function clientCopy(content) {
  const ast = babelParse(content, 'ts', { sourceType: 'module', attachComment: false });
  const clientAst = sanitizeClientAst(ast, analyzeFile(ast));
  return generate(removeUnusedImports(clientAst), { compact: false, comments: true }).code;
}

/**
 * The server path for a relative import of a split file, or null.
 *
 * ```js
 * serverImportOf('./pages', 'collections', new Set(['collections/pages.ts']))  // './pages.server.js'
 * serverImportOf('./blocks', '.', new Set(['blocks/index.ts']))                // './blocks/index.server.js'
 * ```
 */
function serverImportOf(importPath, currentDir, splitFiles) {
  if (!importPath.startsWith('./') && !importPath.startsWith('../')) return null;
  if (importPath.includes('.server')) return null;

  const importNoExt = importPath.replace(/\/+$/, '').replace(/(\.js|\.ts)$/, '');
  const normalize = (p) =>
    path
      .normalize(p)
      .replace(/^\.\/?/, '')
      .split(path.sep)
      .join('/');
  const split = new Set([...splitFiles].map(normalize));
  // A split file is found under its `.ts` or its `.js` name
  const isSplit = (noExt) =>
    ['.ts', '.js'].some((ext) => split.has(normalize(path.join(currentDir, noExt + ext))));

  if (isSplit(importNoExt)) {
    return importNoExt + '.server.js';
  }
  if (isSplit(importNoExt + '/index')) {
    return importNoExt + '/index.server.js';
  }
  return null;
}

/**
 * Adds to `splitFiles` every file that imports or re-exports a split file: its server copy then
 * points at the server halves. Repeated until no file joins, so a chain of barrels splits every
 * link.
 *
 * ```js
 * // pages.ts has a $url; collections/index.ts: export { Pages } from './pages'
 * splitImporters(new Map([['collections/index.ts', ['./pages']]]), new Set(['collections/pages.ts']));
 * // splitFiles: collections/pages.ts, collections/index.ts
 * ```
 */
export function splitImporters(sourcesByFile, splitFiles) {
  let joined = true;
  while (joined) {
    joined = false;
    for (const [relativePath, sources] of sourcesByFile) {
      if (splitFiles.has(relativePath)) continue;
      const dir = path.posix.dirname(relativePath);
      if (sources.some((source) => serverImportOf(source, dir, splitFiles))) {
        splitFiles.add(relativePath);
        joined = true;
      }
    }
  }
}

/** The statements that name a module: `import … from`, `export … from`, `export * from`. */
const moduleSources = (body) =>
  body.filter(
    (node) =>
      (t.isImportDeclaration(node) ||
        t.isExportNamedDeclaration(node) ||
        t.isExportAllDeclaration(node)) &&
      t.isStringLiteral(node.source)
  );

/** `ast` without the import specifiers its code does not read; an import left with none goes. */
function removeUnusedImports(ast) {
  const used = referencedNames(ast);
  ast.body = ast.body.filter((node) => {
    if (!t.isImportDeclaration(node)) return true;
    node.specifiers = node.specifiers.filter((spec) => used.has(spec.local.name));
    return node.specifiers.length > 0;
  });
  return ast;
}

/**
 * Updates imports in server files to use server versions of split modules
 */
export function updateServerImports(content, splitFiles, currentDir) {
  try {
    const ast = babelParse(content, 'ts', { sourceType: 'module', attachComment: false });

    let hasChanges = false;

    for (const node of moduleSources(ast.body)) {
      const newImportPath = serverImportOf(node.source.value, currentDir, splitFiles);
      if (!newImportPath) continue;

      // Set the node's source value and ensure it renders with single quotes
      node.source.value = newImportPath;
      node.source.extra = { raw: `'${newImportPath}'`, rawValue: newImportPath };
      hasChanges = true;
    }

    if (hasChanges) {
      return generate(ast, { compact: false, comments: true }).code;
    }

    return content;
  } catch (error) {
    // If parsing fails, return original content
    logger.warn(`Failed to update imports in server file: ${error.message}`);
    return content;
  }
}

/** Writes `content` at `relativePath` under `outputDir` when it differs, and records the file as produced. */
function writeOutput(outputDir, relativePath, content, outputFiles) {
  const outputPath = path.join(outputDir, relativePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  outputFiles.add(relativePath);
  if (shouldWriteFile(outputPath, content)) {
    fs.writeFileSync(outputPath, content);
    logger.debug(`   Wrote: ${relativePath}`);
  }
}

/**
 * Checks if a file should be written by comparing content with existing file
 */
function shouldWriteFile(filePath, newContent) {
  if (!fs.existsSync(filePath)) {
    return true;
  }

  const existingContent = fs.readFileSync(filePath, 'utf-8');
  return existingContent !== newContent;
}

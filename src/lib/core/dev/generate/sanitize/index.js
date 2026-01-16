// @ts-nocheck
import { generate } from '@babel/generator';
import * as t from '@babel/types';
import { babelParse } from 'ast-kit';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../../logger/index.server.js';
import { INPUT_DIR, OUTPUT_DIR } from '../../constants.js';

/**
 * $ prefix-based sanitizer that rules:
 * - All server-only config properties begin with $ (e.g., $url, $hooks)
 * - All server-only field methods begin with $ (e.g., $beforeSave, $beforeRead)
 * - Content must be pure functions or imports from .server.ts files
 * - Outputs to .generated folder, preserving original folder structure
 */

export async function sanitize() {
	const root = process.cwd();
	const configDir = path.resolve(root, 'src/lib/', INPUT_DIR);
	const outputDir = path.resolve(root, 'src/lib/', OUTPUT_DIR);

	logger.info('Sanitizing config...');

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

	// Scan all TypeScript files (excluding .server.ts)
	const allFiles = await scanConfigFiles(configDir);

	// Pre-scan files to determine which ones will be split (contain server content)
	for (const filePath of allFiles) {
		const relativePath = path.relative(configDir, filePath);
		try {
			const content = fs.readFileSync(filePath, 'utf-8');
			const ast = babelParse(content, 'ts', { sourceType: 'module', attachComment: false });
			const analysis = analyzeFile(ast);
			if (analysis.hasServerContent) {
				// Normalize to forward slashes to match how imports are compared later
				splitFiles.add(relativePath.split(path.sep).join('/'));
			}
		} catch (err) {
			logger.warn(`Failed to analyze ${relativePath} during pre-scan: ${err.message}`);
		}
	}

	// Also scan and copy all existing .server.ts files
	const serverFiles = await scanServerFiles(configDir);

	// Scan and copy all other files (non-.ts files like .svelte, .json, etc.)
	const otherFiles = await scanOtherFiles(configDir);

	for (const filePath of allFiles) {
		const relativePath = path.relative(configDir, filePath);
		logger.debug(`   Processing: ${relativePath}`);

		// Check if corresponding .server.ts already exists
		const originalServerPath = filePath.replace('.ts', '.server.ts');
		if (fs.existsSync(originalServerPath)) {
			throw new Error(
				`Error: ${originalServerPath} already exists. Remove it before running sanitization.`
			);
		}

		// Process the file and output to .generated
		await processConfigFile(filePath, configDir, outputDir, outputFiles, splitFiles);
	}

	// Copy existing .server.ts files
	for (const serverFilePath of serverFiles) {
		const relativePath = path.relative(configDir, serverFilePath);
		const outputPath = path.join(outputDir, relativePath);
		const outputDirPath = path.dirname(outputPath);

		if (!fs.existsSync(outputDirPath)) {
			fs.mkdirSync(outputDirPath, { recursive: true });
		}

		const content = fs.readFileSync(serverFilePath, 'utf-8');
		const relativeOutputPath = path.relative(outputDir, outputPath);
		outputFiles.add(relativeOutputPath);

		// Only write if content is different or file doesn't exist
		if (shouldWriteFile(outputPath, content)) {
			fs.writeFileSync(outputPath, content);
			logger.debug(`   Copied: ${relativePath}`);
		}
	}

	// Copy other files (.svelte, .json, etc.)
	for (const otherFilePath of otherFiles) {
		const relativePath = path.relative(configDir, otherFilePath);
		const outputPath = path.join(outputDir, relativePath);
		const outputDirPath = path.dirname(outputPath);

		if (!fs.existsSync(outputDirPath)) {
			fs.mkdirSync(outputDirPath, { recursive: true });
		}

		const content = fs.readFileSync(otherFilePath, 'utf-8');
		const relativeOutputPath = path.relative(outputDir, outputPath);
		outputFiles.add(relativeOutputPath);

		// Only write if content is different or file doesn't exist
		if (shouldWriteFile(outputPath, content)) {
			fs.writeFileSync(outputPath, content);
			logger.debug(`   Copied: ${relativePath}`);
		}
	}

	// Delete files that exist in current list but not in output list
	for (const existingFile of existingFiles) {
		// Do not delete "schema.server.ts"
		if (!outputFiles.has(existingFile) && existingFile !== 'schema.server.ts') {
			const fileToDelete = path.join(outputDir, existingFile);
			fs.unlinkSync(fileToDelete);
			logger.debug(`   Deleted: ${existingFile}`);
		}
	}

	logger.info('Sanitization complete');
}

async function scanConfigFiles(configDir) {
	const files = [];

	function scanDir(currentDir) {
		const items = fs.readdirSync(currentDir, { withFileTypes: true });

		for (const item of items) {
			const fullPath = path.join(currentDir, item.name);

			if (item.isDirectory() && item.name !== OUTPUT_DIR) {
				scanDir(fullPath);
			} else if (item.isFile() && item.name.endsWith('.ts') && !item.name.endsWith('.server.ts')) {
				files.push(fullPath);
			}
		}
	}

	scanDir(configDir);
	return files;
}

async function scanServerFiles(configDir) {
	const files = [];

	function scanDir(currentDir) {
		const items = fs.readdirSync(currentDir, { withFileTypes: true });

		for (const item of items) {
			const fullPath = path.join(currentDir, item.name);

			if (item.isDirectory() && item.name !== OUTPUT_DIR) {
				scanDir(fullPath);
			} else if (item.isFile() && item.name.endsWith('.server.ts')) {
				files.push(fullPath);
			}
		}
	}

	scanDir(configDir);
	return files;
}

async function scanOtherFiles(configDir) {
	const files = [];

	function scanDir(currentDir) {
		const items = fs.readdirSync(currentDir, { withFileTypes: true });

		for (const item of items) {
			const fullPath = path.join(currentDir, item.name);

			if (item.isDirectory() && item.name !== OUTPUT_DIR) {
				scanDir(fullPath);
			} else if (item.isFile() && !item.name.endsWith('.ts')) {
				files.push(fullPath);
			}
		}
	}

	scanDir(configDir);
	return files;
}

async function processConfigFile(originalPath, configDir, outputDir, outputFiles, splitFiles) {
	const content = fs.readFileSync(originalPath, 'utf-8');
	const relativePath = path.relative(configDir, originalPath);

	try {
		const ast = babelParse(content, 'ts', { sourceType: 'module', attachComment: false });

		// Analyze the file to find $ patterns
		const analysis = analyzeFile(ast);

		if (!analysis.hasServerContent) {
			// Just copy the original file to .generated
			const outputPath = path.join(outputDir, relativePath);
			const outputDirPath = path.dirname(outputPath);
			if (!fs.existsSync(outputDirPath)) {
				fs.mkdirSync(outputDirPath, { recursive: true });
			}
			const relativeOutputPath = path.relative(outputDir, outputPath);
			outputFiles.add(relativeOutputPath);

			// Only write if content is different or file doesn't exist
			if (shouldWriteFile(outputPath, content)) {
				fs.writeFileSync(outputPath, content);
			}
			return;
		}

		// Calculate output paths
		const clientPath = path.join(outputDir, relativePath);
		const serverPath = path.join(outputDir, relativePath.replace('.ts', '.server.ts'));

		// Ensure output directories exist
		const clientDir = path.dirname(clientPath);
		const serverDir = path.dirname(serverPath);
		if (!fs.existsSync(clientDir)) {
			fs.mkdirSync(clientDir, { recursive: true });
		}
		if (!fs.existsSync(serverDir)) {
			fs.mkdirSync(serverDir, { recursive: true });
		}

		// Track output files
		const relativeServerPath = path.relative(outputDir, serverPath);
		const relativeClientPath = path.relative(outputDir, clientPath);
		outputFiles.add(relativeServerPath);
		outputFiles.add(relativeClientPath);

		// Track this as a split file (has both client and server versions)
		const relativeOriginalPath = path.relative(configDir, originalPath);
		splitFiles.add(relativeOriginalPath);

		// Create server version (full content with updated imports)
		const serverContent = updateServerImports(content, splitFiles, path.dirname(relativePath));
		if (shouldWriteFile(serverPath, serverContent)) {
			fs.writeFileSync(serverPath, serverContent);
			logger.debug(`   Created: ${relativeServerPath}`);
		}

		// Create sanitized client version
		const clientAst = sanitizeClientAst(ast, analysis);
		// Clean up unused imports
		const cleanedAst = removeUnusedImports(clientAst);
		const clientCode = generate(cleanedAst, { compact: false, comments: true }).code;
		if (shouldWriteFile(clientPath, clientCode)) {
			fs.writeFileSync(clientPath, clientCode);
			logger.debug(`   Sanitized: ${relativeClientPath}`);
		}
	} catch (error) {
		logger.error(`    Failed to process ${originalPath}:`, error.message);
		throw error;
	}
}

function analyzeFile(ast) {
	const analysis = {
		hasServerContent: false,
		serverImports: new Set(),
		serverFunctions: new Set(),
		dollarProperties: new Set(),
		dollarMethods: new Set(),
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
				// Mark all imported identifiers as server
				node.specifiers.forEach((spec) => {
					if (t.isImportSpecifier(spec) || t.isImportDefaultSpecifier(spec)) {
						analysis.serverImports.add(spec.local.name);
					}
				});
			}
		}

		// Find $ prefixed object properties
		if (t.isObjectProperty(node) && t.isIdentifier(node.key) && node.key.name.startsWith('$')) {
			analysis.hasServerContent = true;
			analysis.dollarProperties.add(node.key.name);
			// Track functions used within $ properties
			findFunctionsInNode(node.value, analysis.functionsUsedInDollarProps);
		}

		// Find $ prefixed method calls (e.g., .$beforeSave())
		if (
			t.isCallExpression(node) &&
			t.isMemberExpression(node.callee) &&
			t.isIdentifier(node.callee.property) &&
			node.callee.property.name.startsWith('$')
		) {
			analysis.hasServerContent = true;
			analysis.dollarMethods.add(node.callee.property.name);
		}

		// Find local functions that might be used by $ methods
		if (
			t.isVariableDeclarator(node) &&
			t.isIdentifier(node.id) &&
			(t.isArrowFunctionExpression(node.init) || t.isFunctionExpression(node.init))
		) {
			// Check if this function is used by server content
			if (isFunctionUsedByServerContent(node.id.name, ast, analysis)) {
				analysis.serverFunctions.add(node.id.name);
			}
		}

		if (t.isFunctionDeclaration(node) && node.id) {
			if (isFunctionUsedByServerContent(node.id.name, ast, analysis)) {
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
		if (t.isObjectProperty(node) && t.isIdentifier(node.key) && node.key.name.startsWith('$')) {
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

			checkValue(node.value);
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

function findFunctionsInNode(node, functionsSet) {
	if (!node || typeof node !== 'object') return;

	if (t.isIdentifier(node)) {
		functionsSet.add(node.name);
	} else if (t.isArrayExpression(node)) {
		node.elements.forEach((element) => {
			if (element) findFunctionsInNode(element, functionsSet);
		});
	} else if (t.isObjectExpression(node)) {
		node.properties.forEach((prop) => {
			if (t.isObjectProperty(prop)) {
				findFunctionsInNode(prop.value, functionsSet);
			}
		});
	}

	// Recursively check child nodes
	for (const key in node) {
		if (Object.prototype.hasOwnProperty.call(node, key) && key !== 'parent') {
			const child = node[key];
			if (Array.isArray(child)) {
				child.forEach((item) => findFunctionsInNode(item, functionsSet));
			} else if (child && typeof child === 'object') {
				findFunctionsInNode(child, functionsSet);
			}
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
			node.properties = node.properties.filter((prop) => {
				if (t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name.startsWith('$')) {
					return false; // Remove $ properties
				}
				return true;
			});
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

		// Remove server function declarations and functions only used in $ properties
		if (t.isVariableDeclaration(node)) {
			node.declarations = node.declarations.filter((declarator) => {
				if (t.isIdentifier(declarator.id)) {
					const name = declarator.id.name;
					// Remove if it's a server function or only used in $ properties
					if (analysis.serverFunctions.has(name) || analysis.functionsUsedInDollarProps.has(name)) {
						return false;
					}
				}
				return true;
			});
			// If no declarations left, mark for removal
			if (node.declarations.length === 0) {
				return null;
			}
		}

		if (t.isFunctionDeclaration(node) && node.id) {
			const name = node.id.name;
			// Remove if it's a server function or only used in $ properties
			if (analysis.serverFunctions.has(name) || analysis.functionsUsedInDollarProps.has(name)) {
				return null;
			}
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

	// Apply sanitization
	sanitizeNode(clonedAst);

	// Remove null body items (removed imports/declarations)
	if (clonedAst.body) {
		clonedAst.body = clonedAst.body.filter((item) => item !== null);
	}

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

function removeUnusedImports(ast) {
	const clonedAst = JSON.parse(JSON.stringify(ast));

	// Collect all imported identifiers
	const importedIdentifiers = new Map(); // identifier -> import declaration
	const usedIdentifiers = new Set();

	// First pass: collect all imports
	function collectImports(node) {
		if (t.isImportDeclaration(node)) {
			node.specifiers.forEach((spec) => {
				let localName;
				if (t.isImportDefaultSpecifier(spec)) {
					localName = spec.local.name;
				} else if (t.isImportSpecifier(spec)) {
					localName = spec.local.name;
				} else if (t.isImportNamespaceSpecifier(spec)) {
					localName = spec.local.name;
				}

				if (localName) {
					importedIdentifiers.set(localName, node);
				}
			});
		}
	}

	// Second pass: find used identifiers
	function findUsedIdentifiers(node) {
		if (!node || typeof node !== 'object') return;

		// Skip import declarations and variable declarators' ids to avoid marking declarations as usage
		if (t.isImportDeclaration(node)) {
			return;
		}

		if (t.isVariableDeclarator(node)) {
			// Only check the init, not the id
			if (node.init) {
				findUsedIdentifiers(node.init);
			}
			return;
		}

		if (t.isFunctionDeclaration(node)) {
			// Only check the body, not the id and params
			if (node.body) {
				findUsedIdentifiers(node.body);
			}
			return;
		}

		// Skip $ prefixed object properties to avoid marking their content as used
		if (t.isObjectProperty(node) && t.isIdentifier(node.key) && node.key.name.startsWith('$')) {
			return;
		}

		if (t.isIdentifier(node)) {
			usedIdentifiers.add(node.name);
		}

		// Recursively check child nodes
		for (const key in node) {
			if (Object.prototype.hasOwnProperty.call(node, key) && key !== 'parent') {
				const child = node[key];
				if (Array.isArray(child)) {
					child.forEach(findUsedIdentifiers);
				} else if (child && typeof child === 'object') {
					findUsedIdentifiers(child);
				}
			}
		}
	}

	// Collect imports and find usage
	clonedAst.body.forEach(collectImports);
	clonedAst.body.forEach(findUsedIdentifiers);

	// Remove unused imports
	clonedAst.body = clonedAst.body.filter((node) => {
		if (t.isImportDeclaration(node)) {
			// Filter out unused specifiers
			node.specifiers = node.specifiers.filter((spec) => {
				let localName;
				if (t.isImportDefaultSpecifier(spec)) {
					localName = spec.local.name;
				} else if (t.isImportSpecifier(spec)) {
					localName = spec.local.name;
				} else if (t.isImportNamespaceSpecifier(spec)) {
					localName = spec.local.name;
				}

				return localName && usedIdentifiers.has(localName);
			});

			// Keep the import declaration only if it has remaining specifiers
			return node.specifiers.length > 0;
		}
		return true;
	});

	return clonedAst;
}

/**
 * Updates imports in server files to use server versions of split modules
 */
export function updateServerImports(content, splitFiles, currentDir) {
	try {
		const ast = babelParse(content, 'ts', { sourceType: 'module', attachComment: false });

		let hasChanges = false;

		// Helper to normalize paths for comparison with splitFiles entries
		const normalizeForCompare = (p) =>
			p
				.replace(/^\.\/?/, '')
				.split(path.sep)
				.join('/');
		const splitFilesSet = new Set(Array.from(splitFiles).map((s) => normalizeForCompare(s)));

		// Walk through all import declarations
		for (const node of ast.body) {
			if (t.isImportDeclaration(node) && t.isStringLiteral(node.source)) {
				const importPath = node.source.value;

				// Skip absolute imports and package imports
				if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
					continue;
				}

				// Skip already server imports
				if (importPath.includes('.server')) continue;

				// Normalize import path: remove trailing slashes and explicit extensions
				const cleanedImport = importPath.replace(/\/+$/, '');
				const importNoExt = cleanedImport.replace(/(\.js|\.ts)$/, '');

				// Build candidate relative paths (relative to config dir)
				const candidateFile = path.normalize(path.join(currentDir, importNoExt + '.ts'));
				const candidateIndex = path.normalize(path.join(currentDir, importNoExt, 'index.ts'));

				const candidateFileNorm = normalizeForCompare(candidateFile);
				const candidateIndexNorm = normalizeForCompare(candidateIndex);

				let matched = null;
				let matchedIsIndex = false;

				if (splitFilesSet.has(candidateFileNorm)) {
					matched = candidateFileNorm;
					matchedIsIndex = false;
				} else if (splitFilesSet.has(candidateIndexNorm)) {
					matched = candidateIndexNorm;
					matchedIsIndex = true;
				}

				if (matched) {
					// Build new import path: prefer .server.js so runtime imports point to JS server files
					let newImportPath;
					if (matchedIsIndex) {
						newImportPath = importNoExt + '/index.server.js';
					} else {
						newImportPath = importNoExt + '.server.js';
					}

					// Set the node's source value and ensure it renders with single quotes
					node.source.value = newImportPath;
					if (!node.source.extra || typeof node.source.extra !== 'object') {
						node.source.extra = {};
					}
					node.source.extra.raw = `'${newImportPath}'`;
					node.source.extra.rawValue = newImportPath;
					hasChanges = true;
				}
			}
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

// Run the sanitizer if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	sanitize().catch(console.error);
}

import { updateServerImports } from '.';
import { expect, test } from 'vitest';

test('server imports handle directory imports', () => {
	const content = "import { Posts } from './directory';";
	const splitFiles = new Set(['directory/index.ts']);
	const result = updateServerImports(content, splitFiles, '.');
	expect(result).toContain("from './directory/index.server.js'");
});

test('server imports handle implicit extension file imports', () => {
	const content = "import { Posts } from './posts';";
	const splitFiles = new Set(['posts.ts']);
	const result = updateServerImports(content, splitFiles, '.');
	expect(result).toContain("from './posts.server.js'");
});

test('server imports handle explicit extension file imports', () => {
	const content = "import { Posts } from './posts.js';";
	const splitFiles = new Set(['posts.ts']);
	const result = updateServerImports(content, splitFiles, '.');
	expect(result).toContain("from './posts.server.js'");
});

test('server imports handle mixed imports', () => {
	const content = `import A from './a';
import B from './b.js';
import C from './dir';
import P from 'pkg';`;
	const splitFiles = new Set(['a.ts', 'b.ts', 'dir/index.ts']);
	const result = updateServerImports(content, splitFiles, '.');

	expect(result).toContain("from './a.server.js'");
	expect(result).toContain("from './b.server.js'");
	expect(result).toContain("from './dir/index.server.js'");
	// package import should remain untouched
	expect(result).toContain("from 'pkg'");
});

test('server imports with no matching split files remain unchanged', () => {
	const content = "import { X } from './missing';";
	const splitFiles = new Set();
	const result = updateServerImports(content, splitFiles, '.');
	expect(result).toContain("from './missing'");
	expect(result).not.toContain('.server.js');
});

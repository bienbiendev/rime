import { UPLOAD_PATH } from '#lib/core/prototype/collection/upload/constant.js';
import { expect, test } from 'vitest';
import {
  buildUploadAria,
  getParentPath,
  getSegments,
  removePathFromLastAria,
  validatePath
} from './path.js';

test('getSegments("root") is the root', () => {
  const res = getSegments(UPLOAD_PATH.ROOT_NAME);
  expect(res.parent).toBe(null);
  expect(res.name).toBe(UPLOAD_PATH.ROOT_NAME);
  expect(res.path).toBe(UPLOAD_PATH.ROOT_NAME);
});

test('getSegments(null) is the root', () => {
  const res = getSegments(null);
  expect(res.parent).toBe(null);
  expect(res.name).toBe(UPLOAD_PATH.ROOT_NAME);
  expect(res.path).toBe(UPLOAD_PATH.ROOT_NAME);
});

test('should return parent root', () => {
  const res = getSegments('root:foo');
  expect(res.parent).toBe('root');
  expect(res.name).toBe('foo');
  expect(res.path).toBe('root:foo');
});

test('should return parent root:foo', () => {
  const res = getSegments('root:foo:bar');
  expect(res.parent).toBe('root:foo');
  expect(res.name).toBe('bar');
  expect(res.path).toBe('root:foo:bar');
});

// Additional tests for valid paths
test('should handle paths with hyphens', () => {
  const res = getSegments('root:coucou:bar-boz');
  expect(res.parent).toBe('root:coucou');
  expect(res.name).toBe('bar-boz');
  expect(res.path).toBe('root:coucou:bar-boz');
});

test('should handle paths with underscores', () => {
  const res = getSegments('root:foo_ouep:bar-boz');
  expect(res.parent).toBe('root:foo_ouep');
  expect(res.name).toBe('bar-boz');
  expect(res.path).toBe('root:foo_ouep:bar-boz');
});

test('should handle paths with spaces', () => {
  const res = getSegments('root:foo ouep:bar-boz-biz_baz bez');
  expect(res.parent).toBe('root:foo ouep');
  expect(res.name).toBe('bar-boz-biz_baz bez');
  expect(res.path).toBe('root:foo ouep:bar-boz-biz_baz bez');
});

// Test for trailing separator handling
test('should remove trailing separator', () => {
  const res = getSegments('root:foo:');
  expect(res.parent).toBe('root');
  expect(res.name).toBe('foo');
  expect(res.path).toBe('root:foo');
});

test('should handle multiple trailing separators', () => {
  const res = getSegments('root:foo::');
  expect(res.parent).toBe('root');
  expect(res.name).toBe('foo');
  expect(res.path).toBe('root:foo');
});

// Additional invalid path tests
test('should throw error for root/', () => {
  expect(() => getSegments('root/')).toThrow();
});

test('should throw error for root/baz', () => {
  expect(() => getSegments('root/baz')).toThrow();
});

test('should throw error for root/baz.foo', () => {
  expect(() => getSegments('root/baz.foo')).toThrow();
});

test('should throw error for root%3Abaz.foo', () => {
  expect(() => getSegments('root%3Abaz.foo')).toThrow();
});

test('getParentPath drops the last segment', () => {
  expect(getParentPath('root')).toBeNull();
  expect(getParentPath('root:press')).toBe('root');
  expect(getParentPath('root:press:2024')).toBe('root:press');
});

test('validatePath refuses a missing separator, an empty segment and a non-string', () => {
  expect(validatePath('root:foo')).toBe(true);
  expect(validatePath('rootfoo')).not.toBe(true);
  expect(validatePath('root::foo')).not.toBe(true);
  expect(validatePath(4)).not.toBe(true);
});

test('buildUploadAria links each folder, and the last one loses its link', () => {
  const aria = buildUploadAria({ path: 'root:a:b', slug: 'medias' as any, panelSegment: 'panel' });
  expect(aria.map((route) => route.url)).toEqual([
    '/panel/medias?uploadPath=root:a',
    '/panel/medias?uploadPath=root:a:b'
  ]);
  expect(removePathFromLastAria(aria).at(-1)).toEqual({ title: 'b' });
});

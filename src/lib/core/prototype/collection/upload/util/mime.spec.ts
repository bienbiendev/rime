import { describe, expect, test } from 'vitest';
import { isAcceptedType, servedMimeType } from './mime.js';

describe('servedMimeType', () => {
  test('a known extension is served as its type, any other as a download', () => {
    expect(servedMimeType('JPG')).toBe('image/jpeg');
    expect(servedMimeType('phtml')).toBe('application/x-httpd-php');
    expect(servedMimeType('')).toBe('application/octet-stream');
    expect(servedMimeType('xyz')).toBe('application/octet-stream');
  });
});

describe('isAcceptedType', () => {
  test('without `accept`, every type but the risky ones', () => {
    expect(isAcceptedType('image/png')).toBe(true);
    expect(isAcceptedType('application/octet-stream')).toBe(true);
    for (const extension of ['html', 'xhtml', 'svg', 'xml', 'xsl', 'mjs', 'php', 'php8', 'phar']) {
      expect(isAcceptedType(servedMimeType(extension)), extension).toBe(false);
    }
  });

  test('with `accept`, the listed types only', () => {
    expect(isAcceptedType('image/svg+xml', ['image/svg+xml'])).toBe(true);
    expect(isAcceptedType('image/png', ['image/jpeg'])).toBe(false);
    expect(isAcceptedType('application/octet-stream', ['image/jpeg'])).toBe(false);
  });
});

import { describe, expect, test } from 'vitest';
import { isAcceptedType, mimeTypesMap, servedMimeType, uploadType } from './mime.js';

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
    for (const extension of ['html', 'xhtml', 'xml', 'xsl', 'mjs', 'php', 'php8', 'phar', 'aspx']) {
      expect(isAcceptedType(servedMimeType(extension)), extension).toBe(false);
    }
  });

  test('without `accept`, every image, video and audio type, SVG included', () => {
    const media = Object.keys(mimeTypesMap).filter((type) => /^(image|video|audio)\//.test(type));
    expect(media).toContain('image/svg+xml');
    expect(media).toContain('video/mp4');
    for (const type of media) {
      expect(isAcceptedType(type), type).toBe(true);
    }
    expect(isAcceptedType(servedMimeType('svgz'))).toBe(true);
  });

  test('with `accept`, the listed types only', () => {
    expect(isAcceptedType('text/html', ['text/html'])).toBe(true);
    expect(isAcceptedType('image/svg+xml', ['image/png'])).toBe(false);
    expect(isAcceptedType('image/png', ['image/jpeg'])).toBe(false);
    expect(isAcceptedType('application/octet-stream', ['image/jpeg'])).toBe(false);
  });
});

describe('uploadType', () => {
  test('a file is typed by the extension it is saved under, whatever the browser says', () => {
    expect(uploadType('Photo.JPEG')).toEqual({ mimeType: 'image/jpeg', refusal: null });
    expect(uploadType('scan')).toEqual({ mimeType: 'application/octet-stream', refusal: null });
    expect(uploadType('scan.heic')).toEqual({
      mimeType: 'application/octet-stream',
      refusal: null
    });
  });

  test('a file the collection does not take is refused, in the words the server answers', () => {
    expect(uploadType('x.html').refusal).toBe('.html is not an accepted file type');
    expect(uploadType('scan', ['image/jpeg']).refusal).toBe(
      'A file with no extension is not an accepted file type'
    );
    expect(uploadType('x.html', ['text/html']).refusal).toBeNull();
  });
});

import { describe, expect, it, test } from 'vitest';
import * as util from './index.js';
import { mapSegments, normalizeFieldPath, sanitize, toKebabCase, toSnakeCase } from './string.js';

describe('sanitize', () => {
  describe('XSS Prevention', () => {
    it('should remove script tags', () => {
      expect(sanitize('<script>alert("XSS")</script>Hello')).toBe('Hello');
    });

    it.each([
      ['<div onclick="alert(\'XSS\')">Click me</div>', 'Click me'],
      ['<a href="javascript:alert(\'XSS\')">Click</a>', '<a>Click</a>'],
      ['<iframe src="javascript:alert(\'XSS\')"></iframe>', ''],
      ['<style>body { background: url("javascript:alert(\'XSS\')"); }</style>', ''],
      ['<img src="x" onerror="alert(\'XSS\')" onload="alert(\'XSS2\')">', '']
    ])('%j → %j', (input, output) => {
      expect(sanitize(input)).toBe(output);
    });

    it('should handle complex nested XSS attempts', () => {
      const malicious =
        '<div><script>alert("XSS")</script><strong onclick="alert(\'XSS2\')">Bold</strong></div>';
      expect(sanitize(malicious)).toBe('<strong>Bold</strong>');
    });
  });

  describe('Allowed Tags Preservation', () => {
    it('should preserve strong tags', () => {
      const input = '<strong>Bold text</strong>';
      const result = sanitize(input);
      expect(result).toBe('<strong>Bold text</strong>');
    });

    it('should preserve b tags', () => {
      const input = '<b>Bold text</b>';
      const result = sanitize(input);
      expect(result).toBe('<b>Bold text</b>');
    });

    it('should preserve em tags', () => {
      const input = '<em>Emphasized text</em>';
      const result = sanitize(input);
      expect(result).toBe('<em>Emphasized text</em>');
    });

    it('should preserve i tags', () => {
      const input = '<i>Italic text</i>';
      const result = sanitize(input);
      expect(result).toBe('<i>Italic text</i>');
    });

    it('should preserve u tags', () => {
      const input = '<u>Underlined text</u>';
      const result = sanitize(input);
      expect(result).toBe('<u>Underlined text</u>');
    });

    it('should preserve br tags', () => {
      const input = 'Line 1<br>Line 2';
      const result = sanitize(input);
      expect(result).toBe('Line 1<br>Line 2');
    });

    it('should preserve a tags with allowed attributes', () => {
      const input = '<a href="https://example.com" target="_blank">Link</a>';
      expect(sanitize(input)).toBe(input);
      expect(sanitize('<a _target="_blank">x</a>')).toBe('<a>x</a>');
    });

    it('should remove disallowed attributes from a tags', () => {
      const input = '<a href="https://example.com" onclick="alert(\'XSS\')" class="link">Link</a>';
      expect(sanitize(input)).toBe('<a href="https://example.com">Link</a>');
    });
  });

  describe('Non destructive string', () => {
    it('should preserve leading and trailing spaces', () => {
      const input = ' Phasellus nec ';
      const result = sanitize(input);
      expect(result).toBe(input);
    });

    it('should preserve leading spaces', () => {
      const input = ' Phasellus nec';
      const result = sanitize(input);
      expect(result).toBe(input);
    });

    it('should preserve trailing spaces', () => {
      const input = 'Phasellus nec ';
      const result = sanitize(input);
      expect(result).toBe(input);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined input', () => {
      const result = sanitize(undefined);
      expect(result).toBe('');
    });

    it('should handle empty string', () => {
      const result = sanitize('');
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = sanitize(null as any);
      expect(result).toBe('');
    });

    it('should handle plain text without HTML', () => {
      const input = 'Just plain text';
      const result = sanitize(input);
      expect(result).toBe('Just plain text');
    });

    it('should preserve url string', () => {
      const input =
        'https://26004206.fs1.hubspotusercontent-eu1.net/hubfs/26004206/ES+MA-Mini%20brochure%20JV.pdf?foo=bar&baz=0';
      const result = sanitize(input);
      expect(result).toBe(input);
    });

    it('should preserve email string', () => {
      const input = 'someone@foo.bar';
      const result = sanitize(input);
      expect(result).toBe(input);
    });

    it('should preserve &', () => {
      const input = 'one & two';
      const result = sanitize(input);
      expect(result).toBe(input);
    });

    it('should preserve accent, \' and "', () => {
      const input = 'Il est important de s\'exprimer avec "élégance"';
      const result = sanitize(input);
      expect(result).toBe(input);
    });

    it('should handle mixed allowed and disallowed tags', () => {
      const input = '<strong>Bold</strong><script>alert("XSS")</script><em>Italic</em>';
      const result = sanitize(input);
      expect(result).toBe('<strong>Bold</strong><em>Italic</em>');
    });
  });

  describe('Filter Bypass Techniques', () => {
    it('escapes a quote inside an attribute value', () => {
      // The handler stays inside the href value, as text
      expect(sanitize(`<a href='" onmouseover="alert(1)'>x</a>`)).toBe(
        '<a href="&quot; onmouseover=&quot;alert(1)">x</a>'
      );
    });

    it.each([' javascript:alert(1)', '\njavascript:alert(1)', 'JAVASCRIPT:alert(1)'])(
      'drops the href %j',
      (href) => {
        expect(sanitize(`<a href="${href}">x</a>`)).toBe('<a>x</a>');
      }
    );

    it('escapes an ampersand in a kept href', () => {
      expect(sanitize('<a href="https://e.com/?a=1&b=2">x</a>')).toBe(
        '<a href="https://e.com/?a=1&amp;b=2">x</a>'
      );
    });

    it.each([
      ['<script><script>alert(1)</script>', ''],
      ['<script><script>alert(1)</script></script>', ''],
      ['<scr<script>ipt>alert(1)</script>', 'scr'],
      ['<scr<object>ipt>alert(1)</script>', 'scr'],
      ['<img src=x onerror=alert(1)>', ''],
      ['<svg onload="alert(\'XSS\')"><circle r="10"/></svg>', '']
    ])('%j → %j', (input, output) => {
      expect(sanitize(input)).toBe(output);
    });

    // The parser ends a tag at the first `>`, even inside quotes: what is left is text
    it.each([
      '<object data="data:text/html,<script>alert(\'XSS\')</script>"></object>',
      '<a href="data:text/html,<script>alert(\'XSS\')</script>">Click</a>'
    ])('%j keeps no tag but a bare a', (input) => {
      expect(sanitize(input)).not.toMatch(/<(?!\/?a>)/);
    });

    it('should safely handle HTML entities', () => {
      const malicious = '&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;/script&gt;';
      const result = sanitize(malicious);
      expect(result).toBe('');
    });

    it('should keep string after handling HTML entities', () => {
      const malicious = '&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;/script&gt;Hello';
      const result = sanitize(malicious);
      expect(result).toBe('Hello');
    });

    it('should handle double encoded HTML entities', () => {
      const malicious = '&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;/script&gt;Hello';
      const encodedStr = malicious.replace(
        /[\u00A0-\u9999<>&]/g,
        (i) => '&#' + i.charCodeAt(0) + ';'
      );
      const result = sanitize(encodedStr);
      expect(result).toBe('Hello');
    });

    it('should handle triple encoded HTML entities', () => {
      const malicious = '<iframe src="javascript:alert(1)">Content</iframe>';
      // First encoding: < becomes &lt;
      let encoded = malicious.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      // Second encoding: & becomes &amp;
      encoded = encoded.replace(/&/g, '&amp;');
      // Third encoding: & becomes &amp; again
      encoded = encoded.replace(/&/g, '&amp;');
      const result = sanitize(encoded);
      expect(result).toBe('');
    });

    it('should handle mixed numeric and named entity encoding', () => {
      // Mix of &#38; (numeric &) and &lt; (named <)
      const encoded = '&#38;lt;script&#38;gt;alert(&#34;XSS&#34;)&#38;lt;/script&#38;gt;Text';
      const result = sanitize(encoded);
      expect(result).toBe('Text');
    });

    it('should handle deeply nested encoding with allowed tags', () => {
      const input = '<strong>Bold</strong><script>alert(1)</script><em>Italic</em>';
      // Double encode everything
      let encoded = input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      encoded = encoded.replace(/&/g, '&amp;');
      const result = sanitize(encoded);
      expect(result).toBe('<strong>Bold</strong><em>Italic</em>');
    });
  });

  describe('text that holds a <', () => {
    it.each([
      ['1 < 2 and 3 > 2', '1 &lt; 2 and 3 > 2'],
      ['5 &lt; 6', '5 &lt; 6'],
      ['if a<3 then', 'if a&lt;3 then'],
      ['<b>x</b> < y', '<b>x</b> &lt; y'],
      ['1 < 2 &amp; 3', '1 &lt; 2 & 3']
    ])('keeps %j', (input, output) => {
      expect(sanitize(input)).toBe(output);
    });

    it('escapes a < in a link href once', () => {
      expect(sanitize('<a href="/s?q=1<2">x</a> < y')).toBe('<a href="/s?q=1&lt;2">x</a> &lt; y');
    });
  });

  it('drops a U+E000 the input holds, where it marks no space', () => {
    expect(sanitize('a\uE000b <b>c\uE000d</b>')).toBe('ab <b>cd</b>');
  });
});

describe('mapSegments', () => {
  test('keeps a segment boundary distinct from a word break', () => {
    // The whole naming scheme rests on this: `__` marks "shadow of", camelCase marks a word.
    // Plain toSnakeCase collapses the two, so `someSlug__versions` and `someSlugVersions` both
    // become `some_slug_versions` and a user collection can forge a shadow table.
    expect(mapSegments('someSlug__versions', toSnakeCase, '__')).toBe('some_slug__versions');
    expect(mapSegments('someSlugVersions', toSnakeCase, '__')).toBe('some_slug_versions');
    expect(mapSegments('someSlug__versions', toSnakeCase, '__')).not.toBe(
      mapSegments('someSlugVersions', toSnakeCase, '__')
    );
  });

  test('produces the url form from the same canonical slug', () => {
    expect(mapSegments('someSlug__versions', toKebabCase, '--')).toBe('some-slug--versions');
    expect(mapSegments('someSlugDirectories', toKebabCase, '--')).toBe('some-slug-directories');
    expect(mapSegments('pages', toKebabCase, '--')).toBe('pages');
  });

  test('a directories slug is one segment, so it snake-cases straight through', () => {
    // No `__`: directories is a sibling collection, not a shadow, so its table name carries no
    // relationship marker — and stays what it is today.
    expect(mapSegments('mediasDirectories', toSnakeCase, '__')).toBe('medias_directories');
  });

  test('preserves a leading underscore rather than reading it as a boundary', () => {
    expect(mapSegments('_path', toSnakeCase, '__')).toBe('_path');
    expect(mapSegments('_someField', toSnakeCase, '__')).toBe('_some_field');
  });
});

describe('normalizeFieldPath', () => {
  test('removes the block type after an index', () => {
    expect(normalizeFieldPath('bar.0:booz.foo')).toBe('bar.0.foo');
  });

  test('removes every block type of a nested path', () => {
    expect(normalizeFieldPath('bar.0:hello.foo.4:guys.baz')).toBe('bar.0.foo.4.baz');
  });

  test('leaves a path with no block type as it is', () => {
    expect(normalizeFieldPath('bar.0.foo.4.baz')).toBe('bar.0.foo.4.baz');
  });

  test('removes a block type starting with a digit, and keeps the case of the next segment', () => {
    expect(normalizeFieldPath('bar.0:3someCase.Foo12.4.baz')).toBe('bar.0.Foo12.4.baz');
  });

  test('removes a block name holding _ or - whole', () => {
    expect(normalizeFieldPath('layout.0:call_to_action.text')).toBe('layout.0.text');
    expect(normalizeFieldPath('a.0:cta-block.b.1:x_y.c')).toBe('a.0.b.1.c');
  });
});

describe('the public string module', () => {
  it('leaves out the doc type name rule, which only rime itself uses', () => {
    expect(util.string).not.toHaveProperty('makeDocTypeName');
  });
});

import { describe, expect, it } from 'vitest';
import { sanitize } from './string.js';

describe('sanitize', () => {
	describe('XSS Prevention', () => {
		it('should remove script tags', () => {
			const malicious = '<script>alert("XSS")</script>Hello';
			const result = sanitize(malicious);
			expect(result).toBe('Hello');
			expect(result).not.toContain('script');
			expect(result).not.toContain('alert');
		});

		it('should remove onclick handlers', () => {
			const malicious = '<div onclick="alert(\'XSS\')">Click me</div>';
			const result = sanitize(malicious);
			expect(result).not.toContain('onclick');
			expect(result).not.toContain('alert');
		});

		it('should remove javascript: URLs', () => {
			const malicious = '<a href="javascript:alert(\'XSS\')">Click</a>';
			const result = sanitize(malicious);
			expect(result).not.toContain('javascript:');
			expect(result).not.toContain('alert');
		});

		it('should remove iframe tags', () => {
			const malicious = '<iframe src="javascript:alert(\'XSS\')"></iframe>';
			const result = sanitize(malicious);
			expect(result).not.toContain('iframe');
			expect(result).not.toContain('javascript:');
		});

		it('should remove object and embed tags', () => {
			const malicious = '<object data="data:text/html,<script>alert(\'XSS\')</script>"></object>';
			const result = sanitize(malicious);
			expect(result).not.toContain('object');
			expect(result).not.toContain('script');
		});

		it('should remove style tags with malicious CSS', () => {
			const malicious = '<style>body { background: url("javascript:alert(\'XSS\')"); }</style>';
			const result = sanitize(malicious);
			expect(result).not.toContain('style');
			expect(result).not.toContain('javascript:');
		});

		it('should remove event handlers (onerror, onload, etc.)', () => {
			const malicious = '<img src="x" onerror="alert(\'XSS\')" onload="alert(\'XSS2\')">';
			const result = sanitize(malicious);
			expect(result).not.toContain('onerror');
			expect(result).not.toContain('onload');
			expect(result).not.toContain('alert');
		});

		it('should handle complex nested XSS attempts', () => {
			const malicious =
				'<div><script>alert("XSS")</script><strong onclick="alert(\'XSS2\')">Bold</strong></div>';
			const result = sanitize(malicious);
			expect(result).toBe('<strong>Bold</strong>');
			expect(result).not.toContain('script');
			expect(result).not.toContain('onclick');
			expect(result).not.toContain('alert');
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
			expect(result).toBe('Line 1<br />Line 2');
		});

		it('should preserve a tags with allowed attributes', () => {
			const input = '<a href="https://example.com" _target="_blank">Link</a>';
			const result = sanitize(input);
			expect(result).toContain('<a href="https://example.com"');
			expect(result).toContain('_target="_blank"');
			expect(result).toContain('Link');
		});

		it('should remove disallowed attributes from a tags', () => {
			const input = '<a href="https://example.com" onclick="alert(\'XSS\')" class="link">Link</a>';
			const result = sanitize(input);
			expect(result).toContain('href="https://example.com"');
			expect(result).not.toContain('onclick');
			expect(result).not.toContain('class');
			expect(result).toContain('Link');
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
		it('should prevent nested script tag bypass', () => {
			const malicious = '<script><script>alert(1)</script>';
			const result = sanitize(malicious);
			expect(result).not.toContain('script');
			expect(result).not.toContain('alert');
		});

		it('should prevent fully nested script tag bypass', () => {
			const malicious = '<script><script>alert(1)</script></script>';
			const result = sanitize(malicious);
			expect(result).not.toContain('script');
			expect(result).not.toContain('alert');
		});

		it('should prevent recursive stripping bypass', () => {
			const malicious = '<scr<script>ipt>alert(1)</script>';
			const result = sanitize(malicious);
			expect(result).not.toContain('script');
		});

		it('should prevent multi-step filter bypass', () => {
			const malicious = '<scr<object>ipt>alert(1)</script>';
			const result = sanitize(malicious);
			expect(result).not.toContain('script');
			expect(result).not.toContain('object');
		});

		it('should prevent alternative event handlers', () => {
			const malicious = '<img src=x onerror=alert(1)>';
			const result = sanitize(malicious);
			expect(result).not.toContain('onerror');
			expect(result).not.toContain('alert');
		});

		it('should prevent data URI XSS', () => {
			const malicious = '<a href="data:text/html,<script>alert(\'XSS\')</script>">Click</a>';
			const result = sanitize(malicious);
			expect(result).not.toContain('data:text/html');
			expect(result).not.toContain('script');
		});

		it('should prevent SVG XSS', () => {
			const malicious = '<svg onload="alert(\'XSS\')"><circle r="10"/></svg>';
			const result = sanitize(malicious);
			expect(result).not.toContain('svg');
			expect(result).not.toContain('onload');
			expect(result).not.toContain('alert');
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
			expect(result).toBe('Content');
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
});

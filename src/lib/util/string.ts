import { Parser } from '@thednp/domparser';
import camelCase from 'camelcase';

let parser: ReturnType<typeof Parser>;

/**
 * Capitalizes the first letter of a string.
 *
 * @example
 * // Returns "Hello"
 * capitalize("hello");
 */
export const capitalize = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1);

/**
 * Converts a string to camelCase.
 * Uses the camelcase package for consistent conversion.
 *
 * @example
 * // Returns "helloWorld"
 * toCamelCase("hello-world");
 */
export const toCamelCase = (str: string): string => camelCase(str);

/**
 * Converts a string to kebab-case.
 * Source : https://github.com/angus-c/just/blob/master/packages/string-kebab-case
 *
 * @example
 * kebabCase('the quick brown fox'); // 'the-quick-brown-fox'
 * kebabCase('the-quick-brown-fox'); // 'the-quick-brown-fox'
 * kebabCase('the_quick_brown_fox'); // 'the-quick-brown-fox'
 * kebabCase('theQuickBrownFox'); // 'the-quick-brown-fox'
 * kebabCase('theQuickBrown Fox'); // 'the-quick-brown-fox'
 * kebabCase('thequickbrownfox'); // 'thequickbrownfox'
 * kebabCase('the - quick * brown# fox'); // 'the-quick-brown-fox'
 * kebabCase('theQUICKBrownFox'); // 'the-quick-brown-fox'
 */
const wordSeparators = /[\s\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-./:;<=>?@[\]^_`{|}~]+/;
const capital_plus_lower = /[A-ZÀ-Ý\u00C0-\u00D6\u00D9-\u00DD][a-zà-ÿ]/g;
const capitals = /[A-ZÀ-Ý\u00C0-\u00D6\u00D9-\u00DD]+/g;

export function toKebabCase(str: string) {
	// replace word starts with space + lower case equivalent for later parsing
	// 1) treat cap + lower as start of new word
	str = str.replace(capital_plus_lower, function (match) {
		// match is one caps followed by one non-cap
		return ' ' + (match[0].toLowerCase() || match[0]) + match[1];
	});
	// 2) treat all remaining capitals as words
	str = str.replace(capitals, function (match) {
		// match is a series of caps
		return ' ' + match.toLowerCase();
	});
	return str.trim().split(wordSeparators).join('-').replace(/^-/, '').replace(/-\s*$/, '');
}

/**
 * Converts a string to PascalCase.
 * Uses the camelcase package with pascalCase option.
 *
 * @example
 * // Returns "HelloWorld"
 * toPascalCase("hello-world");
 */
export const toPascalCase = (str: string): string => camelCase(str, { pascalCase: true });

/**
 * Converts a string to snake_case.
 * This is a custom implementation that replaces the to-snake-case dependency
 * and maintains the same functionality of the original package.
 *
 * @example
 * // Returns "hello_world"
 * toSnakeCase("helloWorld");
 *
 * // Returns "_hello_world"
 * toSnakeCase("_helloWorld");
 */
export const toSnakeCase = (str: string): string => {
	// Preserve leading underscore if present
	const hasLeadingUnderscore = str.startsWith('_');
	if (hasLeadingUnderscore) {
		str = str.slice(1);
	}

	// First convert to space case (similar to to-space-case)
	// Handle special characters and replace with spaces
	let result = str
		// Handle camel case
		.replace(/([a-z\d])([A-Z])/g, '$1 $2')
		// Handle special characters
		.replace(/[^A-Za-z0-9]+/g, ' ')
		// Remove leading and trailing spaces
		.trim()
		.toLowerCase();

	// Convert spaces to underscores (snake_case)
	result = result.replace(/ /g, '_');

	// Restore leading underscore if it was present
	return hasLeadingUnderscore ? `_${result}` : result;
};

/**
 * Converts a string to a URL-friendly slug.
 * Handles special characters, spaces, and Unicode normalization.
 *
 * @example
 * // Returns "hello-world"
 * slugify("Hello World!");
 *
 * // Returns "accentue"
 * slugify("Accentué");
 */
export const slugify = (text: string): string => {
	return text
		.toString() // Cast to string (optional)
		.normalize('NFKD') // The normalize() using NFKD method returns the Unicode Normalization Form of a given string.
		.toLowerCase() // Convert the string to lowercase letters
		.trim() // Remove whitespace from both sides of a string (optional)
		.replace(/\s+/g, '-') // Replace spaces with -
		.replace(/[^\w-]+/g, '') // Remove all non-word chars
		.replace(/--+/g, '-');
};

/**
 * Checks if a string is in camelCase format.
 * Validates that the string starts with a lowercase letter and contains only letters and numbers.
 *
 * @example
 * // Returns true
 * isCamelCase("helloWorld");
 *
 * // Returns false
 * isCamelCase("HelloWorld");
 *
 * // Returns false
 * isCamelCase("hello_world");
 */
export const isCamelCase = (str: string) => /^[a-z][a-zA-Z0-9]*$/.test(str);

/**
 * Validates if a string is a valid slug format.
 * Must start with a letter, contain only letters, numbers, hyphens, and underscores.
 *
 * @example
 * // Returns true
 * isValidSlug("hello-world");
 *
 * // Returns true
 * isValidSlug("user_profile");
 *
 * // Returns false
 * isValidSlug("123invalid");
 *
 * // Returns false
 * isValidSlug("hello world");
 */
export const isValidSlug = (str: string): boolean => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(str);

/**
 * Sanitizes user input by removing dangerous HTML tags while preserving allowed formatting tags,
 * this doesn't encode/decode HTML entities.
 * allowed tags : ['strong', 'b', 'em', 'i', 'u', 'br', 'a']
 */
export const sanitize = (value?: string): string => {
	if (!value) return value || '';
	if (!parser) parser = Parser();

	const decode = (value: string) =>
		value
			.replace(/&amp;/g, '&')
			.replace(/&quot;/g, '"')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&#x27;/g, "'")
			.replace(/&#39;/g, "'")
			.replace(/&#38;/g, '&');

	// Decode multiple levels of encoding on input
	let decodedValue = value;
	while (decodedValue.match(/&amp;|&quot;|&lt;|&gt;|&#x27;|&#39;|&#38;/)) {
		decodedValue = decode(decodedValue);
	}

	const { root } = parser.parseFromString(decodedValue);

	const allowedTags = new Set(['strong', 'b', 'em', 'i', 'u', 'br', 'a']);
	const dangerousTags = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg']);
	const eventHandlers = /^on[a-z]+$/i;
	const dangerousUrls = /^(javascript:|data:text\/html)/i;

	const processNode = (node: any): string => {
		if (!node) return '';

		// Handle text nodes
		if (node.nodeName === '#text') {
			return node.nodeValue || '';
		}

		// Handle comment nodes - remove them
		if (node.nodeName === '#comment') {
			return '';
		}

		// Handle element nodes
		if (node.tagName) {
			const tagName = node.tagName.toLowerCase();

			// Remove dangerous tags entirely (including their content)
			if (dangerousTags.has(tagName)) {
				return '';
			}

			// Process children first
			const childContent = node.children ? node.children.map(processNode).join('') : '';

			// If not an allowed tag, return only the child content (strip the tag)
			if (!allowedTags.has(tagName)) {
				return childContent;
			}

			// For allowed tags, filter attributes
			const safeAttributes: string[] = [];

			if (node.attributes) {
				for (const [key, value] of Object.entries(node.attributes)) {
					const attrName = key.toLowerCase();
					const attrValue = value as string;

					// Remove event handlers
					if (eventHandlers.test(attrName)) {
						continue;
					}

					// For 'a' tags, only allow specific attributes
					if (tagName === 'a') {
						if (attrName === 'href') {
							// Remove dangerous URLs
							if (dangerousUrls.test(attrValue)) {
								continue;
							}
							safeAttributes.push(`${attrName}="${attrValue}"`);
						} else if (attrName === '_target') {
							safeAttributes.push(`${attrName}="${attrValue}"`);
						}
						// Skip all other attributes for 'a' tags
						continue;
					}

					// For other allowed tags, remove dangerous attributes
					if (attrName === 'href' || attrName === 'src') {
						if (dangerousUrls.test(attrValue)) {
							continue;
						}
					}
				}
			}

			// Build the tag
			const attributeString = safeAttributes.length > 0 ? ' ' + safeAttributes.join(' ') : '';

			// Handle self-closing tags
			if (tagName === 'br') {
				return `<${tagName}${attributeString}>`;
			}

			return `<${tagName}${attributeString}>${childContent}</${tagName}>`;
		}

		return '';
	};

	const sanitized = root.children ? root.children.map(processNode).join('') : '';

	return decode(sanitized);
};

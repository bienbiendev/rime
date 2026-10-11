import { Parser } from '@thednp/domparser';
import camelCase from 'camelcase';
import { isSafeUrl } from './url.js';

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
 * Converts a string to camelCase while preserving a trailing _suffix if it exists.
 *
 * @example
 * // Returns "helloWorld"
 * toCamelCasePreserveTrailingUnderscoreSuffix("helloWorld");
 *
 * // Returns "helloWorld_directories"
 * toCamelCasePreserveTrailingUnderscoreSuffix("hello-world_directories");
 *
 * // Returns "helloWorld"
 * toCamelCasePreserveTrailingUnderscoreSuffix("hello-world");
 */
export const toCamelCasePreserveTrailingUnderscoreSuffix = (str: string): string => {
  const suffixMatch = str.match(/(_[a-zA-Z]+)$/);
  const suffix = suffixMatch ? suffixMatch[1] : '';
  const baseString = suffix ? str.slice(0, -suffix.length) : str;

  return camelCase(baseString) + suffix;
};

const wordSeparators = /[\s\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-./:;<=>?@[\]^_`{|}~]+/;
const capital_plus_lower = /[A-ZÀ-Ý\u00C0-\u00D6\u00D9-\u00DD][a-zà-ÿ]/g;
const capitals = /[A-ZÀ-Ý\u00C0-\u00D6\u00D9-\u00DD]+/g;

/**
 * Converts a string to kebab-case.
 * Source : https://github.com/angus-c/just/blob/master/packages/string-kebab-case
 *
 * @example
 * toKebabCase('the quick brown fox'); // 'the-quick-brown-fox'
 * toKebabCase('the-quick-brown-fox'); // 'the-quick-brown-fox'
 * toKebabCase('the_quick_brown_fox'); // 'the-quick-brown-fox'
 * toKebabCase('theQuickBrownFox'); // 'the-quick-brown-fox'
 * toKebabCase('theQuickBrown Fox'); // 'the-quick-brown-fox'
 * toKebabCase('thequickbrownfox'); // 'thequickbrownfox'
 * toKebabCase('the - quick * brown# fox'); // 'the-quick-brown-fox'
 * toKebabCase('theQUICKBrownFox'); // 'the-quick-brown-fox'
 */
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
 * The separator that marks a *segment boundary* inside a rime name, as opposed to a word break.
 *
 * `pages__versions` is two segments; `someSlug` is one segment of two words. Every case
 * conversion has to keep that distinction, because plain `toSnakeCase('someSlug__versions')`
 * yields `some_slug_versions` — which not only loses the marker but collides with the user
 * collection `someSlugVersions`.
 */
export const SEGMENT_SEPARATOR = '__';

/**
 * Applies a case conversion to each segment of a `__`-separated name and rejoins them.
 *
 * This is the rule that lets one canonical slug produce every other representation by pure
 * transform — `$someSlug__versions` → table `some_slug__versions`, url `some-slug--versions` —
 * so nothing outside a feature has to know what `__versions` means.
 *
 * A leading underscore is preserved rather than treated as a separator: `_path` is a field name
 * rime owns, not a segment boundary.
 *
 * @example
 * mapSegments('someSlug__versions', toSnakeCase, '__') // 'some_slug__versions'
 * mapSegments('someSlug__versions', toKebabCase, '--') // 'some-slug--versions'
 * mapSegments('someSlugDirectories', toSnakeCase, '__') // 'some_slug_directories'
 */
export const mapSegments = (
  name: string,
  format: (segment: string) => string,
  join: string
): string => {
  const hasLeadingUnderscore = name.startsWith('_');
  const body = hasLeadingUnderscore ? name.slice(1) : name;
  const converted = body.split(SEGMENT_SEPARATOR).map(format).join(join);
  return hasLeadingUnderscore ? `_${converted}` : converted;
};

/**
 * Converts a string to snake_case.
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
 * Removes every HTML tag except `strong`, `b`, `em`, `i`, `u`, `br` and `a`, and every attribute
 * except the `href` and `target` of a link. Entities in the input are decoded first; a `<` that
 * opens no tag comes out as `&lt;`, other decoded characters come out as they are. The result is
 * HTML, for a site that renders a value with `{@html}`.
 *
 * ```ts
 * sanitize('<b onclick="x()">Hi</b><script>x()</script>') // '<b>Hi</b>'
 * sanitize('1 < 2 &amp; 3') // '1 &lt; 2 & 3'
 * text('bio').$beforeSave(string.sanitize) // a field the site renders with {@html}
 * ```
 */
export const sanitize = (value?: string): string => {
  if (!value) return value || '';
  if (!parser) parser = Parser();

  const WHITESPACE_MARKER = '\uE000';
  const decode = (value: string) =>
    value
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&#38;/g, '&');

  const encodeTextSpace = (html: string): string =>
    html
      .split(/(<[^>]*>)/g)
      .map((segment) =>
        segment.startsWith('<') && segment.endsWith('>')
          ? segment
          : segment.replace(/ /g, WHITESPACE_MARKER)
      )
      .join('');

  const restoreWhitespace = (str: string) => str.replace(new RegExp(WHITESPACE_MARKER, 'g'), ' ');

  /** An attribute value made safe to write between double quotes. */
  const escapeAttribute = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  // Decode multiple levels of encoding on input
  let decodedValue = value;
  while (decodedValue.match(/&amp;|&quot;|&lt;|&gt;|&#x27;|&#39;|&#38;/)) {
    decodedValue = decode(decodedValue);
  }

  // A `<` that opens no tag is text: `1 < 2`, `a<3`. A tag stays as it is, its quoted values
  // included: `<a href="?q=1<2">`
  const tagOrLoneBracket = /<[a-zA-Z/!](?:"[^"]*"|'[^']*'|[^"'>])*>?|<(?![a-zA-Z/!])/g;
  // A U+E000 in the input is dropped: the sanitizer marks the spaces with it
  const escaped = decodedValue
    .replaceAll(WHITESPACE_MARKER, '')
    .replace(tagOrLoneBracket, (match) => (match === '<' ? '&lt;' : match));
  const protectedInput = encodeTextSpace(escaped);

  const { root } = parser.parseFromString(protectedInput);

  const allowedTags = new Set(['strong', 'b', 'em', 'i', 'u', 'br', 'a']);
  const dangerousTags = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg']);
  const eventHandlers = /^on[a-z]+$/i;

  const processNode = (node: any): string => {
    if (!node) return '';

    // Handle text nodes
    if (node.nodeName === '#text') {
      return (node.nodeValue || '').replace(new RegExp(WHITESPACE_MARKER, 'g'), ' ');
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
              if (!isSafeUrl(attrValue)) {
                continue;
              }
              safeAttributes.push(`${attrName}="${escapeAttribute(attrValue)}"`);
            } else if (attrName === 'target') {
              safeAttributes.push(`${attrName}="${escapeAttribute(attrValue)}"`);
            }
            // Skip all other attributes for 'a' tags
            continue;
          }

          // For other allowed tags, remove dangerous attributes
          if (attrName === 'href' || attrName === 'src') {
            if (!isSafeUrl(attrValue)) {
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

  return restoreWhitespace(sanitized);
};

/**
 * The members of a generated type literal, one per line. A container's own type ends with a
 * comma and a leaf's does not, so each is stripped before the join.
 *
 * ```ts
 * joinMemberTypes(['title: string', 'facts: Array<TreeFacts>,']) // 'title: string,\nfacts: Array<TreeFacts>'
 * ```
 */
export const joinMemberTypes = (types: string[]): string =>
  types
    .map((type) => type.trim().replace(/,$/, ''))
    .filter(Boolean)
    .join(',\n');

/**
 * Removes the block type from a field path: everything from a `:` to the next `.`.
 *
 * ```ts
 * normalizeFieldPath('foo.bar.0:content.baz'); // 'foo.bar.0.baz'
 * normalizeFieldPath('layout.0:call_to_action.title'); // 'layout.0.title'
 * ```
 */
export const normalizeFieldPath = (path: string) => path.replace(/:[^.]+/g, '');

/**
 * Whether `path` is `ancestor` itself or lies below it. Not a plain `startsWith`: `sections.1`
 * is no ancestor of `sections.10`, nor `image` of `images`.
 */
export const isWithin = (path: string, ancestor: string) =>
  path === ancestor || path.startsWith(`${ancestor}.`);

/**
 * The path of the blocks or tree row a field path sits in: up to its last index, the field's own
 * name aside. `null` outside any row.
 *
 * ```
 * enclosingRowPath('sections.3.media.image') // 'sections.3'
 * enclosingRowPath('sections.0.items.2.image') // 'sections.0.items.2'
 * enclosingRowPath('hero.thumbnail') // null
 * ```
 */
export const enclosingRowPath = (path: string) => {
  const segments = path.split('.').slice(0, -1);
  for (let i = segments.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(segments[i])) return segments.slice(0, i + 1).join('.');
  }
  return null;
};

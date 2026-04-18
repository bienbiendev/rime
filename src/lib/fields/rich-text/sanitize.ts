import { sanitize } from '$lib/util/string.js';
import type { JSONContent } from '@tiptap/core';

// Helper function to sanitize JSONContent recursively
export const sanitizeJSONContent = (content: JSONContent): any => {
  if (!content) return content;

  // Prevent code mark from being sanitized (preserve original content)
  if (Array.isArray(content.marks) && content.marks.map((m) => m.type).includes('code')) {
    return content;
  }

  // Handle text nodes - sanitize the text content
  if (content.type === 'text' && content.text) {
    return {
      ...content,
      text: sanitize(content.text)
    };
  }

  // Skip sanitization for code blocks (preserve original content)
  if (content.type === 'codeBlock') {
    return content;
  }

  // Recursively handle content array
  if (content.content && Array.isArray(content.content)) {
    return {
      ...content,
      content: content.content.map(sanitizeJSONContent)
    };
  }

  return content;
};

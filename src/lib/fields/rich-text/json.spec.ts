import type { JSONContent } from '@tiptap/core';
import { describe, expect, test } from 'vitest';
import { RichText } from './json.js';

const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
const t = (text: string, marks?: JSONContent['marks']): JSONContent => ({
  type: 'text',
  text,
  marks
});

describe('RichText.toText', () => {
  test('keeps a marked word whole', () => {
    const doc = { type: 'doc', content: [p(t('Re', [{ type: 'bold' }]), t('think'))] };
    expect(RichText.toText(doc)).toBe('Rethink');
  });

  test('puts a space between blocks and skips empty ones', () => {
    const doc = { type: 'doc', content: [p(t('One')), p(), p(t('Two'))] };
    expect(RichText.toText(doc)).toBe('One Two');
  });

  test('reads a hard break as a space', () => {
    const doc = { type: 'doc', content: [p(t('One'), { type: 'hardBreak' }, t('Two'))] };
    expect(RichText.toText(doc)).toBe('One Two');
  });

  test('reads a stored JSON string, and nothing from a document without content', () => {
    expect(RichText.toText(JSON.stringify({ type: 'doc', content: [p(t('Hi'))] }))).toBe('Hi');
    expect(RichText.toText({ type: 'doc' })).toBe('');
  });

  test('a plain string is the text', () => {
    expect(RichText.toText('Hello')).toBe('Hello');
    expect(RichText.toText('42')).toBe('42');
  });
});

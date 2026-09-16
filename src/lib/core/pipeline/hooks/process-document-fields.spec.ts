import { block, blocks, group, text } from '$lib/fields/index.js';
import { expect, test, vi } from 'vitest';
import { processDocumentFields } from './process-document-fields.server.js';

// A default resolves against the request; there is none here.
vi.mock('$app/server', () => ({ getRequestEvent: () => ({}) }));

const read = (fields: unknown[], doc: Record<string, unknown>, user?: unknown) =>
  processDocumentFields({
    doc,
    config: { slug: 'pages', fields },
    event: { locals: { user, rime: { adapter: {} } } },
    context: {},
    operation: 'read'
  } as any);

// A default fills a value the document holds and finds empty; a field the document does not hold
// is not on the config map at all.
test('a field the reader may not see is gone, an empty one with a default is filled in', async () => {
  const fields = [
    text('title'),
    text('secret').access({ read: () => false }),
    text('greeting').defaultValue('hello'),
    group('meta').fields(text('a'))
  ];
  const { doc } = await read(fields, {
    id: '1',
    title: 'T',
    secret: 's',
    greeting: null,
    meta: { a: 'A' }
  });

  expect(doc).toEqual({ id: '1', title: 'T', greeting: 'hello', meta: { a: 'A' } });
});

test('a beforeRead hook sees the value and writes it back, at its path', async () => {
  const fields = [
    group('meta').fields(text('shout').$beforeRead((value) => String(value).toUpperCase()))
  ];
  const { doc } = await read(fields, { id: '1', meta: { shout: 'hi' } });

  expect(doc.meta).toEqual({ shout: 'HI' });
});

test('a residual block is dropped and the rest renumbered', async () => {
  const fields = [blocks('layout', [block('p').fields(text('t'))])];
  const { doc } = await read(fields, {
    id: '1',
    layout: [{ id: 'a', type: 'p', t: 'x', position: 0 }, undefined, { t: 'orphan' }]
  });

  expect(doc.layout).toEqual([{ id: 'a', type: 'p', t: 'x', position: 0 }]);
});

test('the document handed in is not the one handed back', async () => {
  const input = { id: '1', title: 'T' };
  const { doc } = await read([text('title').defaultValue('x')], input);

  expect(doc).not.toBe(input);
  expect(input).toEqual({ id: '1', title: 'T' });
});

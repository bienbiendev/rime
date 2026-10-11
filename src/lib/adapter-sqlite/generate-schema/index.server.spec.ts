import { block, blocks, relation, text } from '#lib/fields/index.js';
import { expect, test, vi } from 'vitest';
import { baseTableName, tableName } from '../naming.server.js';
import generateSchema from './index.server.js';
import { templateFieldRelationColumn, templatePathsTable } from './templates.server.js';
import write from './write.server.js';

vi.mock('./write.server.js', () => ({ default: vi.fn() }));

test('an area with $url gets its paths table, an area without one gets none', async () => {
  await generateSchema({
    collections: [],
    areas: [
      { slug: 'infos', type: 'area', fields: [text('email')], $url: () => '/about' },
      { slug: 'settings', type: 'area', fields: [text('note')] }
    ],
    $tables: []
  } as any);

  const schema = vi.mocked(write).mock.calls[0][0];
  expect(schema).toContain(templatePathsTable(baseTableName('infos')));
  expect(schema).not.toContain(
    tableName({ owner: baseTableName('settings'), child: { kind: 'paths' } })
  );
});

test('two relation fields with the same name and different targets keep both in the junction', async () => {
  vi.mocked(write).mockClear();
  await generateSchema({
    collections: [
      {
        slug: 'news',
        type: 'collection',
        fields: [
          blocks('layout', [
            block('cta').fields(relation('link').to('pages' as never)),
            block('card').fields(relation('link').to('posts' as never))
          ])
        ]
      }
    ],
    areas: [],
    $tables: []
  } as any);

  const schema = vi.mocked(write).mock.calls[0][0];
  expect(schema).toContain(templateFieldRelationColumn('pages'));
  expect(schema).toContain(templateFieldRelationColumn('posts'));
});

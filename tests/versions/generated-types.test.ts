import test, { expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * What `rime:use versions` wrote to `src/app.generated.d.ts`.
 *
 * `medias` declares image sizes and a blocks field: the sizes are typed once, through `sizes`,
 * and the blocks field is typed as on any collection.
 */
test('An upload collection with image sizes keeps its blocks field in the generated type', () => {
  const generated = fs.readFileSync(path.resolve(process.cwd(), 'src/app.generated.d.ts'), 'utf8');
  const medias = generated.slice(generated.indexOf('export type MediasDoc'));
  const mediasDoc = medias.slice(0, medias.indexOf('export type', 1));

  expect(mediasDoc).toContain('sections');
  expect(mediasDoc).toContain('sizes:{');
  expect(generated).toContain('export type BlockCaption');
});

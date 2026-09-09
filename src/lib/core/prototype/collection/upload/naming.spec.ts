import { describe, expect, it } from 'vitest';
import { directoriesOf, withDirectoriesSuffix } from './naming.js';

/**
 * Which directories collection a config's files live under.
 *
 * A folder tree belongs to the document, not to a revision of it, so a config whose rows are the
 * content of another one uses that one's directories. This used to be spelled
 * `withoutVersionsSuffix(slug)` — this feature stripping **versions'** own suffix, the only
 * feature-to-feature import in the registry, and an answer that could only ever be right for the
 * one feature whose convention it knew.
 *
 * `_shadowOf` is core's answer, set by whichever feature derived the shadow. Asserted here against
 * a plain object on purpose: nothing in this file knows that `versions` exists.
 */
describe('directoriesOf', () => {
  it('is a config’s own directories when it shadows nothing', () => {
    expect(directoriesOf({ slug: 'medias' })).toBe('$mediasDirectories');
  });

  it('is the owner’s when the config holds another one’s content', () => {
    expect(directoriesOf({ slug: '$medias__versions', _shadowOf: 'medias' })).toBe(
      '$mediasDirectories'
    );
  });

  it('works for a shadow named by any convention, not just one suffix', () => {
    // The whole point of asking rather than stripping: a second feature declaring a shadow needs
    // no change here, whatever it calls the slug.
    expect(directoriesOf({ slug: 'medias--anything', _shadowOf: 'medias' })).toBe(
      '$mediasDirectories'
    );
  });

  it('strips nothing on its own', () => {
    expect(withDirectoriesSuffix('$medias__versions')).toBe('$$medias__versionsDirectories');
  });
});

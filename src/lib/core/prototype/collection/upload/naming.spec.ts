import { describe, expect, it } from 'vitest';
import { directoriesOf, withDirectoriesSuffix } from './naming.js';

/**
 * Which directories collection a config's files live under.
 *
 * A folder tree belongs to the document, not to a revision of it, so a config whose rows are the
 * content of another one uses that one's directories.
 *
 * `_shadowOf` is the answer, set by whichever feature derived the second table. Asserted against a
 * plain object on purpose: nothing in this file knows that `versions` exists.
 */
describe('directoriesOf', () => {
  it('is a config’s own directories when it version tables nothing', () => {
    expect(directoriesOf({ slug: 'medias' })).toBe('$mediasDirectories');
  });

  it('is the owner’s when the config holds another one’s content', () => {
    expect(directoriesOf({ slug: '$medias__versions', _shadowOf: 'medias' })).toBe(
      '$mediasDirectories'
    );
  });

  it('works for a versions named by any convention, not just one suffix', () => {
    // The whole point of asking rather than stripping: a second feature declaring a versions table needs
    // no change here, whatever it calls the slug.
    expect(directoriesOf({ slug: 'medias--anything', _shadowOf: 'medias' })).toBe(
      '$mediasDirectories'
    );
  });

  it('strips nothing on its own', () => {
    expect(withDirectoriesSuffix('$medias__versions')).toBe('$$medias__versionsDirectories');
  });
});

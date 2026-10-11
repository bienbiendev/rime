import { setDocumentThumbnail } from '#lib/core/prototype/collection/thumbnail/hooks/set-document-thumbnail.server.js';
import { deletePanelLockMetas } from '#lib/core/prototype/shared/metas/hooks/delete-panel-lock-metas.server.js';
import { handleNewVersion } from '#lib/core/prototype/shared/versions/hooks/handle-new-version.server.js';
import { expect, test } from 'vitest';

test('each hook carries its own name, which stack traces and `when` read', () => {
  expect(
    [setDocumentThumbnail, deletePanelLockMetas, handleNewVersion].map((hook) => hook.name)
  ).toEqual(['setDocumentThumbnail', 'deletePanelLockMetas', 'handleNewVersion']);
});

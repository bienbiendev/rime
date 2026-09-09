import { HOOK_MARKS } from '$lib/core/pipeline/marks.js';
import { env } from '$env/dynamic/private';
import { PARAMS } from '$lib/core/constants.js';
import { logger } from '$lib/core/logger.server.js';
import { getValueAtPath } from '$lib/util/object.js';
import validate from '$lib/core/fields/validate.js';
import { Hooks } from '$lib/core/pipeline/hooks.js';

/**
 * Hook to populate _children property on document from a nested collection
 */
export const populateURL = Hooks.beforeRead<'generic'>({
  name: 'populateURL',
  // `title` because `config.$url(document)` below is the author's own function over the whole
  // document, and a slug built from the title is the ordinary case — so the derived title has to
  // be there before it runs. The hand-written pipeline got this from list position; under marks it
  // has to be said, and this is the first thing that requires `title` rather than only providing
  // it. Not `document`: several read hooks both require and provide that, so requiring it here
  // would close a cycle with `setDocumentThumbnail`.
  requires: [HOOK_MARKS.SHAPED, HOOK_MARKS.TITLE],
  provides: [HOOK_MARKS.DOCUMENT],
  run: async (args) => {
    const select =
      args.context.params.select && Array.isArray(args.context.params.select)
        ? args.context.params.select
        : [];
    const HAS_SELECT = select.length > 0;

    // If there is a select param, populate url only if included
    if (HAS_SELECT) return args;

    // Else populate url
    const { config, event, context } = args;
    const locale = context.params.locale;
    const document = args.doc;

    if (config.$url) {
      let url;

      try {
        url = config.$url(document);
      } catch (err: any) {
        logger.error(
          `Error while generating url of ${config.slug} with id: ${args.doc.id}, ${err.message}`
        );
        return args;
      }

      const isValidURL = validate.url(url);
      if (typeof isValidURL === 'string') {
        logger.warn(
          `Invalid URL generated for ${config.slug} with id: ${args.doc.id}, url: ${url}`
        );
        return args;
      }

      const match = url.match(/\[\.\.\.parent\.(\w+(?:\.\w+)*)\]/);

      if (match) {
        const fullMatch = match[0];
        const attributePath = match[1];

        // Create array to store parent attributes
        const attributesArray: string[] = [];

        const MAX_DEPTH = 6;
        let depth = 0;

        let parent = document._parent;

        while (parent && depth < MAX_DEPTH) {
          depth++;

          const docs = await event.locals.rime.collection(config.slug as any).find({
            query: `where[id][equals]=${parent}`,
            select: [attributePath, '_parent'],
            locale
          });

          // Check if there is a result
          if (docs && docs.length > 0) {
            const parentDoc = docs[0];
            const parentAttribute = getValueAtPath(attributePath, parentDoc);

            if (parentAttribute && typeof parentAttribute === 'string') {
              attributesArray.push(parentAttribute);
            } else if (parentAttribute) {
              logger.warn('Bad URL property: not a string', { attributePath, parentAttribute });
            }

            // Move up to the next parent
            parent = parentDoc._parent;
          } else {
            parent = null;
          }
        }

        if (attributesArray.length) {
          // Replace the parent reference with the joined attributes
          url = url.replace(fullMatch, attributesArray.reverse().join('/'));
        } else {
          url = url.replace('/' + fullMatch, '');
        }
      } else {
        // replace "/[...parent.whatever.something.foo]" with ""
        url = url.replace(/\/\[\.\.\.parent\.\w+(?:\.\w+)*\]/, '');
      }

      if (!url) {
        return args;
      }
      if (url.includes('undefined')) {
        logger.warn('Missing document properties to generate URL for : ' + document.id);
        return args;
      }

      // Add the url if successfully generated
      if (url) {
        if (args.doc.url !== url) {
          /**
           * The url is a field on the row the content is on, so this writes it there.
           *
           * The adapter carried a whole `updateDocumentUrl` for this, with a four-way branch over
           * `locale` × `config.versions` and an `OPERATION` enum. None of that was the database
           * layer's: the row is the one this document is showing, and the two tables a localized
           * field lives across are what `updateWhere`'s `locale` already resolves.
           *
           * A shadow is a registered prototype in its own right, so writing to it is the same call
           * to a different handle. `updateWhere` rather than `update` because a url is computed on
           * read: it must not move `updatedAt`.
           */
          const handle = args.event.locals.rime.adapter.prototype(config.slug);
          const contentSlug = handle.shadow?.slug ?? config.slug;
          const contentId = handle.shadow ? args.doc.contentId : args.doc.id;

          if (contentId) {
            args.event.locals.rime.adapter.prototype(contentSlug).updateWhere({
              query: { where: { id: { equals: contentId } } },
              data: { url },
              locale
            });
          }
        }
        args.doc = { ...args.doc, url };
      }

      // Add the live url if needed. Gated on isStaff, not mere session presence — this URL
      // embeds the real, hideable RIME_PANEL_ROUTE segment, so it must not reach a non-staff
      // authenticated session either.
      if (config.live && event.locals.user?.isStaff && url) {
        args.doc._live = `${process.env.PUBLIC_RIME_URL}/${env.RIME_PANEL_ROUTE || 'panel'}/live-edit?src=${url}&slug=${config.slug}&id=${args.doc.id}`;
        args.doc._live += args.doc.contentId ? `&${PARAMS.VERSION_ID}=${args.doc.contentId}` : '';
        args.doc._live += locale ? `&${PARAMS.LOCALE}=${locale}` : '';
      }
    }

    return args;
  }
});

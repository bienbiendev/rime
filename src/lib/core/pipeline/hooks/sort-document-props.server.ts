import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { isObjectLiteral } from '#lib/util/object.js';
import type { Dic } from '#lib/util/types.js';

/**
 * Sorts every key of the document, at every depth, so a response is stable to diff.
 *
 * The finaliser: `buildPipeline` appends it after the consumer's own hooks, so nothing can run
 * after it and unsort what it just sorted.
 */
export const sortDocumentProps = Hooks.beforeRead<'generic'>(
  async function sortDocumentProps(args) {
    return { ...args, doc: sortDocumentKeys(args.doc) };
  }
);

/**
 * The document with its keys sorted at every depth: `id`, `title`, `status` first, the
 * bookkeeping keys (`locale` … `_thumbnail`) last in that order, the rest alphabetical.
 */
function sortDocumentKeys<T extends Dic>(obj: T): T {
  const specificOrder = ['id', 'title', 'status'];
  const endOrder = [
    'locale',
    'path',
    'position',
    'ownerId',
    'createdBy',
    'createdAt',
    'updatedBy',
    'updatedAt',
    '_type',
    '_prototype',
    '_live',
    '_children',
    '_path',
    '_parent',
    '_position',
    '_thumbnail'
  ];

  function sortObjectKeys(obj: Dic): Dic {
    if (!obj || typeof obj !== 'object') return obj;

    // A list: each list or plain object in it is sorted, anything else (a Date) kept as it is
    if (Array.isArray(obj)) {
      return obj.map((item) =>
        Array.isArray(item) || isObjectLiteral(item) ? sortObjectKeys(item) : item
      );
    }

    const keys = Object.keys(obj).sort((a, b) => {
      const aIndexSpecific = specificOrder.indexOf(a);
      const bIndexSpecific = specificOrder.indexOf(b);
      const aIndexEnd = endOrder.indexOf(a);
      const bIndexEnd = endOrder.indexOf(b);

      if (aIndexSpecific !== -1 && bIndexSpecific !== -1) {
        return aIndexSpecific - bIndexSpecific;
      }
      if (aIndexEnd !== -1 && bIndexEnd !== -1) {
        return aIndexEnd - bIndexEnd;
      }
      if (aIndexSpecific !== -1) return -1;
      if (bIndexSpecific !== -1) return 1;
      if (aIndexEnd !== -1) return 1;
      if (bIndexEnd !== -1) return -1;
      return a.localeCompare(b);
    });

    const sorted: Dic = {};
    keys.forEach((key) => {
      const shouldOrder = Array.isArray(obj[key]) || isObjectLiteral(obj[key]);
      sorted[key] = shouldOrder ? sortObjectKeys(obj[key]) : obj[key];
    });

    return sorted;
  }

  return sortObjectKeys(obj) as T;
}

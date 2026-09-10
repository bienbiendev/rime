import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { isObjectLiteral } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';

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

function sortDocumentKeys<T extends Dic>(obj: T): T {
  const specificOrder = ['id', 'title', 'status'];
  const endOrder = [
    'locale',
    'path',
    'position',
    'ownerId',
    'createdBy',
    'lastEditedBy',
    'createdAt',
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
    // If not an object or is null, return the value as-is
    if (!obj || typeof obj !== 'object') return obj;

    // If array, process each object in the array
    if (Array.isArray(obj)) {
      return obj.map((item) => (typeof item === 'object' ? sortObjectKeys(item) : item));
    }

    // Sort the keys
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

    // Create new object with sorted keys
    const sorted: Dic = {};
    keys.forEach((key) => {
      const shouldOrder = Array.isArray(obj[key]) || isObjectLiteral(obj[key]);
      sorted[key] = shouldOrder ? sortObjectKeys(obj[key]) : obj[key];
    });

    return sorted;
  }

  return sortObjectKeys(obj) as T;
}

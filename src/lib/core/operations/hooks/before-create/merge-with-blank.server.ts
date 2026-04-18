import { isUploadConfig } from '$lib/core/collections/upload/util/config.js';
import { createBlankDocument } from '$lib/util/doc.js';
import deepmerge from 'deepmerge';
import { Hooks } from '../index.server.js';

export const mergeWithBlankDocument = Hooks.beforeCreate(async (args) => {
  const { config } = args;
  const data = args.data;

  let file;
  if (config.type === 'collection' && isUploadConfig(config) && 'file' in data) {
    file = data.file;
    delete data.file;
  }

  const dataMergedWithBlankDocument = deepmerge(createBlankDocument(config, args.event), data, {
    arrayMerge: (_, y) => y
  });

  // Add file after merge
  if (file) {
    (dataMergedWithBlankDocument as any).file = file;
  }

  return {
    ...args,
    data: dataMergedWithBlankDocument
  };
});

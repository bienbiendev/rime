import type { BuiltCollection, Config } from '$lib/core/factory/config/types.js';
import { getStaffCollection } from './derive.js';
import { Collection } from '../../../factory/config/index.server.js';

export const augmentStaffServer = <
  const T extends { collections?: BuiltCollection[]; staff?: Config['staff'] }
>(
  config: T
) => {
  const staff = Collection.create('staff', getStaffCollection(config.staff));
  return { ...config, collections: [...(config.collections || []), staff] } as const;
};

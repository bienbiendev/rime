import type { BuiltCollection, Config } from '$lib/core/factory/config/types.js';
import { getStaffCollection } from './derive.js';
import { Collection } from '../../../factory/config/index.js';

export const augmentStaff = <
  T extends { collections?: BuiltCollection[]; staff?: Config['staff'] }
>(
  config: T
) => {
  const staff = Collection.create('staff', getStaffCollection(config.staff));
  return { ...config, collections: [staff, ...(config.collections || [])] } as const;
};

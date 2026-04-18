import type { BuiltCollection, Config } from '$lib/core/config/types.js';
import { getStaffCollection } from '../shared/get-staff-collection.js';
import { Collection } from './index.server.js';

export const augmentStaffServer = <
  const T extends { collections?: BuiltCollection[]; staff?: Config['staff'] }
>(
  config: T
) => {
  const staff = Collection.create('staff', getStaffCollection(config.staff));
  return { ...config, collections: [staff, ...(config.collections || [])] } as const;
};

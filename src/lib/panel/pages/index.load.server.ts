import area from './area/load.server.js';
import { collectionLoad } from './collection/load.server.js';
import { docLoad } from './collection-document/load.server.js';
import { liveLoad as live } from './live/load.server.js';
import { dashboardLoad as dashboard } from './dashboard/load.server.js';

const collection = {
  list: collectionLoad,
  doc: docLoad
};

export { area, collection, dashboard, live };

export default {
  area,
  collection,
  dashboard,
  live
};

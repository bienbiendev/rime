import area from './area/actions.server.js';
import collectionDoc from './collection-document/actions.server.js';

const collection = {
  doc: collectionDoc
};

export { area, collection };

export default {
  area,
  collection
};

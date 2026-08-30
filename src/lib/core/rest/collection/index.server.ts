import { restCreate } from './create.server.js';
import { restDelete } from './delete.server.js';
import { restDeleteById } from './delete-by-id.server.js';
import { restDuplicate } from './duplicate.server.js';
import { restGet } from './get.server.js';
import { restGetById } from './get-by-id.server.js';
import { restUpdateById } from './update-by-id.server.js';

export const rest = {
  get: restGet,
  getById: restGetById,
  deleteById: restDeleteById,
  delete: restDelete,
  create: restCreate,
  updateById: restUpdateById,
  duplicate: restDuplicate
};

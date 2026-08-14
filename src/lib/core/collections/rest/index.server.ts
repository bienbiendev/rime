import { restCreate } from './create.server.js';
import { restDelete } from './delete.server.js';
import { restDeleteById } from './deleteById.server.js';
import { restDuplicate } from './duplicate.server.js';
import { restGet } from './get.server.js';
import { restGetById } from './getById.server.js';
import { restUpdateById } from './updateById.server.js';

export const rest = {
  get: restGet,
  getById: restGetById,
  deleteById: restDeleteById,
  delete: restDelete,
  create: restCreate,
  updateById: restUpdateById,
  duplicate: restDuplicate
};

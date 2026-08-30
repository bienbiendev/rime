import type { Operation } from '$lib/core/operations/types.js';
import type { PrototypeSlug } from '../../../types.js';

export type ContentUpdatePayload = {
  documentType: PrototypeSlug;
  id: string;
  operation: Omit<Operation, 'read'>;
  timestamp: string;
};

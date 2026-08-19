import { getFieldPrivateModule } from '../index.server.js';
import type { GroupFieldBuilder } from './index.js';

export async function toType(group: GroupFieldBuilder) {
  const fieldsTypes: string[] = [];
  for (const field of group.get.fields) {
    const fieldServerMethods = await getFieldPrivateModule(field);
    if (fieldServerMethods) {
      const result = await Promise.resolve(fieldServerMethods.toType(field));
      fieldsTypes.push(result);
    }
  }
  return group.get.fields.length ? `${group.name}: {${fieldsTypes.join(',\n\t')}}` : '';
}

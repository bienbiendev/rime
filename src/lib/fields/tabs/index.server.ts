import { getFieldPrivateModule, type ToType } from '../index.server.js';
import type { TabsBuilder } from './index.js';

export const toType: ToType<TabsBuilder> = async (field) => {
  const types: string[] = [];
  for (const tab of field.raw.tabs) {
    const fieldsTypes: string[] = [];
    for (const field of tab.raw.fields) {
      const fieldServerMethods = await getFieldPrivateModule(field);
      if (fieldServerMethods) {
        const result = await Promise.resolve(fieldServerMethods.toType(field));
        fieldsTypes.push(result);
      }
    }
    if (fieldsTypes.length) {
      types.push(`${tab.raw.name}: {${fieldsTypes.join(',\n\t\t')}}`);
    }
  }
  return types.length ? types.join(',\n\t').replaceAll(',,', ',') : '';
};

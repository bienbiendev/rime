import { toggle } from '$lib/fields/index.js';
import { Area } from '$rime/config';

export const Settings = Area.create('settings', {
  fields: [toggle('maintenance').label('Maintenance')]
});

import { adapterSqlite } from '$lib/adapter-sqlite/index.server';
import { rime } from '$rime/config';

export default rime({
  $adapter: adapterSqlite('empty.sqlite')
});

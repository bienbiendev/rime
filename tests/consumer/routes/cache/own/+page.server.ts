import type { PageServerLoad } from './$types';

// A page that sets its own cache-control: the cache plugin leaves it as it is
export const load: PageServerLoad = ({ setHeaders }) => {
  setHeaders({ 'cache-control': 'max-age=60' });
};

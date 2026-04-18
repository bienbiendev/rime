import { env } from '$env/dynamic/public';

/**
 * Build the api full url for given segments
 * @example
 * apiUrl('some-collection') // -> http://localhost:5713/api/some-collection
 * apiUrl('some-collection', '12345') // -> http://localhost:5713/api/some-collection/12345
 */
export function apiUrl(...args: string[]) {
  return `${env.PUBLIC_RIME_URL}/api/${args.join('/')}`;
}

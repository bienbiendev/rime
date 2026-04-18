import { env } from '$env/dynamic/public';

/**
 * Build a panel url for given segments
 * @example
 * panelUrl('some-collection') // -> http://localhost:5713/panel/some-collection
 */
export function panelUrl(...args: string[]) {
  return `${env.PUBLIC_RIME_URL}/panel/${args.join('/')}`;
}

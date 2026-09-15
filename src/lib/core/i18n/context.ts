import { getContext, setContext } from 'svelte';
import type { I18n } from './index.js';

const KEY = 'rime:i18n';

/** Puts a translator in Svelte context, for `getI18nContext` in every component below. */
export const setI18nContext = (i18n: I18n): I18n => setContext(KEY, i18n);

/** The translator the nearest `setI18nContext` above put in context. */
export const getI18nContext = (): I18n => getContext<I18n>(KEY);

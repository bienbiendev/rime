import { getContext, setContext } from 'svelte';
import { getConfigContext } from './config.svelte.js';

export const LOCALE_CTX = Symbol('rime.locale');

function createStore(initial?: string) {
  let code = $state<string>();
  let label = $state<string>();

  const config = getConfigContext();

  const setValue = (value?: string) => {
    if (config && config.raw.localization && value) {
      code = value;
      label = config.raw.localization.locales.find((l) => l.code === code)?.label;
    }
  };

  setValue(initial);

  /** A date in the panel language: `Saturday, Oct 3, 2026`, `samedi 3 oct. 2026`. */
  const dateFormat = (
    date: Date | string,
    args: { short?: boolean; withTime?: boolean } = { short: false, withTime: false }
  ) => {
    const { short, withTime } = args;
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    if (!short) options.weekday = 'long';
    if (withTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.hour12 = false;
    }
    return new Date(date).toLocaleDateString(config?.raw.panel.language, options);
  };

  return {
    dateFormat,
    get defaultCode() {
      return config.raw.localization?.default;
    },
    get code() {
      return code;
    },
    get label() {
      return label;
    },
    set code(v: string | undefined) {
      setValue(v);
    }
  };
}

export function setLocaleContext(initial?: string) {
  const store = createStore(initial);
  return setContext(LOCALE_CTX, store);
}

export function getLocaleContext() {
  return getContext<ReturnType<typeof setLocaleContext>>(LOCALE_CTX);
}

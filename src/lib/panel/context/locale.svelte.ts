import { getContext, setContext } from 'svelte';
import { getConfigContext } from './config.svelte.js';

const LOCALE_KEY = Symbol('rime.locale');

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

	const dateFormat = (
		date: Date | string,
		args: { short?: boolean; withTime?: boolean } = { short: false, withTime: false }
	) => {
		const { short, withTime } = args;

		if (typeof date === 'string') {
			date = new Date(date);
		}

		const options: Intl.DateTimeFormatOptions = {
			weekday: 'long',
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		};
		if (short) delete options.weekday;
		if (withTime) {
			options.hour = '2-digit';
			options.minute = '2-digit';
			options.second = undefined;
			options.hour12 = false; // Use 24-hour format
		}
		if (code) {
			return date.toLocaleDateString(code, options);
		} else {
			return date.toLocaleDateString('en', options);
		}
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
	return setContext(LOCALE_KEY, store);
}

export function getLocaleContext() {
	return getContext<ReturnType<typeof setLocaleContext>>(LOCALE_KEY);
}

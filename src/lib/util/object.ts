import type { Dic, WithRequired } from '$lib/util/types.js';
import { normalizeFieldPath } from './doc.js';

/**
 * Creates a new object with only the specified keys from the original object.
 *
 * @example
 * // Returns { name: 'John', age: 30 }
 * pick(['name', 'age'], { name: 'John', age: 30, email: 'john@example.com' });
 */
export const pick = <T extends object, K extends keyof T>(keys: K[], obj: T): Pick<T, K> => {
	const res: Partial<T> = {};
	for (const key of keys) {
		if (key in obj) {
			res[key] = obj[key];
		}
	}
	return res as Pick<T, K>;
};

/**
 * Creates a new object without the specified keys from the original object.
 *
 * @example
 * // Returns { email: 'john@example.com' }
 * omit(['name', 'age'], { name: 'John', age: 30, email: 'john@example.com' });
 */
export const omit = <T extends object, K extends keyof T>(keys: K[], obj: T): Omit<T, K> => {
	const res: Partial<T> = { ...obj };
	for (const key of keys) {
		delete res[key];
	}
	return res as Omit<T, K>;
};

/**
 * Creates a new object with all non-null properties from the original object.
 *
 * @example
 * // Returns { name: 'John', email: 'john@example.com' }
 * withoutNull({ name: 'John', age: null, email: 'john@example.com' });
 */
export const withoutNull = <T extends object, K extends keyof T>(obj: T): Partial<T> => {
	const res: Partial<T> = {};
	for (const key of Object.keys(obj) as K[]) {
		if (obj[key] !== null) {
			res[key] = obj[key];
		}
	}
	return res;
};

/**
 * Creates a new object without the 'id' property from the original object.
 * Specialized version of omit for the common case of removing IDs.
 *
 * @example
 * // Returns { name: 'John', age: 30 }
 * omitId({ id: '123', name: 'John', age: 30 });
 */
export const omitId = <T extends { id?: string; [k: string]: any }>(obj: T): Omit<T, 'id'> =>
	omit(['id'], obj) as Omit<T, 'id'>;

/**
 * Type guard to check if an object has all the specified properties.
 *
 * @example
 * // Returns true if user has both name and email properties
 * if (hasProps(['name', 'email'], user)) {
 *   // TypeScript knows user.name and user.email are defined
 *   console.log(`${user.name}: ${user.email}`);
 * }
 */
export function hasProps<T extends object, U extends Array<keyof T>>(
	props: U,
	obj: T
): obj is WithRequired<T, U[number]> {
	return props.every((prop) => obj[prop] !== undefined);
}

/**
 * Type guard to check if an object has a specific property.
 *
 * @example
 * // Returns true if user has an email property
 * if (hasProp('email', user)) {
 *   // TypeScript knows user.email is defined
 *   sendEmail(user.email);
 * }
 */
export function hasProp<T extends object, U extends keyof T>(
	prop: U,
	obj: T
): obj is T & Required<Pick<T, U>> {
	return obj[prop] !== undefined;
}

/**
 * Checks if a value is a Buffer object.
 *
 * @example
 * // Returns true for Buffer objects
 * isBuffer(Buffer.from('test'));
 */
export function isBuffer(obj: any) {
	return (
		obj &&
		obj.constructor &&
		typeof obj.constructor.isBuffer === 'function' &&
		obj.constructor.isBuffer(obj)
	);
}

/**
 * Checks if a value is a plain object literal (not an array, null, or a class instance).
 *
 * @example
 * // Returns true
 * isObjectLiteral({ a: 1, b: 2 });
 *
 * // Returns false
 * isObjectLiteral([1, 2, 3]);
 * isObjectLiteral(null);
 * isObjectLiteral(new Date());
 */
export function isObjectLiteral(object: any): object is Dic {
	return (
		typeof object === 'object' &&
		object !== null &&
		!Array.isArray(object) &&
		Object.getPrototypeOf(object) === Object.prototype
	);
}

/**
 * Options for the flattenWithGuard function
 */
type FlattenWithGuardOptions = {
	/** Maximum depth to flatten (undefined for unlimited) */
	maxDepth?: number;
	/** Whether to preserve arrays (true) or flatten them (false) */
	safe?: boolean;
	/** Function to determine if a key-value pair should be flattened */
	shouldFlat?: ([key, value]: [string, any]) => boolean;
};
type FlattenWithGuard = (data: Dic, opts?: FlattenWithGuardOptions) => Dic;

/**
 * Flattens a nested object structure into a single-level object with dot notation keys.
 * Provides options to control the flattening behavior.
 *
 * @example
 * // Basic usage - returns { "user.name": "John", "user.address.city": "New York" }
 * flattenWithGuard({ user: { name: "John", address: { city: "New York" } } });
 *
 * // With maxDepth=1 - returns { "user.name": "John", "user.address": { city: "New York" } }
 * flattenWithGuard({ user: { name: "John", address: { city: "New York" } } }, { maxDepth: 1 });
 *
 * // With shouldFlat - only flatten properties that aren't "address"
 * // Returns { "user.name": "John", "user.address": { city: "New York" } }
 * flattenWithGuard(
 *   { user: { name: "John", address: { city: "New York" } } },
 *   { shouldFlat: ([key]) => key !== "address" }
 * );
 */
export const flattenWithGuard: FlattenWithGuard = (data, opts) => {
	opts = opts || {};

	const delimiter = '.';
	const shouldFlat = opts.shouldFlat || (() => true);
	const maxDepth = opts.maxDepth;
	const output: Dic = {};
	const safe = opts.safe || false;

	function step(object: Dic, prev?: string, currentDepth?: number) {
		currentDepth = currentDepth || 1;
		Object.keys(object).forEach(function (key) {
			const value = object[key];
			const isarray = safe && Array.isArray(value);
			const type = Object.prototype.toString.call(value);
			const isbuffer = isBuffer(value);
			const isobject = type === '[object Object]' || type === '[object Array]';

			const newKey = prev ? prev + delimiter + key : key;

			if (
				shouldFlat([key, value]) &&
				!isarray &&
				!isbuffer &&
				isobject &&
				Object.keys(value).length &&
				(!maxDepth || currentDepth < maxDepth)
			) {
				return step(value, newKey, currentDepth + 1);
			}

			output[newKey] = value;
		});
	}

	step(data);

	return output;
};

/**
 * Gets a value from a nested object using a dot notation path.
 *
 * @example
 * // Returns "New York"
 * getValueAtPath('user.address.city', { user: { address: { city: "New York" } } });
 *
 * // Returns undefined
 * getValueAtPath('user.phone', { user: { address: { city: "New York" } } });
 */
export const getValueAtPath = <T>(path: string, obj: Dic): T | undefined => {
	path = normalizeFieldPath(path);
	const parts = path.split('.');
	let current = obj;
	for (const part of parts) {
		if (/^d+$/.test(part)) {
			current = current[parseInt(part)];
		} else {
			current = current[part];
		}
		if (current === undefined) {
			return undefined;
		}
	}
	return current as T;
};

/**
 * Sets a value in a nested object using a dot notation path.
 * Creates the path if it doesn't exist and returns a new object without modifying the original.
 *
 * @example
 * // Returns { user: { address: { city: "Boston" } } }
 * setValueAtPath('user.address.city', { user: { address: { city: "New York" } } }, 'Boston');
 *
 * // Creates missing path and returns { user: { phone: "555-1234" } }
 * setValueAtPath('user.phone', { user: {} }, '555-1234');
 */
export const setValueAtPath = <T extends Dic>(path: string, obj: T, value: unknown): T => {
	path = normalizeFieldPath(path);
	const parts = path.split('.');

	// Create a shallow copy of the root object
	const result = { ...obj };

	let current: any = result;
	let previous = null;
	let previousKey: string | number = '';

	// Navigate to the parent of the target property
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		const index = /^\d+$/.test(part) ? parseInt(part) : part;

		previous = current;
		previousKey = index;

		// Create the object path if it doesn't exist
		if (!current[index]) {
			// If the next part is a number, create an array, otherwise create an object
			const nextPart = parts[i + 1];
			const isNextPartNumeric = /^\d+$/.test(nextPart);
			current[index] = isNextPartNumeric ? [] : {};
		}

		// Create a shallow copy of the current level before moving deeper
		if (Array.isArray(current[index])) {
			current[index] = [...current[index]];
		} else if (typeof current[index] === 'object' && current[index] !== null) {
			current[index] = { ...current[index] };
		}

		current = current[index];
	}

	// Set the value at the final path segment
	const lastPart = parts[parts.length - 1];
	const lastIndex = /^\d+$/.test(lastPart) ? parseInt(lastPart) : lastPart;

	if (previous !== null) {
		if (Array.isArray(previous[previousKey])) {
			previous[previousKey][lastIndex] = value;
		} else if (typeof previous[previousKey] === 'object' && previous[previousKey] !== null) {
			previous[previousKey][lastIndex] = value;
		}
	} else {
		// Use a type assertion only for the assignment
		(result as any)[lastIndex] = value;
	}

	return result;
};

/**
 * Deletes a value at a specified path in an object.
 *
 * @example
 * // Returns { user: { name: "John" } }
 * deleteValueAtPath({ user: { name: "John", age: 30 } }, 'user.age');
 */
export function deleteValueAtPath<T>(obj: T, path: string): T {
	path = normalizeFieldPath(path);
	const parts = path.split('.');
	const last = parts.pop()!;

	let current: any = obj;
	for (const part of parts) {
		const key = !isNaN(Number(part)) ? Number(part) : part;
		if (!(key in current)) return obj;
		current = current[key];
	}

	const finalKey = !isNaN(Number(last)) ? Number(last) : last;
	delete current[finalKey];
	return obj;
}

/**
 * Check whether two object have the same structure
 */
export function matchStructure(source?: Dic, target?: Dic): boolean {
	if (!source || !target) return false;
	const sourceKeys = Object.keys(source);
	const targetKeys = Object.keys(target);

	if (sourceKeys.length !== targetKeys.length) {
		return false;
	}

	const sourceSet = new Set(sourceKeys);
	return targetKeys.every((key) => sourceSet.has(key));
}

/**
 * Recursively removes keys from any object or nested structure
 *
 * @example
 *
 * const cleaned = recursiveRemoveKeys('dishes', 'dirt').from(kitchen)
 */
export function recursiveRemoveKeys<K extends string>(...keys: K[]) {
	function removeIn<T>(obj: T): RemoveKeysDeep<T, K> {
		if (obj === null || obj === undefined) {
			return obj as RemoveKeysDeep<T, K>;
		}

		if (Array.isArray(obj)) {
			return obj.map((item) => removeIn(item)) as RemoveKeysDeep<T, K>;
		}

		if (isObjectLiteral(obj)) {
			const result: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(obj)) {
				if (!keys.includes(key as K)) {
					result[key] = removeIn(value);
				}
			}
			return result as RemoveKeysDeep<T, K>;
		}

		return obj as RemoveKeysDeep<T, K>;
	}

	return {
		from: removeIn
	};
}

// Helper type for deep key removal
type RemoveKeysDeep<T, K extends string> = T extends (infer U)[]
	? RemoveKeysDeep<U, K>[]
	: T extends object
		? {
				[P in keyof T as P extends K ? never : P]: RemoveKeysDeep<T[P], K>;
			}
		: T;

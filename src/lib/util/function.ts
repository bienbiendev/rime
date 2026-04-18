/**
 * Safely executes a promise and returns a tuple containing either an error or the result.
 * This utility helps with error handling without try/catch blocks throughout the codebase.
 *
 * @example
 * // Using safe to handle API calls without try/catch
 * const [error, data] = await trycatch(() => fetchData());
 * if (error) {
 *   // Handle error case
 *   console.error(error);
 * } else {
 *   // Process data
 *   processData(data);
 * }
 */
export const trycatch = async <T>(
  promiseOrFn: Promise<T> | (() => Promise<T>)
): Promise<[Error, never] | [never, T]> => {
  try {
    // If it's a function, execute it inside the try/catch
    const promise = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
    const result = await promise;
    return [null, result] as [never, T];
  } catch (error) {
    return [error as Error, null] as [Error, never];
  }
};

/**
 * Safely executes a synchronous function and returns a tuple containing either an error or the result.
 * This utility helps with error handling without try/catch blocks throughout the codebase.
 *
 * @example
 * // Using trycatchSync to handle synchronous operations without try/catch
 * const [error, data] = trycatchSync(() => JSON.parse(jsonString));
 * if (error) {
 *   // Handle error case
 *   console.error(error);
 * } else {
 *   // Process data
 *   processData(data);
 * }
 */
export const trycatchSync = <T>(fn: () => T): [Error, never] | [never, T] => {
  try {
    const result = fn();
    return [null, result] as [never, T];
  } catch (error) {
    return [error as Error, null] as [Error, never];
  }
};

/**
 * Safely executes a fetch request and treats both network errors and HTTP error status codes as errors.
 * Returns a tuple containing either an error or the successful response.
 *
 * @example
 * // Using trycatchFetch to handle both network and HTTP errors
 * const [error, response] = await trycatchFetch('/api/data');
 * if (error) {
 *   // Handle both network and HTTP errors
 *   return console.error(error);
 * }
 *
 * // Process successful response
 * const data = await response.json();
 *
 */
export const trycatchFetch = async (
  input: string | URL | globalThis.Request,
  init?: RequestInit
): Promise<[Error, never] | [never, Response]> => {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      // Try to get error details from response if possible
      try {
        const errorData = await response.json();
        const errorMessage = errorData.message || `HTTP error! Status: ${response.status}`;
        return [new Error(errorMessage), null] as [Error, never];
      } catch {
        // If we can't parse the response as JSON, use a generic error message
        return [new Error(`HTTP error! Status: ${response.status}`), null] as [Error, never];
      }
    }

    return [null, response] as [never, Response];
  } catch (error) {
    return [error as Error, null] as [Error, never];
  }
};

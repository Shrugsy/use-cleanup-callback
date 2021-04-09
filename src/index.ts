import { useCallback, useEffect, DependencyList, useRef } from 'react';

/**
 * A standard cleanup
 */
export type Cleanup = void | (() => void | undefined);

/**
 * An object notation cleanup used when a return value is required from the callback returned
 * by `useCleanupCallback`
 */
export type ReturnObject<V> = {
  value: V;
  cleanup: Cleanup;
};

/**
 * An input/output callback that returns a standard cleanup
 */
export type CleanupCallback<T extends unknown[]> = (...args: T) => Cleanup;

/**
 * An input callback that returns an object notation cleanup
 */
export type CleanupCallbackWithReturn<T extends unknown[], V> = (...args: T) => ReturnObject<V>;

/**
 * Additional `useCleanupCallback` options
 */
export type Options = {
  cleanUpOnCall?: boolean;
  cleanUpOnDepsChange?: boolean;
  cleanUpOnUnmount?: boolean;
};

/**
 * The output callback returned from `useCleanupCallback` when an object notation cleanup is used.
 * Provides a callback that itself returns the desired value.
 */
export type ReturnedCleanupCallbackWithReturn<T extends unknown[], V> = (...args: T) => V;

/**
 * Handles calling a cleanup if it hasn't been called, and is a function
 */
function handleCleanupObj(cleanupObj: { cleanup: unknown; isCalled: boolean }): void {
  const { cleanup, isCalled } = cleanupObj;
  if (!isCalled && typeof cleanup === 'function') {
    // mark it as called
    cleanupObj.isCalled = true;
    // call the cleanup function
    cleanup();
  }
}

/**
 * `useCleanupCallback` acts as a hybrid between `useCallback` and `useEffect`.
 * When the provided callback returns it's own cleanup callback, that cleanup will be
 * executed when the function is called again, and/or when the component un-mounts.
 * @param callback - Callback to be memoized. Supports returning a 'cleanup' callback.
 * @param deps - Dependency array for the associated callback.
 */

/* overload 1 - no cleanup, or standard cleanup
  e.g.
  useCleanupCallback(() => {
    // some code
    return;
  }, []);

  e.g.
  useCleanupCallback(() => {
    // some code
    return () => {
      // do cleanup
    };
  }, []);
*/
function useCleanupCallback<T extends unknown[]>(
  callback: CleanupCallback<T>,
  deps: DependencyList,
  options?: Options
): CleanupCallback<T>;

/* overload 2 - object return notation (return value & cleanup)
  e.g.
  useCleanupCallback(() => {
    // some code
    return {
      value: 'foo',
      cleanup: () =>{ 
        // do cleanup
      }
    }
  }, [])
*/
function useCleanupCallback<T extends unknown[], V>(
  callback: CleanupCallbackWithReturn<T, V>,
  deps: DependencyList,
  options?: Options
): ReturnedCleanupCallbackWithReturn<T, V>;

/* overload 3 - Union of overloads 1 & 2 */
function useCleanupCallback<T extends unknown[], V>(
  callback: CleanupCallback<T> | CleanupCallbackWithReturn<T, V>,
  deps: DependencyList,
  options?: Options
): CleanupCallback<T> | ReturnedCleanupCallbackWithReturn<T, V>;

/* implementation signature */
function useCleanupCallback<T extends unknown[], V>(
  callback: CleanupCallback<T> | CleanupCallbackWithReturn<T, V>,
  deps: DependencyList,
  { cleanUpOnCall = true, cleanUpOnDepsChange = false, cleanUpOnUnmount = true }: Options = {}
) {
  const cleanupRef = useRef<{ cleanup: Cleanup | null; isCalled: boolean }>({
    cleanup: null,
    isCalled: false,
  });

  // re-construct options & keep stored in a ref to cheat through useEffect deps
  const options = { cleanUpOnCall, cleanUpOnDepsChange, cleanUpOnUnmount };
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    return () => {
      if (optionsRef.current.cleanUpOnDepsChange) {
        handleCleanupObj(cleanupRef.current);
      }
    };
  }, [deps]);

  useEffect(() => {
    return () => {
      if (optionsRef.current.cleanUpOnUnmount) {
        // clean up last call if applicable
        handleCleanupObj(cleanupRef.current);
      }
    };
  }, []);

  const outputCallback = useCallback((...args: T) => {
    // clean up previous call if applicable
    if (optionsRef.current.cleanUpOnCall) {
      handleCleanupObj(cleanupRef.current);
    }

    const returnValue = callback(...args);

    if (typeof returnValue === 'object') {
      const { value, cleanup } = returnValue;
      cleanupRef.current = {
        cleanup,
        isCalled: false,
      };
      return value;
    } else if (typeof returnValue === 'function') {
      cleanupRef.current = {
        cleanup: returnValue,
        isCalled: false,
      };
    }

    return returnValue;

    // Expects parent hook (useCleanupCallback) to have correct deps
    // eslint-disable-next-line
  }, deps);

  return outputCallback;
}

export default useCleanupCallback;

import { useCallback, useEffect, DependencyList, useRef } from 'react';

export type Cleanup = void | (() => void | undefined);

export type ReturnObject<V> = {
  value: V;
  cleanup: Cleanup;
};

export type CleanupCallback<T extends unknown[]> = (...args: T) => Cleanup;
export type CleanupCallbackWithReturn<T extends unknown[], V> = (
  ...args: T
) => ReturnObject<V>;
export type ReturnedCleanupCallbackWithReturn<T extends unknown[], V> = (
  ...args: T
) => V;

function executeIfFunction(arg: unknown) {
  if (typeof arg === 'function') arg();
}

/**
 * `useCleanupCallback` acts as a hybrid between `useCallback` and `useEffect`.
 * When the provided callback returns it's own cleanup callback, that cleanup will be
 * executed when the function is called again, and/or when the component un-mounts.
 * @param callback - Callback to be memoized. Supports returning a 'cleanup' callback.
 * @param deps - Dependency array for the associated callback.
 */
function useCleanupCallback<T extends unknown[]>(
  callback: CleanupCallback<T>,
  deps: DependencyList
): CleanupCallback<T>;
function useCleanupCallback<T extends unknown[], V>(
  callback: CleanupCallbackWithReturn<T, V>,
  deps: DependencyList
): ReturnedCleanupCallbackWithReturn<T, V>;
function useCleanupCallback<T extends unknown[], V>(
  callback: CleanupCallback<T> | CleanupCallbackWithReturn<T, V>,
  deps: DependencyList
): CleanupCallback<T> | ReturnedCleanupCallbackWithReturn<T, V>;
function useCleanupCallback<T extends unknown[], V>(
  callback: CleanupCallback<T> | CleanupCallbackWithReturn<T, V>,
  deps: DependencyList
) {
  const cleanupRef = useRef<Cleanup | null>(null);

  useEffect(() => {
    return () => {
      // clean up last call if applicable
      executeIfFunction(cleanupRef.current);
    };
  }, []);

  const outputCallback = useCallback((...args: T) => {
    // clean up previous call if applicable
    executeIfFunction(cleanupRef.current);

    const returnValue = callback(...args);

    if (typeof returnValue === 'object') {
      const { value, cleanup } = returnValue;
      cleanupRef.current = cleanup;
      return value;
    } else if (typeof returnValue === 'function') {
      cleanupRef.current = returnValue;
    }

    return returnValue;

    // Expects parent hook (useCleanupCallback) to have correct deps
    // eslint-disable-next-line
  }, deps);

  return outputCallback;
}

export default useCleanupCallback;

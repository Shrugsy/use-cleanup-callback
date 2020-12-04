import { useCallback, useEffect, DependencyList, useRef } from "react";

export type ReturnObject = {
  value: unknown;
  cleanup: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Callback<T extends any[]> = (
  ...args: T
) => void | ReturnObject | (() => void | undefined);

function executeIfFunction(arg: unknown) {
  if (typeof arg === "function") arg();
}

/**
 * `useCleanupCallback` acts as a hybrid between `useCallback` and `useEffect`.
 * When the provided callback returns it's own cleanup callback, that cleanup will be
 * executed when the function is called again, and/or when the component un-mounts.
 * @param callback - Callback to be memoized. Supports returning a 'cleanup' callback.
 * @param deps - Dependency array for the associated callback.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useCleanupCallback = <T extends any[]>(
  callback: Callback<T>,
  deps: DependencyList
) => {
  const cleanupCallback = useRef<(() => void) | void | null>(null);

  useEffect(() => {
    return () => {
      // clean up last call if applicable
      executeIfFunction(cleanupCallback.current);
    };
  }, []);

  const outputCallback = useCallback((...args: T) => {
    // clean up previous call if applicable
    executeIfFunction(cleanupCallback.current);

    const returnValue = callback(...args);

    if (typeof returnValue === "object") {
      const { value, cleanup } = returnValue;
      cleanupCallback.current = cleanup;
      return value;
    } else if (typeof returnValue === "function") {
      cleanupCallback.current = returnValue;
    }

    return returnValue;

    // Expects parent hook (useCleanupCallback) to have correct deps
    // eslint-disable-next-line
  }, deps);

  return outputCallback;
};

export default useCleanupCallback;

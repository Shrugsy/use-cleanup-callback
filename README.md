# use-cleanup-callback

A react hook that utilizes the 'cleanup callback' pattern of useEffect within a 'useCallback' style hook.

## Features

- Provides a memoized callback that will update only if a `dependency` in the provided `dependency array` changes (same as `useCallback`).
- Supports a `cleanup callback` within the provided callback which will be executed on the next successive function call, and/or on unmount.

The features can be thought of as either `"useEffect which is called manually"`, or `"useCallback with useEffect's cleanup pattern"`.

## Usage

Within a component:

```tsx
const myFunction = useCleanupCallback(() => {
  const timeoutId = setTimeout(() => {
    console.log("Hello world!");
  }, 1000);

  return () => {
    clearTimeout(timeoutId);
  };
}, []);

return <button onClick={myFunction}>Say hi</button>;
```

In the example above, clicking the button will start a timeout to log `'Hello world!'` after 1000ms. If the button is clicked again before then, the timeout will be cleared, and a new timeout will be started. On unmount, the latest timeout will also be cleared.

## Limitations

- As the provided callback expects a `cleanup callback` for the return value, it is not feasible to return a value when calling the memoized callback.
- Similarly to `useEffect`, the `callback` and returned `cleanup callback` must be synchronous (i.e. an `async` function callback will not work). You can alleviate this the same way you would with `useEffect` by defining the asynchronous function within the callback, and calling it immediately.

  ```tsx
  const myFunction = useCleanupCallback(() => {
    const controller = new AbortController();
    async function foo() {
      try {
        const res = await fetch("http://example.com/movies.json", {
          signal: controller.signal,
        });
        const data = await res.json();
        // do stuff with data
      } catch (err) {
        if (err.name === "AbortError") return;
        // handle error
      }
    }
    // call the async function immediately within this callback
    foo();

    return () => {
      // on cleanup, abort the controller for this scope
      controller.abort();
    };
  }, []);
  ```

# use-cleanup-callback

[![version](https://img.shields.io/npm/v/use-cleanup-callback)](https://www.npmjs.com/package/use-cleanup-callback)
[![Build Status](https://img.shields.io/travis/shrugsy/use-cleanup-callback)](https://travis-ci.org/shrugsy/use-cleanup-callback)
[![codecov](https://img.shields.io/codecov/c/github/shrugsy/use-cleanup-callback)](https://codecov.io/gh/shrugsy/use-cleanup-callback)

A react hook that utilizes the 'cleanup callback' pattern of useEffect within a 'useCallback' style hook.

[codesandbox demo](https://codesandbox.io/s/use-cleanup-callback-example-ptvhj?file=/src/App.js)

## Features

- Provides a memoized callback that will update only if a `dependency` in the provided `dependency array` changes (same as `useCallback`).
- Supports a `cleanup callback` within the provided callback which will be executed on the next successive function call, and/or on unmount.
- Full Typescript support

The features can be thought of as either `"useEffect which is called manually"`, or `"useCallback with useEffect's cleanup pattern"`.

## Installation

`npm i use-cleanup-callback`

## Usage

```tsx
import useCleanupCallback from 'use-cleanup-callback';

...

// within a component
const sayHiSoon = useCleanupCallback(() => {
  const timeoutId = setTimeout(() => {
    alert("Hello world!");
    console.log("Hello world!");
  }, 1000);

  return () => {
    clearTimeout(timeoutId);
  };
}, []);

return <button onClick={sayHiSoon}>Say hi</button>;
```

In the example above, clicking the button will start a timeout to log `'Hello world!'` after 1000ms. If the button is clicked again before then, the timeout will be cleared, and a new timeout will be started. On unmount, the latest timeout will also be cleared.

_Note_: This is a custom hook that makes use of a `dependencies` array. It is recommended that you add this hook to your eslint config for the `react-hooks/exhaustive-deps` rule to warn about incorrect dependencies.

https://www.npmjs.com/package/eslint-plugin-react-hooks#advanced-configuration

```
{
  "rules": {
    // ...
    "react-hooks/exhaustive-deps": ["warn", {
      "additionalHooks": "useCleanupCallback"
    }]
  }
}
```

## Advanced Usage

The callback you provide to the hook typically will return a 'cleanup' callback like so:

```ts
const greetAndAlert = useCleanupCallback((foo) => {
  const calculatedResult = 'hello ' + foo;
  const timeoutId = setTimeout(() => {
    alert(calculatedResult);
  }, 1000)
  ...

  // cleanup callback:
  return () => {
    clearTimeout(timeoutId);
  }
}, []);
```

This means that when you later call the function, you don't get a meaningful return value to use for yourself.

```ts
const result = greetAndAlert("world");
// `result` will just be the cleanup callback here!
```

While not anticipated to be a common use case, in order to both return a value _and_ use a cleanup callback, you can use object notation for the return value in the following shape:

```ts
{
  value: unknown;
  cleanup: () => void
}
```

For example:

```ts
const greetAndAlert = useCleanupCallback((foo) => {
  const calculatedResult = 'hello ' + foo;
  const timeoutId = setTimeout(() => {
    alert(calculatedResult);
  }, 1000)
  ...

  // object notation return:
  return {
    value: calculatedResult,
    cleanup: () => {
      clearTimeout(timeoutId);
    }
  }
})
```

```ts
const result = greetAndAlert("world");
// result === 'hello world'
// `result` is returned here, *and* we still get to use the cleanup!
```

## Options
`useCleanupCallback` takes an optional object as a third argument to pass additional options to in order to customize the behaviour of the hook.

| Name                | Type    | Default | Description                                                                      |
|---------------------|---------|---------|----------------------------------------------------------------------------------|
| cleanUpOnCall       | boolean | true    | Whether to call the last cleanup when the output callback of the hook is called. |
| cleanUpOnDepsChange | boolean | false   | Whether to call the last cleanup when dependencies change.                       |
| cleanUpOnUnmount    | boolean | true    | Whether to call the last cleanup when the hook unmounts.                         |


## Limitations

- Similarly to `useEffect`, the `callback` and returned `cleanup callback` must be synchronous (i.e. an `async` function callback will not work). You can alleviate this the same way you would with `useEffect` by defining the asynchronous function within the callback, and calling it immediately.

  ```tsx
  const fetchTodo = useCleanupCallback(() => {
    const controller = new AbortController();
    async function handleCallback() {
      try {
        const res = await fetch(
          "https://jsonplaceholder.typicode.com/todos/1",
          {
            signal: controller.signal,
          }
        );
        const data = await res.json();
        // do stuff with data
      } catch (err) {
        if (err.name === "AbortError") return;
        // handle error
        console.error("An unknown error has occurred: ", err);
      }
    }
    // call the async function immediately within this callback
    handleCallback();

    return () => {
      // on cleanup, abort the controller for this scope
      controller.abort();
    };
  }, []);
  ```

  [codesandbox async example](https://codesandbox.io/s/use-cleanup-callback-async-example-e6dcj?file=/src/App.js)

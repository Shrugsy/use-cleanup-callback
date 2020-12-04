import { renderHook } from "@testing-library/react-hooks";
import useCleanupCallback from "./";

describe("Expected behaviour", () => {
  test("Only provides new return reference if dependencies change", () => {
    let dep = "some_dependency";

    const firstInputCallback = jest.fn(() => undefined);
    const { result, rerender } = renderHook(
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ({ callback, deps }) => useCleanupCallback(callback, deps),
      {
        initialProps: {
          callback: firstInputCallback,
          deps: [dep],
        },
      }
    );

    const firstCallback = result.current;

    // calling the callback should not change the reference
    expect(firstInputCallback).not.toHaveBeenCalled;
    firstCallback();
    expect(firstInputCallback).toBeCalledTimes(1);
    expect(result.current).toEqual(firstCallback);

    // re-rendering without changing deps should not change the reference
    const secondInputCallback = jest.fn(() => undefined);
    rerender({
      callback: secondInputCallback,
      deps: [dep],
    });
    expect(result.current).toEqual(firstCallback);

    // calling after re-rendering should not change the reference
    result.current();
    expect(result.current).toEqual(firstCallback);

    // despite changing callback, we didn't change dependencies
    // so output is expected to be stale (the first input callback)
    expect(firstInputCallback).toBeCalledTimes(2);
    expect(secondInputCallback).not.toHaveBeenCalled;

    // change deps, should get a new reference
    const thirdInputCallback = jest.fn(() => undefined);
    dep = "some changed dependency";
    rerender({
      callback: thirdInputCallback,
      deps: [dep],
    });
    expect(result.current).not.toEqual(firstCallback);

    // calling the new callback should not change the reference
    const secondCallback = result.current;
    secondCallback();
    expect(result.current).toEqual(secondCallback);

    // other callbacks should not have been called any further
    expect(firstInputCallback).toBeCalledTimes(2);
    expect(secondInputCallback).not.toHaveBeenCalled;
    // newest callback should be correctly called since dependencies changed
    expect(thirdInputCallback).toBeCalledTimes(1);
  });

  test("Calls a provided cleanup callback each time the returned function is called, and on unmount", () => {
    let dep = "some_dependency";
    let numCalls = 0;

    const cleanupCallback0 = jest.fn(() => undefined);
    const cleanupCallback1 = jest.fn(() => undefined);
    const cleanupCallback2 = jest.fn(() => undefined);

    const inputCallback = jest.fn(() => {
      numCalls++;
      if (numCalls === 1) return cleanupCallback0;
      if (numCalls === 2) return cleanupCallback1;
      if (numCalls === 3) return cleanupCallback2;
    });

    const { result, rerender, unmount } = renderHook(
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ({ callback, deps }) => useCleanupCallback(callback, deps),
      {
        initialProps: {
          callback: inputCallback,
          deps: [dep],
        },
      }
    );

    // prior to doing anything, nothing should have been called
    expect(inputCallback).not.toHaveBeenCalled;
    expect(cleanupCallback0).not.toHaveBeenCalled;
    expect(cleanupCallback1).not.toHaveBeenCalled;
    expect(cleanupCallback2).not.toHaveBeenCalled;

    // call the output function for the first time,
    // input callback should be called, but not cleanups
    result.current();
    expect(inputCallback).toBeCalledTimes(1);
    expect(cleanupCallback0).not.toHaveBeenCalled;
    expect(cleanupCallback1).not.toHaveBeenCalled;
    expect(cleanupCallback2).not.toHaveBeenCalled;

    // call the output function again, input callback should be called again,
    // and cleanup for previous function should be called
    result.current();
    expect(inputCallback).toBeCalledTimes(2);
    expect(cleanupCallback0).toBeCalledTimes(1);
    expect(cleanupCallback1).not.toHaveBeenCalled;
    expect(cleanupCallback2).not.toHaveBeenCalled;

    // call the output function again, input callback should be called again,
    // and cleanup for previous function should be called
    result.current();
    expect(inputCallback).toBeCalledTimes(3);
    expect(cleanupCallback0).toBeCalledTimes(1);
    expect(cleanupCallback1).toBeCalledTimes(1);
    expect(cleanupCallback2).not.toHaveBeenCalled;

    // change dependencies, shouldn't call any callbacks or cleanups
    dep = "an altered dependency";
    rerender({
      callback: inputCallback,
      deps: [dep],
    });

    expect(inputCallback).toBeCalledTimes(3);
    expect(cleanupCallback0).toBeCalledTimes(1);
    expect(cleanupCallback1).toBeCalledTimes(1);
    expect(cleanupCallback2).not.toHaveBeenCalled;

    // unmount, callback for the latest function should be called
    unmount();
    expect(inputCallback).toBeCalledTimes(3);
    expect(cleanupCallback0).toBeCalledTimes(1);
    expect(cleanupCallback1).toBeCalledTimes(1);
    expect(cleanupCallback2).toBeCalledTimes(1);
  });

  test("Returned function can be called with arguments as per the provided callback", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const mockCallback = jest.fn((a: string, b: string) => {
      // don't need to actually do anything in here,
      // just used to ensure correct type inference and correct arguments passed
    });

    const { result } = renderHook(() => useCleanupCallback(mockCallback, []));

    const returnedFunction = result.current;

    expect(mockCallback).not.toHaveBeenCalled;

    // @ts-expect-error - called with no arguments, should expect two
    returnedFunction();
    expect(mockCallback).toBeCalledTimes(1);

    // @ts-expect-error - called with one argument, should expect two
    returnedFunction("foo");
    expect(mockCallback).toBeCalledTimes(2);
    expect(mockCallback).toBeCalledWith("foo");

    // @ts-expect-error - called with number, should expect string
    returnedFunction("foo", 4);
    expect(mockCallback).toBeCalledTimes(3);
    expect(mockCallback).toBeCalledWith("foo", 4);

    // no expected error here, called with correct arguments
    returnedFunction("foo", "bar");
    expect(mockCallback).toBeCalledTimes(4);
    expect(mockCallback).toBeCalledWith("foo", "bar");
  });

  test("Can return a value and cleanup in the callback when using object notation", () => {
    const mockCleanup = jest.fn();

    const inputCallback = () => {
      return {
        value: "foo",
        cleanup: mockCleanup,
      };
    };

    const { result } = renderHook(() => useCleanupCallback(inputCallback, []));

    expect(mockCleanup).not.toHaveBeenCalled;

    const returnValue = result.current();

    expect(returnValue).toBe("foo");
    expect(mockCleanup).toHaveBeenCalled;
  });

  test("Has a ts-error if the cleanup callback tries to return a value", () => {
    renderHook(() =>
      // @ts-expect-error : Type 'string' is not assignable to type 'void | undefined'.ts(2345)
      useCleanupCallback(() => {
        return () => "foo";
      }, [])
    );
  });
});

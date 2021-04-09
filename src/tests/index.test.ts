import { act, renderHook } from '@testing-library/react-hooks';
import { expectType } from 'tsd';
import useCleanupCallback from '..';

describe('Expected behaviour', () => {
  test('Only provides new return reference if dependencies change', () => {
    let dep = 'some_dependency';

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
    expect(firstInputCallback).not.toHaveBeenCalled();
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
    expect(secondInputCallback).not.toHaveBeenCalled();

    // change deps, should get a new reference
    const thirdInputCallback = jest.fn(() => undefined);
    dep = 'some changed dependency';
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
    expect(secondInputCallback).not.toHaveBeenCalled();
    // newest callback should be correctly called since dependencies changed
    expect(thirdInputCallback).toBeCalledTimes(1);
  });

  test('Calls a provided cleanup callback each time the returned function is called, and on unmount', () => {
    let dep = 'some_dependency';
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
    expect(inputCallback).not.toHaveBeenCalled();
    expect(cleanupCallback0).not.toHaveBeenCalled();
    expect(cleanupCallback1).not.toHaveBeenCalled();
    expect(cleanupCallback2).not.toHaveBeenCalled();

    // call the output function for the first time,
    // input callback should be called, but not cleanups
    result.current();
    expect(inputCallback).toBeCalledTimes(1);
    expect(cleanupCallback0).not.toHaveBeenCalled();
    expect(cleanupCallback1).not.toHaveBeenCalled();
    expect(cleanupCallback2).not.toHaveBeenCalled();

    // call the output function again, input callback should be called again,
    // and cleanup for previous function should be called
    result.current();
    expect(inputCallback).toBeCalledTimes(2);
    expect(cleanupCallback0).toBeCalledTimes(1);
    expect(cleanupCallback1).not.toHaveBeenCalled();
    expect(cleanupCallback2).not.toHaveBeenCalled();

    // call the output function again, input callback should be called again,
    // and cleanup for previous function should be called
    result.current();
    expect(inputCallback).toBeCalledTimes(3);
    expect(cleanupCallback0).toBeCalledTimes(1);
    expect(cleanupCallback1).toBeCalledTimes(1);
    expect(cleanupCallback2).not.toHaveBeenCalled();

    // change dependencies, shouldn't call any callbacks or cleanups
    dep = 'an altered dependency';
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

  test('Returned function can be called with arguments as per the provided callback', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const mockCallback = jest.fn((a: string, b: string) => {
      // don't need to actually do anything in here,
      // just used to ensure correct type inference and correct arguments passed
    });

    const { result } = renderHook(() => useCleanupCallback(mockCallback, []));

    const returnedFunction = result.current;

    expect(mockCallback).not.toHaveBeenCalled();

    // @ts-expect-error - called with no arguments, should expect two
    returnedFunction();
    expect(mockCallback).toBeCalledTimes(1);

    // @ts-expect-error - called with one argument, should expect two
    returnedFunction('foo');
    expect(mockCallback).toBeCalledTimes(2);
    expect(mockCallback).toBeCalledWith('foo');

    // @ts-expect-error - called with number, should expect string
    returnedFunction('foo', 4);
    expect(mockCallback).toBeCalledTimes(3);
    expect(mockCallback).toBeCalledWith('foo', 4);

    // no expected error here, called with correct arguments
    returnedFunction('foo', 'bar');
    expect(mockCallback).toBeCalledTimes(4);
    expect(mockCallback).toBeCalledWith('foo', 'bar');
  });

  test('Can return a value and cleanup in the callback when using object notation', () => {
    // CASE 1: STRING RETURN VALUE
    const mockCleanup0 = jest.fn();

    const inputCallback0 = () => {
      return {
        value: 'foo',
        cleanup: mockCleanup0,
      };
    };

    const { result } = renderHook(() => useCleanupCallback(inputCallback0, []));

    expect(mockCleanup0).not.toHaveBeenCalled();

    const returnValue0_0 = result.current();

    expectType<string>(returnValue0_0);
    expect(returnValue0_0).toBe('foo');
    expect(mockCleanup0).not.toHaveBeenCalled();

    // calling again should run cleanup
    const returnValue0_1 = result.current();
    expect(returnValue0_1).toBe('foo');
    expect(mockCleanup0).toHaveBeenCalled();

    // CASE 2: WITH A MORE DETAILED RETURN VALUE
    type MyTuple = Readonly<['hello', 'world']>;
    const mockCleanup1 = jest.fn();

    const returnTuple = ['hello', 'world'] as const;
    const inputCallback1 = () => {
      return {
        value: returnTuple,
        cleanup: mockCleanup1,
      };
    };

    const { result: result1 } = renderHook(() => useCleanupCallback(inputCallback1, []));

    expect(mockCleanup1).not.toHaveBeenCalled;

    const returnValue1_0 = result1.current();

    expectType<MyTuple>(returnValue1_0);
    // should match the expected tuple contents (shallow)
    expect(returnValue1_0).toEqual(['hello', 'world']);
    // should match strict equality with the return value
    expect(returnValue1_0).toBe(returnTuple);
    expect(mockCleanup1).not.toHaveBeenCalled();

    // calling again should run cleanup
    const returnValue1_1 = result1.current();

    expectType<MyTuple>(returnValue1_1);
    // should match the expected tuple contents (shallow)
    expect(returnValue1_1).toEqual(['hello', 'world']);
    // should match strict equality with the return value
    expect(returnValue1_1).toBe(returnTuple);
    expect(mockCleanup1).toHaveBeenCalled();
  });

  test('Has a ts-error if the cleanup callback tries to return a value directly', () => {
    renderHook(() =>
      // @ts-expect-error : Type 'string' is not assignable to type CleanupCallback<[]>.ts(2345)
      useCleanupCallback(() => {
        return () => 'foo';
      }, [])
    );
  });

  test('Calls cleanup on deps change when the option is true', () => {
    let dep = 'dep0';
    const mockCleanup0 = jest.fn();

    // [ACTION] - Initial render
    const { result, rerender, unmount } = renderHook(
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ({ callback, deps }) => useCleanupCallback(callback, deps, { cleanUpOnDepsChange: true }),
      {
        initialProps: {
          callback: () => {
            return mockCleanup0;
          },
          deps: [dep],
        },
      }
    );

    // [ACTION] - call the user's callback
    act(() => {
      result.current();
    });

    // [ACTION] - re-render with new deps
    dep = 'dep1';
    const mockCleanup1 = jest.fn();
    rerender({
      callback: () => {
        return mockCleanup1;
      },
      deps: [dep],
    });

    // [ASSERT] - should have called first cleanup
    expect(mockCleanup0).toBeCalledTimes(1);
    expect(mockCleanup1).toBeCalledTimes(0);

    // [ACTION] - call the user's callback
    act(() => {
      result.current();
    });

    // [ASSERT] - cleanups should be unaffected
    expect(mockCleanup0).toBeCalledTimes(1);
    expect(mockCleanup1).toBeCalledTimes(0);

    // [ACTION] - call the user's callback again
    act(() => {
      result.current();
    });

    // [ASSERT] - last cleanup should have triggered
    expect(mockCleanup0).toBeCalledTimes(1);
    expect(mockCleanup1).toBeCalledTimes(1);

    // [ACTION] - unmount the hook
    unmount();

    // [ASSERT] - last cleanup should be called again
    expect(mockCleanup0).toBeCalledTimes(1);
    expect(mockCleanup1).toBeCalledTimes(2);
  });

  test('Does not call cleanup on deps change when the option is false', () => {
    let dep = 'dep0';
    const mockCleanup0 = jest.fn();

    // [ACTION] - Initial render
    const { result, rerender, unmount } = renderHook(
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ({ callback, deps }) => useCleanupCallback(callback, deps, { cleanUpOnDepsChange: false }),
      {
        initialProps: {
          callback: () => {
            return mockCleanup0;
          },
          deps: [dep],
        },
      }
    );

    // [ACTION] - call the user's callback
    act(() => {
      result.current();
    });

    // [ACTION] - re-render with new deps
    dep = 'dep1';
    const mockCleanup1 = jest.fn();
    rerender({
      callback: () => {
        return mockCleanup1;
      },
      deps: [dep],
    });

    // [ASSERT] - should not have called first cleanup (option false)
    expect(mockCleanup0).toBeCalledTimes(0);
    expect(mockCleanup1).toBeCalledTimes(0);

    // [ACTION] - call the user's callback
    act(() => {
      result.current();
    });

    // [ASSERT] - first cleanup should have triggered
    expect(mockCleanup0).toBeCalledTimes(1);
    expect(mockCleanup1).toBeCalledTimes(0);

    // [ACTION] - call the user's callback again
    act(() => {
      result.current();
    });

    // [ASSERT] - last cleanup should have triggered
    expect(mockCleanup0).toBeCalledTimes(1);
    expect(mockCleanup1).toBeCalledTimes(1);

    // [ACTION] - unmount hook
    unmount();

    // [ASSERT] - last cleanup should have triggered again
    expect(mockCleanup0).toBeCalledTimes(1);
    expect(mockCleanup1).toBeCalledTimes(2);
  });

  test('Does not call cleanup on unmount change when the option is true', () => {
    const mockCleanup0 = jest.fn();

    // [ACTION] - Initial render
    const { result, rerender, unmount } = renderHook(
      // eslint-disable-next-line react-hooks/exhaustive-deps
      () =>
        useCleanupCallback(
          () => {
            return mockCleanup0;
          },
          [],
          { cleanUpOnUnmount: true }
        )
    );

    // [ACTION] - call the user's callback
    act(() => {
      result.current();
    });

    // [ASSERT] - should not have called first cleanup
    expect(mockCleanup0).toBeCalledTimes(0);

    // [ACTION] - call the user's callback
    act(() => {
      result.current();
    });

    // [ASSERT] - first cleanup should have triggered
    expect(mockCleanup0).toBeCalledTimes(1);

    // [ACTION] - call the user's callback again
    act(() => {
      result.current();
    });

    // [ASSERT] - cleanup should have triggered
    expect(mockCleanup0).toBeCalledTimes(2);

    // [ACTION] - re-render hook
    rerender();

    // [ASSERT] - cleanup should be not have triggered again
    expect(mockCleanup0).toBeCalledTimes(2);

    // [ACTION] - unmount hook
    unmount();

    // [ASSERT] - cleanup should have triggered again (option true)
    expect(mockCleanup0).toBeCalledTimes(3);
  });

  test('Does not call cleanup on unmount change when the option is false', () => {
    const mockCleanup0 = jest.fn();

    // [ACTION] - Initial render
    const { result, rerender, unmount } = renderHook(
      // eslint-disable-next-line react-hooks/exhaustive-deps
      () =>
        useCleanupCallback(
          () => {
            return mockCleanup0;
          },
          [],
          { cleanUpOnUnmount: false }
        )
    );

    // [ACTION] - call the user's callback
    act(() => {
      result.current();
    });

    // [ASSERT] - should not have called cleanup
    expect(mockCleanup0).toBeCalledTimes(0);

    // [ACTION] - call the user's callback
    act(() => {
      result.current();
    });

    // [ASSERT] - cleanup should have triggered
    expect(mockCleanup0).toBeCalledTimes(1);

    // [ACTION] - call the user's callback again
    act(() => {
      result.current();
    });

    // [ASSERT] - cleanup should have triggered
    expect(mockCleanup0).toBeCalledTimes(2);

    // [ACTION] - re-render hook
    rerender();

    // [ASSERT] - cleanup should be not have triggered again
    expect(mockCleanup0).toBeCalledTimes(2);

    // [ACTION] - unmount hook
    unmount();

    // [ASSERT] - cleanup should not have triggered again (option false)
    expect(mockCleanup0).toBeCalledTimes(2);
  });

  test('Does not call cleanup on calle when the option is false', () => {
    const mockCleanup0 = jest.fn();

    // [ACTION] - Initial render
    const { result, rerender, unmount } = renderHook(
      // eslint-disable-next-line react-hooks/exhaustive-deps
      () =>
        useCleanupCallback(
          () => {
            return mockCleanup0;
          },
          [],
          { cleanUpOnCall: false }
        )
    );

    // [ACTION] - call the user's callback
    act(() => {
      result.current();
    });

    // [ASSERT] - should not have called cleanup
    expect(mockCleanup0).toBeCalledTimes(0);

    // [ACTION] - call the user's callback
    act(() => {
      result.current();
    });

    // [ASSERT] - should not have called cleanup (option false)
    expect(mockCleanup0).toBeCalledTimes(0);

    // [ACTION] - call the user's callback again
    act(() => {
      result.current();
    });

    // [ASSERT] - should not have called cleanup (option false)
    expect(mockCleanup0).toBeCalledTimes(0);

    // [ACTION] - re-render hook
    rerender();

    // [ASSERT] - should not have called cleanup (option false)
    expect(mockCleanup0).toBeCalledTimes(0);

    // [ACTION] - unmount hook
    unmount();

    // [ASSERT] - cleanup should have triggered
    expect(mockCleanup0).toBeCalledTimes(1);
  });
});

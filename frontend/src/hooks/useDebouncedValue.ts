import { useEffect, useState } from "react";

/**
 * Trails `value` by `delay`, so typing in a filter field does not fire one
 * request per keystroke. A delay of 0 still defers by a tick, which keeps the
 * behaviour uniform and lets tests opt out of fake timers.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);

    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

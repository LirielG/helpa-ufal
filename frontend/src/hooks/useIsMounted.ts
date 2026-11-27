import { useCallback, useEffect, useRef } from "react";

/**
 * Returns a stable function that tells whether the component is still on
 * screen, for code that resumes after an `await` and must not act on a screen
 * the user already left.
 */
export function useIsMounted(): () => boolean {
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useCallback(() => isMountedRef.current, []);
}

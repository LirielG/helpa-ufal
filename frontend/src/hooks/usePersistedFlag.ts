import { useCallback, useState, type SetStateAction } from "react";

function readFlag(key: string, defaultValue: boolean): boolean {
  try {
    const saved = localStorage.getItem(key);
    if (saved === "true") return true;
    if (saved === "false") return false;
  } catch {
    // Storage can be blocked (private window, disabled site data).
  }
  return defaultValue;
}

/**
 * A boolean kept in localStorage as "true"/"false", per browser. When the
 * storage is missing or throws, the flag starts at `defaultValue` and still
 * works for the current page, just without being remembered.
 */
export function usePersistedFlag(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(() => readFlag(key, defaultValue));

  const update = useCallback(
    (next: SetStateAction<boolean>) => {
      setValue((previous) => {
        const resolved = typeof next === "function" ? next(previous) : next;
        try {
          localStorage.setItem(key, String(resolved));
        } catch {
          // Not remembered across reloads, but the toggle still applies.
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, update] as const;
}

import { useEffect, useState } from "react";

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

  // In an effect rather than in the setter: a state updater must stay pure,
  // and only a committed value is worth remembering.
  useEffect(() => {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Not remembered across reloads, but the toggle still applies.
    }
  }, [key, value]);

  return [value, setValue] as const;
}

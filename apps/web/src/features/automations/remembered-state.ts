import { useCallback, useState } from "react";

/**
 * useState that survives the panel unmounting (switching to Data and back) and page reloads
 * within the browser tab. Values must be JSON-serialisable.
 */
export function useRememberedState<T>(key: string, initial: T): [T, (next: T) => void] {
  const storageKey = `tableos:${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        if (next === null || next === undefined) sessionStorage.removeItem(storageKey);
        else sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Storage full or disabled: keep the in-memory value.
      }
    },
    [storageKey],
  );
  return [value, set];
}

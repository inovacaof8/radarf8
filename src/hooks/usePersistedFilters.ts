import { useEffect, useState } from "react";

export function usePersistedFilters<T>(key: string, defaults: T): [T, (v: T | ((prev: T) => T)) => void, () => void] {
  const storageKey = `tf:${key}`;
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return defaults;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return defaults;
      return { ...defaults, ...JSON.parse(raw) } as T;
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {/* ignore */}
  }, [storageKey, state]);

  const reset = () => setState(defaults);
  return [state, setState, reset];
}

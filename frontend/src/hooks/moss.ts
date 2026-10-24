"use client";

import * as React from "react";

/** Sets a consistent document title per screen. */
export function usePageTitle(title: string | null) {
  React.useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} — Moss` : "Moss — The Digital Backlog Gardener";
    return () => {
      document.title = previous;
    };
  }, [title]);
}

/** Debounce any fast-changing value (used by inbox search). */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Mounted guard for client-only rendering. */
export function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}

const THEME_KEY = "moss.theme";

export type ThemeChoice = "light" | "dark";

/** Tiny theme controller (class on <html>) — persisted, defaults to system light. */
export function useTheme() {
  const [theme, setThemeState] = React.useState<ThemeChoice>("light");

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_KEY);
      if (stored === "dark" || stored === "light") {
        setThemeState(stored);
        document.documentElement.classList.toggle("dark", stored === "dark");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setTheme = React.useCallback((next: ThemeChoice) => {
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return { theme, setTheme };
}

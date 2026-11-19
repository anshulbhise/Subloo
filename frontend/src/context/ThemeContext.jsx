import { useState, useEffect, useMemo, useCallback } from "react";
import ThemeContext from "./ThemeContextCore";

const STORAGE_KEY = "subloo-theme";

function getSystemTheme() {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

  function getStoredTheme() {
    if (typeof window === "undefined") return "system";
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === "light" || saved === "dark" || saved === "system") {
          return saved;
        }
      } catch {
        // Ignore localStorage access issues
      }
      return "system";
    }

        function applyThemeClass(resolved) {
          if (typeof document === "undefined") return;
          const root = document.documentElement;
          if (resolved === "dark") {
            root.classList.add("dark");
          } else {
            root.classList.remove("dark");
          }
          root.setAttribute("data-theme", resolved);
        }

        export function ThemeProvider({ children }) {
          const [theme, setThemeState] = useState(getStoredTheme);
          const [systemTheme, setSystemTheme] = useState(getSystemTheme);

          const resolvedTheme = useMemo(() => {
            return theme === "system" ? systemTheme : theme;
          }, [theme, systemTheme]);

          useEffect(() => {
              if (typeof window === "undefined") return;
              const media = window.matchMedia("(prefers-color-scheme: dark)");
              const handler = (e) => {
                setSystemTheme(e.matches ? "dark" : "light");
              };

                if (media.addEventListener) {
                  media.addEventListener("change", handler);
                  return () => media.removeEventListener("change", handler);
                }
                media.addListener(handler);
                return () => media.removeListener(handler);
              }, []);

          useEffect(() => {
            applyThemeClass(resolvedTheme);
          }, [resolvedTheme]);

          const setTheme = useCallback((newTheme) => {
            if (newTheme !== "light" && newTheme !== "dark" && newTheme !== "system") {
              return;
            }
            setThemeState(newTheme);
            try {
              localStorage.setItem(STORAGE_KEY, newTheme);
            } catch {
              // Ignore localStorage write failures
            }
          }, []);

          const value = useMemo(
            () => ({
              theme,
              resolvedTheme,
              setTheme,
            }),
            [theme, resolvedTheme, setTheme]
          );

          return (
            <ThemeContext.Provider value={value}>
              {children}
            </ThemeContext.Provider>
          );
        }

        export default ThemeProvider;

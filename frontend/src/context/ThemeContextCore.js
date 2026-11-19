import { createContext } from "react";

export const ThemeContext = createContext({
  theme: "system",
  resolvedTheme: "dark",
  setTheme: () => {},
});

export default ThemeContext;

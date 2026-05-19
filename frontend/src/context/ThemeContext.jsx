import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("sigined_theme");
    return saved || "light";
  });

  useEffect(() => {
    localStorage.setItem("sigined_theme", theme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  const isLight = theme === "light";

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isLight }}>
      {children}
    </ThemeContext.Provider>
  );
}
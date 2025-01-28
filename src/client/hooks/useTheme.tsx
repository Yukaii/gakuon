import { useState, useEffect } from "react";

type Theme = "system" | "dark" | "light";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme as Theme) || "system";
  });

  useEffect(() => {
    const html = document.documentElement;

    if (theme === "system") {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      html.classList.toggle("dark", prefersDark);
      localStorage.removeItem("theme");
    } else {
      html.classList.toggle("dark", theme === "dark");
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  return { theme, setTheme };
}

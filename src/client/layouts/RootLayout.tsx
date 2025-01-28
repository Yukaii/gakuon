import { Outlet } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import { Moon, Sun, Desktop } from "@phosphor-icons/react";

export function RootLayout() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="container p-4 mx-auto dark:bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold dark:text-white">Gakuon Web</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTheme("system")}
            className={`p-2 rounded-lg ${
              theme === "system"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
            }`}
            title="System theme"
          >
            <Desktop size={20} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`p-2 rounded-lg ${
              theme === "light"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
            }`}
            title="Light theme"
          >
            <Sun size={20} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`p-2 rounded-lg ${
              theme === "dark"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
            }`}
            title="Dark theme"
          >
            <Moon size={20} weight="bold" />
          </button>
        </div>
      </div>
      <Outlet />
    </div>
  );
}

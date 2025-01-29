import { Outlet } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import { Moon, Sun, Desktop, CaretDown } from "@phosphor-icons/react";
import { useState, useRef, useEffect } from "react";

export function RootLayout() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const themeOptions = [
    { value: "system", icon: Desktop, label: "System" },
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
  ];

  const currentThemeOption = themeOptions.find((option) => option.value === theme);
  const Icon = currentThemeOption?.icon || Desktop;

  return (
    <div className="container p-4 mx-auto dark:bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold dark:text-white">Gakuon Web</h1>
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            <Icon size={20} weight="bold" />
            <span>{currentThemeOption?.label}</span>
            <CaretDown
              size={16}
              weight="bold"
              className={`transform transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5">
              <div className="py-1">
                {themeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setTheme(option.value as "system" | "light" | "dark");
                      setIsOpen(false);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700
                      ${theme === option.value ? "text-blue-500" : "text-gray-700 dark:text-gray-300"}`}
                    type="button"
                  >
                    <option.icon size={20} weight="bold" />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <Outlet />
    </div>
  );
}

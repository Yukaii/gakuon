// Default API base URL
const DEFAULT_API_BASE = "http://localhost:4989/api";

// Initialize localApiBase from localStorage
let localApiBase: string | null = localStorage.getItem("apiBase");

// Getter function for API base URL
export function getApiBase(): string {
  return localApiBase || import.meta.env.VITE_API_BASE || DEFAULT_API_BASE;
}

// Function to change API base URL at runtime
export function setApiBase(newBase: string | null) {
  localApiBase = newBase;
  if (newBase) {
    localStorage.setItem("apiBase", newBase);
  } else {
    localStorage.removeItem("apiBase");
  }
  // Force a page reload to ensure all components pick up the new API base
  window.location.reload();
}

// Function to get the default API base
export function getDefaultApiBase(): string {
  return DEFAULT_API_BASE;
}

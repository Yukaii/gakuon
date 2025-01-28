// Default API base URL
const DEFAULT_API_BASE = "http://localhost:4989/api";

// Local runtime variable to override API base URL
let localApiBase: string | null = null;

// Getter function for API base URL
export function getApiBase(): string {
  return localApiBase || import.meta.env.VITE_API_BASE || DEFAULT_API_BASE;
}

// Function to change API base URL at runtime
export function setApiBase(newBase: string | null) {
  localApiBase = newBase;
  // Force a page reload to ensure all components pick up the new API base
  window.location.reload();
}

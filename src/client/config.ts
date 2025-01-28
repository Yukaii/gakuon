// Default API base URL
const DEFAULT_API_BASE = "http://localhost:4989/api";

// Allow overriding via environment variables or window.__API_BASE__
export const API_BASE =
  (typeof window !== 'undefined' && (window as any).__API_BASE__) ||
  process.env.REACT_APP_API_BASE ||
  DEFAULT_API_BASE;

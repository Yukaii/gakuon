// Default API base URL
const DEFAULT_API_BASE = "http://localhost:4989/api";

// Allow overriding via environment variables
export const API_BASE = import.meta.env.VITE_API_BASE || DEFAULT_API_BASE;

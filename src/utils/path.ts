import { homedir } from "node:os";

export function expandTildePath(path: string): string {
  if (path.startsWith("~/") || path === "~") {
    return path.replace(/^~/, homedir());
  }
  return path;
}

export function interpolateEnvVars(value: string): string {
  return value.replace(
    /\$\{([^}]+)\}|\$([A-Z_][A-Z0-9_]*)/g,
    (match, p1, p2) => {
      const envVar = p1 || p2;
      const envValue = process.env[envVar];

      if (!envValue) {
        console.warn(`Warning: Environment variable ${envVar} is not set`);
        return match;
      }

      return envValue;
    },
  );
}

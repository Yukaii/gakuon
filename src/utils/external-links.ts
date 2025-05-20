import { exec } from "node:child_process";
import { platform } from "node:os";

/**
 * Opens a URL in the default browser
 * 
 * @param url The URL to open
 * @returns Promise that resolves when the command is executed
 */
export function openInBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = getOpenCommand(url);
    
    exec(command, (error) => {
      if (error) {
        console.error(`Failed to open ${url}:`, error);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get the platform-specific command to open a URL
 */
function getOpenCommand(url: string): string {
  const escapedUrl = url.replace(/"/g, '\\"');
  
  switch (platform()) {
    case "win32":
      return `start "" "${escapedUrl}"`;
    case "darwin":
      return `open "${escapedUrl}"`;
    default:
      // Linux and others
      return `xdg-open "${escapedUrl}"`;
  }
}

/**
 * Validates if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates if a URL is a YouTube URL
 */
export function isYoutubeUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.hostname === "www.youtube.com" ||
      parsedUrl.hostname === "youtube.com" ||
      parsedUrl.hostname === "youtu.be"
    );
  } catch {
    return false;
  }
}
import { loadConfig } from "../config/loader";
import { createServer } from "../services/server/app";
import { AnkiService } from "../services/anki";
import { OpenAIService } from "../services/openai";
import { ContentManager } from "../services/content-manager";
import type { Server } from "node:http";

interface ServeOptions {
  port?: string;
  debug?: boolean;
}

export async function serve(options: ServeOptions = {}) {
  const debug = options.debug || false;
  const port = Number.parseInt(options.port || "3000", 10);

  // Load configuration
  const config = loadConfig();

  // Initialize services
  const ankiService = new AnkiService(config.global.ankiHost, debug);
  const openaiService = new OpenAIService(config.global.openaiApiKey, debug);
  const contentManager = new ContentManager(ankiService, openaiService, debug);

  // Create and start server
  const app = createServer({
    ankiService,
    openaiService,
    contentManager,
    debug,
    config,
  });

  let server: Server | null = null;

  // Handle shutdown gracefully
  const shutdown = () => {
    console.log("\nShutting down server...");
    server?.close(() => {
      console.log("Server stopped");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Start listening
  server = app.listen(port, () => {
    console.log(`Gakuon server running at http://localhost:${port}`);
  });
}

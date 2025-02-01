import express from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import cors from "cors";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type {
  ServerDependencies,
  APIError,
  CardResponse,
  AnswerRequest,
} from "./types";
import { PromptError } from "../../config/types";
import { findDeckConfig } from "../../config/loader";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";

async function saveBase64ToTemp(base64Data: string): Promise<string> {
  // Create a unique filename
  const filename = `gakuon_${randomBytes(4).toString("hex")}.mp3`;
  const tempPath = join(tmpdir(), filename);

  // Convert base64 to buffer and save
  const buffer = Buffer.from(base64Data, "base64");
  await writeFile(tempPath, buffer);

  return tempPath;
}

export function createServer(deps: ServerDependencies) {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  if (deps.serveClient) {
    // Try multiple possible locations for client files
    const possiblePaths = [
      // Development path
      join(__dirname, "../../client/dist/client"),
      // Local installed package path
      join(__dirname, "../../../client"),
      // Built package path
      join(__dirname, "../client"),
      // Global npm installation path
      join(process.execPath, "../../lib/node_modules/gakuon/dist/client"),
    ];

    let clientPath = null;
    for (const path of possiblePaths) {
      try {
        const indexPath = join(path, "index.html");
        if (existsSync(indexPath)) {
          clientPath = path;
          break;
        }
      } catch (e) {
        // Continue trying paths
      }
    }

    if (!clientPath) {
      console.warn("Could not find client files to serve");
      if (deps.debug) {
        console.debug("Searched paths:", possiblePaths);
        console.debug("Node executable path:", process.execPath);
      }
    } else {
      app.use(express.static(clientPath));
    }
  }

  // Debug logging
  if (deps.debug) {
    app.use((req, _res, next) => {
      console.log(`[${req.method}] ${req.path}`);
      next();
    });
  }

  // Error handling middleware
  const errorHandler = (
    err: Error,
    _req: Request,
    res: Response<APIError>,
    _next: NextFunction,
  ) => {
    console.error(err);
    if (err instanceof PromptError) {
      return res.status(422).json({
        error: "Content generation failed",
        details: err.details,
      });
    }
    res.status(500).json({ error: err.message });
  };

  // API Routes
  app.get(
    "/api/decks",
    asyncHandler(async (_req, res: Response) => {
      const decks = await deps.ankiService.getDeckNames();
      res.json({
        decks: decks,
      });
    }),
  );

  app.get(
    "/api/decks/:name/cards",
    asyncHandler(async (req, res: Response) => {
      const cards = await deps.ankiService.getDueCardsInfo(req.params.name);
      res.json(cards);
    }),
  );

  const getCardDetails = async (req: Request, res: Response) => {
    const cardId = Number.parseInt(req.params.id, 10);
    const [card] = await deps.ankiService.getCardsInfo([cardId]);

    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }

    const { metadata, content, audioFiles } =
      await deps.contentManager.getExistingContent(card);

    const response: CardResponse = {
      cardId: card.cardId,
      content: content || {},
      audioUrls: await Promise.all(audioFiles),
      queue: card.queue,
      due: card.due,
      interval: card.interval,
      factor: card.factor,
      reps: card.reps,
      lapses: card.lapses,
      fields: card.fields,
      metadata,
    };

    res.json(response);
  };
  app.get(
    "/api/cards/:id",
    asyncHandler(getCardDetails) as unknown as RequestHandler,
  );

  const submitCardAnswer = async (req: Request, res: Response) => {
    const cardId = Number.parseInt(req.params.id, 10);
    const { ease } = req.body as AnswerRequest;

    if (ease < 1 || ease > 4) {
      return res.status(400).json({ error: "Invalid ease value" });
    }

    const success = await deps.ankiService.answerCard(cardId, ease);
    if (!success) {
      return res.status(404).json({ error: "Card not found" });
    }

    res.json({ success: true });
  };
  app.post(
    "/api/cards/:id/answer",
    asyncHandler(submitCardAnswer) as unknown as RequestHandler,
  );

  const regenerateCardContent = async (req, res: Response) => {
    const cardId = Number.parseInt(req.params.id, 10);
    const [card] = await deps.ankiService.getCardsInfo([cardId]);

    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }

    // Find deck config for the card
    const config = findDeckConfig(card.deckName, deps.config.decks);
    if (!config) {
      return res.status(404).json({ error: "Deck configuration not found" });
    }

    // Generate new content
    const { content, audioFiles } =
      await deps.contentManager.getOrGenerateContent(card, config, true);

    // Wait for audio generation to complete
    await Promise.all(audioFiles);

    res.json({ content });
  };
  app.post(
    "/api/cards/:id/regenerate",
    asyncHandler(regenerateCardContent) as unknown as RequestHandler,
  );

  const serveAudioFile = async (req: Request, res: Response) => {
    let tempFilePath: string | null = null;
    const base64Audio = await deps.ankiService.retrieveMediaFile(
      req.params.filename,
    );
    if (!base64Audio) {
      return res.status(404).json({ error: "Audio file not found" });
    }
    tempFilePath = await saveBase64ToTemp(base64Audio);
    res.sendFile(tempFilePath, (err) => {
      if (err) {
        return res.status(500).end();
      }
      if (tempFilePath) {
        unlink(tempFilePath).catch(console.error);
      }
    });
  };
  // Audio file serving
  app.get(
    "/api/audio/:filename",
    asyncHandler(serveAudioFile) as unknown as RequestHandler,
  );

  const getDeckConfig = async (req: Request, res: Response) => {
    const deckName = req.params.name;
    const config = findDeckConfig(deckName, deps.config.decks);

    if (!config) {
      return res.status(404).json({ error: "Deck configuration not found" });
    }

    res.json({ config });
  };
  app.get(
    "/api/decks/:name/config",
    asyncHandler(getDeckConfig) as unknown as RequestHandler,
  );

  app.use(errorHandler as unknown as RequestHandler);

  return app;
}

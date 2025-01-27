import express from "express";
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

export function createServer(deps: ServerDependencies) {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

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
  app.get("/api/decks", async (_req, res: Response, next) => {
    try {
      const decks = await deps.ankiService.getDeckNames();
      res.json({
        decks: decks,
      });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/decks/:name/cards", async (req, res: Response, next) => {
    try {
      const cards = await deps.ankiService.getDueCardsInfo(req.params.name);
      res.json(cards);
    } catch (err) {
      next(err);
    }
  });

  const getCardDetails = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const cardId = Number.parseInt(req.params.id, 10);
      const [card] = await deps.ankiService.getCardsInfo([cardId]);

      if (!card) {
        return res.status(404).json({ error: "Card not found" });
      }

      const metadata = await deps.contentManager.getExistingContent(card);

      const response: CardResponse = {
        id: card.cardId,
        content: metadata.content || {},
        audioUrls: await Promise.all(metadata.audioFiles),
        queue: card.queue,
        due: card.due,
        interval: card.interval,
        factor: card.factor,
        reps: card.reps,
        lapses: card.lapses,
      };

      res.json(response);
    } catch (err) {
      next(err);
    }
  };
  app.get("/api/cards/:id", getCardDetails as unknown as RequestHandler);

  const submitCardAnswer = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
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
    } catch (err) {
      next(err);
    }
  };
  app.post(
    "/api/cards/:id/answer",
    submitCardAnswer as unknown as RequestHandler,
  );

  const regenerateCardContent = async (req, res: Response, next) => {
    try {
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
    } catch (err) {
      next(err);
    }
  };
  app.post(
    "/api/cards/:id/regenerate",
    regenerateCardContent as unknown as RequestHandler,
  );

  const serveAudioFile = async (req: Request, res: Response, next) => {
    try {
      const audioPath = await deps.ankiService.retrieveMediaFile(
        req.params.filename,
      );
      if (!audioPath) {
        return res.status(404).json({ error: "Audio file not found" });
      }

      // Add error handling for sendFile
      res.sendFile(audioPath, (err) => {
        if (err) {
          // If file doesn't exist or can't be read, return 404
          res.status(404).json({ error: "Audio file not found" });
        }
      });
    } catch (err) {
      next(err);
    }
  };
  // Audio file serving
  app.get("/api/audio/:filename", serveAudioFile as unknown as RequestHandler);

  const getDeckConfig = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const deckName = req.params.name;
      const config = findDeckConfig(deckName, deps.config.decks);

      if (!config) {
        return res.status(404).json({ error: "Deck configuration not found" });
      }

      res.json({
        config,
      });
    } catch (err) {
      next(err);
    }
  };
  app.get(
    "/api/decks/:name/config",
    getDeckConfig as unknown as RequestHandler,
  );

  app.use(errorHandler as unknown as RequestHandler);

  return app;
}

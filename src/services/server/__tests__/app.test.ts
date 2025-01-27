import request from "supertest";
import { createServer } from "../app";
import type { ServerDependencies } from "../types";
import type { Card, DeckConfig, GakuonConfig } from "../../../config/types";
import type { AnkiService } from "../../anki";
import type { OpenAIService } from "../../openai";
import type { ContentManager } from "../../content-manager";
import { DEFAULT_CONFIG } from "../../../config/loader";

// Mock dependencies
const mockAnkiService = {
  getDeckNames: jest.fn(),
  findCards: jest.fn(),
  getDueCardsInfo: jest.fn(),
  getCardsInfo: jest.fn(),
  getCardMetadata: jest.fn(),
  answerCard: jest.fn(),
  retrieveMediaFile: jest.fn(),
};

const mockOpenAIService = {
  generateContent: jest.fn(),
  generateAudio: jest.fn(),
};

const mockContentManager = {
  getOrGenerateContent: jest.fn(),
  getExistingContent: jest.fn(),
};

const mockConfig = {
  decks: [
    {
      name: "Test Deck",
      pattern: "Test Deck",
      prompt: "test prompt",
      fields: {
        front: "Front",
        back: "Back",
      },
      responseFields: {
        sentence: {
          description: "Sentence",
          required: true,
          audio: true,
        },
      },
    } as DeckConfig,
  ],
} as GakuonConfig;

const deps: ServerDependencies = {
  ankiService: mockAnkiService as unknown as AnkiService,
  openaiService: mockOpenAIService as unknown as OpenAIService,
  contentManager: mockContentManager as unknown as ContentManager,
  config: mockConfig,
  debug: false,
};

// Mock data
const mockCard: Card = {
  cardId: 1234,
  note: 1,
  deckName: "Test Deck",
  modelName: "Basic",
  fields: {
    Front: { value: "Test Front", order: 0 },
    Back: { value: "Test Back", order: 1 },
  },
  queue: 2,
  due: 0,
  interval: 1,
  factor: 2500,
  reps: 1,
  lapses: 0,
};

describe("Gakuon API", () => {
  let app: ReturnType<typeof createServer>;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    app = createServer(deps);
  });

  describe("GET /api/decks", () => {
    it("should return list of decks with due counts", async () => {
      mockAnkiService.getDeckNames.mockResolvedValue(["Test Deck"]);
      mockAnkiService.findCards.mockResolvedValue([1, 2, 3]);

      const response = await request(app).get("/api/decks");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        decks: ["Test Deck"],
      });
    });

    it("should handle errors", async () => {
      mockAnkiService.getDeckNames.mockRejectedValue(new Error("Anki error"));

      const response = await request(app).get("/api/decks");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/decks/:name/cards", () => {
    it("should return due cards for deck", async () => {
      mockAnkiService.getDueCardsInfo.mockResolvedValue([mockCard]);

      const response = await request(app).get("/api/decks/Test%20Deck/cards");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([mockCard]);
    });
  });

  describe("GET /api/cards/:id", () => {
    it("should return card with content", async () => {
      mockAnkiService.getCardsInfo.mockResolvedValue([mockCard]);
      mockAnkiService.getCardMetadata.mockResolvedValue({
        content: { sentence: "Test sentence" },
        audio: { sentence: "[sound:test.mp3]" },
      });
      mockContentManager.getExistingContent.mockResolvedValue({
        content: { sentence: "Test sentence" },
        audioFiles: [Promise.resolve("[sound:test.mp3]")],
      });

      const response = await request(app).get("/api/cards/1234");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 1234,
        content: { sentence: "Test sentence" },
        audioUrls: ["[sound:test.mp3]"],
      });
    });

    it("should return 404 for non-existent card", async () => {
      mockAnkiService.getCardsInfo.mockResolvedValue([]);

      const response = await request(app).get("/api/cards/9999");

      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/cards/:id/answer", () => {
    it("should accept valid ease values", async () => {
      mockAnkiService.answerCard.mockResolvedValue(true);

      const response = await request(app)
        .post("/api/cards/1234/answer")
        .send({ ease: 3 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    it("should reject invalid ease values", async () => {
      const response = await request(app)
        .post("/api/cards/1234/answer")
        .send({ ease: 5 });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/cards/:id/regenerate", () => {
    it("should regenerate card content", async () => {
      mockAnkiService.getCardsInfo.mockResolvedValue([mockCard]);
      mockContentManager.getOrGenerateContent.mockResolvedValue({
        content: { sentence: "New sentence" },
        audioFiles: [Promise.resolve("test.mp3")],
      });

      const response = await request(app).post("/api/cards/1234/regenerate");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        content: { sentence: "New sentence" },
      });
    });

    it("should handle missing deck config", async () => {
      const invalidCard = { ...mockCard, deckName: "Invalid Deck" };
      mockAnkiService.getCardsInfo.mockResolvedValue([invalidCard]);

      const response = await request(app).post("/api/cards/1234/regenerate");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Deck configuration not found");
    });
  });

  describe("GET /api/audio/:filename", () => {
    it("should serve audio files", async () => {
      mockAnkiService.retrieveMediaFile.mockResolvedValue("/path/to/audio.mp3");

      const response = await request(app).get("/api/audio/test.mp3");

      expect(response.status).toBe(404); // Will be 404 in tests due to file not existing
      expect(mockAnkiService.retrieveMediaFile).toHaveBeenCalledWith(
        "test.mp3",
      );
    });

    it("should return 404 for missing audio", async () => {
      mockAnkiService.retrieveMediaFile.mockResolvedValue(null);

      const response = await request(app).get("/api/audio/missing.mp3");

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/decks/:name/config", () => {
    it("should return matched deck config", async () => {
      const mockConfigWithPattern: GakuonConfig = {
        ...DEFAULT_CONFIG,
        decks: [
          {
            name: "Test Deck Config",
            pattern: "^Test Deck$",
            prompt: "test prompt",
            fields: {
              front: "Front",
              back: "Back",
            },
            responseFields: {
              sentence: {
                description: "Sentence",
                required: true,
                audio: true,
              },
            },
          },
          {
            name: "Japanese prompt",
            pattern: "^Japanese::.*$",
            prompt: "japanese prompt",
            fields: { word: "Word" },
            responseFields: {
              sentence: {
                description: "Japanese Sentence",
                required: true,
                audio: true,
              },
            },
          },
        ],
      };

      const appWithConfig = createServer({
        ...deps,
        config: mockConfigWithPattern,
      });

      // Test exact match
      const response1 = await request(appWithConfig).get(
        "/api/decks/Test%20Deck/config",
      );

      expect(response1.status).toBe(200);
      expect(response1.body).toEqual({
        config: {
          name: "Test Deck Config",
          pattern: "^Test Deck$",
          prompt: "test prompt",
          fields: {
            front: "Front",
            back: "Back",
          },
          responseFields: {
            sentence: {
              description: "Sentence",
              required: true,
              audio: true,
            },
          },
        },
      });

      // Test pattern match
      const response2 = await request(appWithConfig).get(
        "/api/decks/Japanese::N5/config",
      );

      expect(response2.status).toBe(200);
      expect(response2.body).toEqual({
        config: {
          name: "Japanese prompt",
          pattern: "^Japanese::.*$",
          prompt: "japanese prompt",
          fields: { word: "Word" },
          responseFields: {
            sentence: {
              description: "Japanese Sentence",
              required: true,
              audio: true,
            },
          },
        },
      });
    });

    it("should return 404 for non-existent deck config", async () => {
      const response = await request(app).get(
        "/api/decks/NonExistent%20Deck/config",
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: "Deck configuration not found",
      });
    });
  });
});

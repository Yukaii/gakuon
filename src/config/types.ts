import { z } from "zod";

export interface ResponseField {
  description: string;
  required: boolean;
  audio?: boolean; // Whether this field should be converted to audio
}

export type DeckConfig = z.infer<typeof DeckConfigSchema>;

// Remove CardContent interface as it will be dynamic
export type DynamicContent = Record<string, string>;

export class PromptError extends Error {
  constructor(
    message: string,
    public details: {
      missingFields?: string[];
      invalidFields?: string[];
      configIssues?: string[];
    },
  ) {
    super(message);
    this.name = "PromptError";
  }
}

export class AudioGenerationError extends Error {
  constructor(
    message: string,
    public details: { messages: string[] },
  ) {
    super(message);
    this.name = "AudioGenerationError";
  }
}

export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;

export type GakuonConfig = z.infer<typeof GakuonConfigSchema>;

export interface Card {
  cardId: number;
  deckName: string;
  modelName: string;
  fields: Record<string, { value: string; order: number }>;
  queue: number; // 0=new, 1=learning, 2=review
  due: number;
  interval: number;
  factor: number;
  reps: number;
  lapses: number;
  note: number;
}

export interface CardMeta {
  lastGenerated: string;
  content: Record<string, string>;
  audio: Record<string, string>;
}

export enum CardQueueType {
  NEW = 0,
  LEARNING = 1,
  REVIEW = 2,
}

export enum NewCardGatherOrder {
  DECK = "deck", // Alphabetical by deck name
  DECK_RANDOM_NOTES = "deck_random_notes",
  ASCENDING_POSITION = "ascending_position",
  DESCENDING_POSITION = "descending_position",
  RANDOM_NOTES = "random_notes",
  RANDOM_CARDS = "random_cards",
}

export enum ReviewSortOrder {
  DUE_DATE_RANDOM = "due_date_random",
  DUE_DATE_DECK = "due_date_deck",
  DECK_DUE_DATE = "deck_due_date",
  ASCENDING_INTERVALS = "ascending_intervals",
  DESCENDING_INTERVALS = "descending_intervals",
  ASCENDING_EASE = "ascending_ease",
  DESCENDING_EASE = "descending_ease",
  RELATIVE_OVERDUENESS = "relative_overdueness",
}

export enum QueueOrder {
  LEARNING_REVIEW_NEW = "learning_review_new", // Default
  REVIEW_LEARNING_NEW = "review_learning_new",
  NEW_LEARNING_REVIEW = "new_learning_review",
  MIXED = "mixed",
}

export enum TtsMethod {
  OPENAI = "openai",
  EDGE_TTS = "edge-tts",
}

export const OpenAIConfigSchema = z.object({
  baseUrl: z.string(),
  chatModel: z.string(),
  initModel: z.string(),
  ttsModel: z.string(),
});

export const CardOrderSchema = z.object({
  queueOrder: z.nativeEnum(QueueOrder),
  reviewOrder: z.nativeEnum(ReviewSortOrder),
  newCardOrder: z.nativeEnum(NewCardGatherOrder),
});

export const GlobalConfigSchema = z.object({
  ankiHost: z.string(),
  openaiApiKey: z.string(),
  ttsMethod: z.nativeEnum(TtsMethod),
  ttsVoice: z.string().optional(),
  defaultDeck: z.string().optional(),
  openai: OpenAIConfigSchema,
  cardOrder: CardOrderSchema,
});

export const DeckConfigSchema = z.object({
  name: z.string(),
  pattern: z.string(),
  fields: z.record(z.string()),
  prompt: z.string(),
  ttsVoice: z.string().optional(),
  responseFields: z.record(
    z.object({
      description: z.string(),
      required: z.boolean(),
      audio: z.boolean().optional(),
      locale: z.string().optional(),
      ttsVoice: z.string().optional(),
    }),
  ),
});

export const GakuonConfigSchema = z
  .object({
    global: GlobalConfigSchema,
    decks: z.array(DeckConfigSchema),
  })

  .refine(
    (data) =>
      data.global.ttsMethod !== TtsMethod.EDGE_TTS ||
      data.decks.every((deck) =>
        Object.values(deck.responseFields).every((field) => !!field.ttsVoice),
      ),
    {
      message: "responseFields.ttsVoice is required when ttsMethod is edge-tts",
      path: ["decks", "responseFields", "ttsVoice"],
    },
  );

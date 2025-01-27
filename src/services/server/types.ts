import type { AnkiService } from "../anki";
import type { OpenAIService } from "../openai";
import type { ContentManager } from "../content-manager";
import type { DynamicContent, Card, GakuonConfig } from "../../config/types";

export interface ServerDependencies {
  ankiService: AnkiService;
  openaiService: OpenAIService;
  contentManager: ContentManager;
  config: GakuonConfig;
  debug?: boolean;
}

export interface APIError {
  error: string;
  details?: unknown;
}

export interface CardResponse {
  id: number;
  content: DynamicContent;
  audioUrls: string[];
  queue: number;
  due: number;
  interval: number;
  factor: number;
  reps: number;
  lapses: number;
  fields: Card["fields"];
  metadata: Record<string, string>;
}

export interface DeckResponse {
  name: string;
  dueCount: number;
}

export interface AnswerRequest {
  ease: number;
}

export type CardWithContent = Card & {
  generatedContent?: DynamicContent;
  audioUrls?: string[];
};

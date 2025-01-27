export interface Deck {
  name: string;
}

export interface DecksResponse {
  decks: string[];
}

export interface Card {
  id: number;
  content: Record<string, string>;
  audioUrls: string[];
  queue: number;
  due: number;
  interval: number;
  factor: number;
  reps: number;
  lapses: number;
}

export interface DeckConfigResponse {
  config: {
    name: string;
    pattern?: string;
    prompt: string;
    fields: Record<string, string>;
    responseFields: Record<string, {
      description: string;
      required: boolean;
      audio?: boolean;
    }>;
  };
}

export interface CardAnswer {
  ease: number;
}

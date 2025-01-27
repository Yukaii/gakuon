export interface Deck {
  name: string;
}

export interface DecksResponse {
  decks: string[];
}

export interface Card {
  cardId: number;
  queue: number;
  due: number;
  interval: number;
  factor: number;
  reps: number;
  lapses: number;
  fields: Record<string, string>;
}

export type CardWithMeta = Card & {
  content: Record<string, string>;
  audioUrls: string[];
  metadata: {
    lastGenerated: string;
    content: Record<string, string>;
    audio: Record<string, string>;
  };
};

export interface DeckConfigResponse {
  config: {
    name: string;
    pattern?: string;
    prompt: string;
    fields: Record<string, string>;
    responseFields: Record<
      string,
      {
        description: string;
        required: boolean;
        audio?: boolean;
      }
    >;
  };
}

export interface CardAnswer {
  ease: number;
}

export interface DeckConfig {
  name: string;
  pattern: string;
  fields: {
    front: string;
    back: string;
    example?: string;
    notes?: string;
  };
  prompt: string;
}

export interface GakuonConfig {
  global: {
    ankiHost: string;
    openaiApiKey: string;
    audioDir: string;
    ttsVoice: string;
    language: {
      target: string;
      native: string;
    };
    defaultDeck: string;
  };
  decks: DeckConfig[];
}

export interface CardContent {
  sentence: string;
  targetExplanation: string;
  nativeExplanation: string;
}

export interface Card {
  cardId: number;
  deckName: string;
  modelName: string;
  fields: Record<string, { value: string; order: number }>;
  queue: number;  // 0=new, 1=learning, 2=review
  due: number;
  interval: number;
  factor: number;
  reps: number;
  lapses: number;
  note: number;
}

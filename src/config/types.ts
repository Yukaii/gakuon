export interface ResponseField {
  description: string;
  required: boolean;
  audio?: boolean;  // Whether this field should be converted to audio
}

export interface DeckConfig {
  name: string;
  pattern: string;
  fields: Record<string, string>;  // Input fields mapping
  prompt: string;
  responseFields: Record<string, ResponseField>;  // Output fields configuration
}

// Remove CardContent interface as it will be dynamic
export type DynamicContent = Record<string, string>;

// Default response format if not specified in config
export const DEFAULT_RESPONSE_FORMAT = {
  fields: {
    sentence: {
      description: "A natural example sentence",
      required: true
    },
    targetExplanation: {
      description: "Explanation in target language",
      required: true
    },
    nativeExplanation: {
      description: "Explanation in native language",
      required: true
    }
  }
};

export class PromptError extends Error {
  constructor(
    message: string,
    public details: {
      missingFields?: string[];
      invalidFields?: string[];
      configIssues?: string[];
    }
  ) {
    super(message);
    this.name = 'PromptError';
  }
}

export interface GakuonConfig {
  global: {
    ankiHost: string;
    openaiApiKey: string;
    ttsVoice: string;
    language: {
      target: string;
      native: string;
    };
    defaultDeck: string;
    cardOrder: {
      queueOrder: QueueOrder;
      reviewOrder: ReviewSortOrder;
      newCardOrder: NewCardGatherOrder;
    };
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

export enum CardQueueType {
  NEW = 0,
  LEARNING = 1,
  REVIEW = 2
}

export enum NewCardGatherOrder {
  DECK = 'deck',                    // Alphabetical by deck name
  DECK_RANDOM_NOTES = 'deck_random_notes',
  ASCENDING_POSITION = 'ascending_position',
  DESCENDING_POSITION = 'descending_position',
  RANDOM_NOTES = 'random_notes',
  RANDOM_CARDS = 'random_cards'
}

export enum ReviewSortOrder {
  DUE_DATE_RANDOM = 'due_date_random',
  DUE_DATE_DECK = 'due_date_deck',
  DECK_DUE_DATE = 'deck_due_date',
  ASCENDING_INTERVALS = 'ascending_intervals',
  DESCENDING_INTERVALS = 'descending_intervals',
  ASCENDING_EASE = 'ascending_ease',
  DESCENDING_EASE = 'descending_ease',
  RELATIVE_OVERDUENESS = 'relative_overdueness'
}

export enum QueueOrder {
  LEARNING_REVIEW_NEW = 'learning_review_new',    // Default
  REVIEW_LEARNING_NEW = 'review_learning_new',
  NEW_LEARNING_REVIEW = 'new_learning_review',
  MIXED = 'mixed'
}

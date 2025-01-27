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

export interface CardAnswer {
  ease: number;
}

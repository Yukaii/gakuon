import { delay } from '../utils/time';

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
}

export class AnkiService {
  constructor(private host: string) {}

  private async request<T>(action: string, params = {}): Promise<T> {
    const response = await fetch(this.host, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, version: 6, params })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  }

  async answerCard(cardId: number, ease: number): Promise<boolean> {
    if (!cardId) return false;

    const exists = await this.request<[boolean]>('answerCards', {
      answers: [{
        cardId,
        ease,
      }]
    });

    if (!exists) {
      throw new Error(`Card with ID: [${cardId}] doesn't exist in this deck`);
    }

    return true;
  }

  async findCards(deckName: string): Promise<number[]> {
    const deckQuery = `"deck:${deckName}"`;
    return await this.request<number[]>('findCards', {
      query: deckQuery,
    });
  }

  async getCardsInfo(cardIds: number[]): Promise<Card[]> {
    if (!cardIds?.length) return [];
    return await this.request<Card[]>('cardsInfo', {
      cards: cardIds,
    });
  }

  async areDue(cardIds: number[]): Promise<boolean[]> {
    if (!cardIds?.length) return [];
    return await this.request<boolean[]>('areDue', {
      cards: cardIds,
    });
  }

  async getDueCardsInfo(deckName: string): Promise<Card[]> {
    // Find all cards in the deck
    const cardIds = await this.findCards(deckName);
    if (!cardIds?.length) return [];

    // Get card information
    const cardsInfo = await this.getCardsInfo(cardIds);
    await delay(1000); // Add delay as in the Raycast implementation

    // Check which cards are due
    const cardsDue = await this.areDue(cardIds);

    // Filter and sort cards
    return cardsInfo
      .filter((_, i) => cardsDue[i])
      .sort((a, b) => {
        // First, sort by queue type (review > learning > new)
        if (a.queue !== b.queue) {
          return b.queue - a.queue;
        }
        // For review cards, sort by due date
        if (a.queue === 2) {
          return a.due - b.due;
        }
        // For new cards, maintain their original order
        if (a.queue === 0) {
          return a.due - b.due;
        }
        return 0;
      });
  }
}

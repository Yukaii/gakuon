import { delay } from '../utils/time';
import type { Card, CardContent } from '../config/types'

export class AnkiService {
  constructor(private host: string) {}

  private async request<T>(action: string, params = {}): Promise<T> {
    const response = await fetch(this.host, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, version: 6, params })
    });
    const data = await response.json();
    if (data.error) {
      console.log('action, params', action, params);
      throw new Error(data.error);
    }
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
    await delay(1000);

    // Check which cards are due
    const cardsDue = await this.areDue(cardIds);

    // Filter due cards
    const dueCards = cardsInfo.filter((_, i) => cardsDue[i]);

    // Sort cards by type and due date
    return dueCards.sort((a, b) => {
      // Learning cards (queue=1) first
      if (a.queue === 1 && b.queue !== 1) return -1;
      if (b.queue === 1 && a.queue !== 1) return 1;

      // Then review cards (queue=2)
      if (a.queue === 2 && b.queue !== 2) return -1;
      if (b.queue === 2 && a.queue !== 2) return 1;

      // Then new cards (queue=0)
      if (a.queue === 0 && b.queue !== 0) return -1;
      if (b.queue === 0 && a.queue !== 0) return 1;

      // Within same queue type, sort by due date
      return a.due - b.due;
    });
  }

  async storeMediaFile(filename: string, path: string): Promise<string> {
    return this.request('storeMediaFile', {
      filename,
      path,
      deleteExisting: true
    });
  }

  async updateNote(noteId: number, fields: Record<string, string>): Promise<boolean> {
    return this.request('updateNoteFields', {
      note: {
        id: noteId,
        fields
      }
    });
  }

  async hasGeneratedContent(card: Card): Promise<boolean> {
    // Check if there's a Comment or Note field we can use
    const commentField = card.fields['Comment'] || card.fields['Notes'] || card.fields['Note'];
    if (!commentField) return false;

    try {
      const metadata = JSON.parse(commentField.value);
      return Boolean(
        metadata.gakuon &&
        metadata.gakuon.lastGenerated &&
        metadata.gakuon.sentence
      );
    } catch {
      return false;
    }
  }

  async getCardMetadata(card: Card): Promise<any> {
    const commentField = card.fields['Comment'] || card.fields['Notes'] || card.fields['Note'];
    if (!commentField) return {};

    try {
      const metadata = JSON.parse(commentField.value);
      return metadata.gakuon || {};
    } catch {
      return {};
    }
  }

  async updateCardMetadata(card: Card, content: CardContent, audioNames: string[]): Promise<boolean> {
    const commentField = card.fields['Comment'] || card.fields['Notes'] || card.fields['Note'];
    if (!commentField) {
      console.warn('No Comment/Notes field found to store metadata');
      return false;
    }

    let existingData = {};
    try {
      existingData = JSON.parse(commentField.value);
    } catch {
      // If parsing fails, start with empty object
    }

    const updatedData = {
      ...existingData,
      gakuon: {
        lastGenerated: new Date().toISOString(),
        sentence: content.sentence,
        targetExplanation: content.targetExplanation,
        nativeExplanation: content.nativeExplanation,
        audioSentence: audioNames[0],
        audioTarget: audioNames[1],
        audioNative: audioNames[2]
      }
    };

    // Update the note with the new metadata
    return this.updateNote(card.note, {
      [commentField.value]: JSON.stringify(updatedData, null, 2)
    });
  }
}

import { delay } from '../utils/time';
import type { Card, CardContent } from '../config/types'

const GAKUON_FIELD = 'Gakuon-Meta';

export class AnkiService {
  private modelFieldsCache: Map<string, string[]> = new Map();

  constructor(private host: string, private debug: boolean = false) {}

  private debugLog(...args: any[]) {
    if (this.debug) {
      console.log('[AnkiService Debug]', ...args);
    }
  }

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

  async updateNoteFields(noteId: number, fields: Record<string, string>): Promise<boolean> {
    return this.request('updateNoteFields', {
      note: {
        id: noteId,
        fields
      }
    });
  }

  async hasGeneratedContent(card: Card): Promise<boolean> {
    // Check if there's a Comment or Note field we can use
    const commentField = card.fields[GAKUON_FIELD];
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
    const commentField = card.fields[GAKUON_FIELD];
    if (!commentField) return {};

    try {
      const metadata = JSON.parse(commentField.value);
      return metadata.gakuon || {};
    } catch {
      return {};
    }
  }

  async initializeModels(): Promise<void> {
    const modelNames = await this.request<string[]>('modelNames');
    this.debugLog('Found models:', modelNames);

    for (const modelName of modelNames) {
      const fields = await this.getModelFields(modelName);
      this.modelFieldsCache.set(modelName, fields);
      this.debugLog(`Cached fields for model ${modelName}:`, fields);
    }
  }

  private async getModelFields(modelName: string): Promise<string[]> {
    const modelData = await this.request<string[]>('modelFieldNames', {
      modelName
    });
    return modelData;
  }

  private async extendModelWithGakuonField(modelName: string): Promise<boolean> {
    const fields = this.modelFieldsCache.get(modelName);
    if (!fields) {
      throw new Error(`Model ${modelName} not found in cache`);
    }

    // Check if field already exists
    if (fields.includes(GAKUON_FIELD)) {
      this.debugLog(`Model ${modelName} already has Gakuon field`);
      return true;
    }

    // Add new field to model
    try {
      // Use modelFieldAdd instead of addField
      await this.request('modelFieldAdd', {
        modelName,
        fieldName: GAKUON_FIELD
        // field will be added at the end by default
      });

      // Update cache
      this.modelFieldsCache.set(modelName, [...fields, GAKUON_FIELD]);
      this.debugLog(`Added Gakuon field to model ${modelName}`);
      return true;
    } catch (error) {
      console.error(`Failed to extend model ${modelName}:`, error);
      return false;
    }
  }

  async ensureGakuonField(card: Card): Promise<boolean> {
    const fields = this.modelFieldsCache.get(card.modelName);

    if (!fields) {
      // If model not in cache, refresh cache
      this.debugLog(`Model ${card.modelName} not in cache, refreshing...`);
      await this.initializeModels();
    }

    if (!this.modelFieldsCache.get(card.modelName)?.includes(GAKUON_FIELD)) {
      this.debugLog(`Extending model ${card.modelName} with Gakuon field`);
      return this.extendModelWithGakuonField(card.modelName);
    }

    return true;
  }

  async updateCardMetadata(card: Card, content: CardContent, audioNames: string[]): Promise<boolean> {
    this.debugLog('Updating card metadata');

    try {
      // Ensure model has Gakuon field
      await this.ensureGakuonField(card);

      let existingData = {};
      try {
        if (card.fields[GAKUON_FIELD]) {
          existingData = JSON.parse(card.fields[GAKUON_FIELD].value);
        }
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

      return this.updateNoteFields(card.note, {
        [GAKUON_FIELD]: JSON.stringify(updatedData, null, 2)
      });
    } catch (error) {
      console.error('Failed to update card metadata:', error);
      return false;
    }
  }
}

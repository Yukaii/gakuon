import { delay } from "../utils/time";
import {
  type Card,
  CardQueueType,
  QueueOrder,
  ReviewSortOrder,
  NewCardGatherOrder,
} from "../config/types";

const GAKUON_FIELD = "Gakuon-Meta";

export class AnkiService {
  private modelFieldsCache: Map<string, string[]> = new Map();

  constructor(
    private host: string,
    private debug = false,
  ) {}

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  private debugLog(...args: any[]) {
    if (this.debug) {
      console.log("[AnkiService Debug]", ...args);
    }
  }

  private async request<T>(action: string, params = {}): Promise<T> {
    const response = await fetch(this.host, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, version: 6, params }),
    });
    const data = await response.json();
    if (data.error) {
      console.log("action, params", action, params);
      throw new Error(data.error);
    }
    return data.result;
  }

  async answerCard(cardId: number, ease: number): Promise<boolean> {
    if (!cardId) return false;

    const exists = await this.request<[boolean]>("answerCards", {
      answers: [
        {
          cardId,
          ease,
        },
      ],
    });

    if (!exists.length || !exists[0]) {
      return false;
    }

    return true;
  }

  async findCards(deckName: string): Promise<number[]> {
    const deckQuery = `"deck:${deckName}"`;
    return await this.request<number[]>("findCards", {
      query: deckQuery,
    });
  }

  async getCardsInfo(cardIds: number[]): Promise<Card[]> {
    if (!cardIds?.length) return [];
    return await this.request<Card[]>("cardsInfo", {
      cards: cardIds,
    });
  }

  async areDue(cardIds: number[]): Promise<boolean[]> {
    if (!cardIds?.length) return [];
    return await this.request<boolean[]>("areDue", {
      cards: cardIds,
    });
  }

  private sortByReviewOrder(cards: Card[], order: ReviewSortOrder): Card[] {
    return cards.sort((a, b) => {
      switch (order) {
        case ReviewSortOrder.DUE_DATE_RANDOM:
          return a.due - b.due || Math.random() - 0.5;
        case ReviewSortOrder.DUE_DATE_DECK:
          return a.due - b.due || a.deckName.localeCompare(b.deckName);
        case ReviewSortOrder.DECK_DUE_DATE:
          return a.deckName.localeCompare(b.deckName) || a.due - b.due;
        case ReviewSortOrder.ASCENDING_INTERVALS:
          return a.interval - b.interval;
        case ReviewSortOrder.DESCENDING_INTERVALS:
          return b.interval - a.interval;
        case ReviewSortOrder.ASCENDING_EASE:
          return a.factor - b.factor;
        case ReviewSortOrder.DESCENDING_EASE:
          return b.factor - a.factor;
        case ReviewSortOrder.RELATIVE_OVERDUENESS: {
          const aOverdue = (Date.now() / 1000 - a.due) / a.interval;
          const bOverdue = (Date.now() / 1000 - b.due) / b.interval;
          return bOverdue - aOverdue;
        }
        default:
          return a.due - b.due;
      }
    });
  }

  private sortByNewCardOrder(cards: Card[], order: NewCardGatherOrder): Card[] {
    return cards.sort((a, b) => {
      switch (order) {
        case NewCardGatherOrder.DECK:
          return a.deckName.localeCompare(b.deckName);
        case NewCardGatherOrder.ASCENDING_POSITION:
          return a.due - b.due;
        case NewCardGatherOrder.DESCENDING_POSITION:
          return b.due - a.due;
        case NewCardGatherOrder.RANDOM_CARDS:
          return Math.random() - 0.5;
        case NewCardGatherOrder.RANDOM_NOTES:
          return a.note - b.note || Math.random() - 0.5;
        case NewCardGatherOrder.DECK_RANDOM_NOTES:
          return (
            a.deckName.localeCompare(b.deckName) ||
            a.note - b.note ||
            Math.random() - 0.5
          );
        default:
          return 0;
      }
    });
  }

  async getDueCardsInfo(
    deckName: string,
    queueOrder: QueueOrder = QueueOrder.LEARNING_REVIEW_NEW,
    reviewOrder: ReviewSortOrder = ReviewSortOrder.DUE_DATE_RANDOM,
    newCardOrder: NewCardGatherOrder = NewCardGatherOrder.DECK,
  ): Promise<Card[]> {
    const cardIds = await this.findCards(deckName);
    if (!cardIds?.length) return [];

    const cardsInfo = await this.getCardsInfo(cardIds);
    await delay(1000);

    const cardsDue = await this.areDue(cardIds);
    const dueCards = cardsInfo.filter((_, i) => cardsDue[i]);

    // Split cards by queue type
    const newCards = dueCards.filter((c) => c.queue === CardQueueType.NEW);
    const learningCards = dueCards.filter(
      (c) => c.queue === CardQueueType.LEARNING,
    );
    const reviewCards = dueCards.filter(
      (c) => c.queue === CardQueueType.REVIEW,
    );

    // Sort each category
    const sortedNewCards = this.sortByNewCardOrder(newCards, newCardOrder);
    const sortedReviewCards = this.sortByReviewOrder(reviewCards, reviewOrder);
    const sortedLearningCards = this.sortByReviewOrder(
      learningCards,
      reviewOrder,
    );

    // Combine based on queue order
    let result: Card[];
    switch (queueOrder) {
      case QueueOrder.LEARNING_REVIEW_NEW:
        result = [
          ...sortedLearningCards,
          ...sortedReviewCards,
          ...sortedNewCards,
        ];
        break;
      case QueueOrder.REVIEW_LEARNING_NEW:
        result = [
          ...sortedReviewCards,
          ...sortedLearningCards,
          ...sortedNewCards,
        ];
        break;
      case QueueOrder.NEW_LEARNING_REVIEW:
        result = [
          ...sortedNewCards,
          ...sortedLearningCards,
          ...sortedReviewCards,
        ];
        break;
      case QueueOrder.MIXED:
        result = [
          ...sortedLearningCards,
          ...sortedReviewCards,
          ...sortedNewCards,
        ].sort(() => Math.random() - 0.5);
        break;
      default:
        result = [
          ...sortedLearningCards,
          ...sortedReviewCards,
          ...sortedNewCards,
        ];
    }

    return result;
  }

  async storeMediaFile(filename: string, path: string): Promise<string> {
    return this.request("storeMediaFile", {
      filename,
      path,
      deleteExisting: true,
    });
  }

  async updateNoteFields(
    noteId: number,
    fields: Record<string, string>,
  ): Promise<boolean> {
    return this.request("updateNoteFields", {
      note: {
        id: noteId,
        fields,
      },
    });
  }

  async hasGeneratedContent(card: Card): Promise<boolean> {
    // Check if there's a Comment or Note field we can use
    const commentField = card.fields[GAKUON_FIELD];
    if (!commentField) return false;

    try {
      const metadata = JSON.parse(commentField.value);
      return Boolean(
        metadata.gakuon?.lastGenerated && metadata.gakuon.sentence,
      );
    } catch {
      return false;
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  async getCardMetadata(card: Card): Promise<any> {
    const commentField = card?.fields?.[GAKUON_FIELD];
    if (!commentField) return {};

    try {
      const metadata = JSON.parse(commentField.value);
      return metadata.gakuon || {};
    } catch {
      return {};
    }
  }

  async initializeModels(): Promise<void> {
    const modelNames = await this.request<string[]>("modelNames");
    this.debugLog("Found models:", modelNames);

    for (const modelName of modelNames) {
      const fields = await this.getModelFields(modelName);
      this.modelFieldsCache.set(modelName, fields);
      this.debugLog(`Cached fields for model ${modelName}:`, fields);
    }
  }

  private async getModelFields(modelName: string): Promise<string[]> {
    const modelData = await this.request<string[]>("modelFieldNames", {
      modelName,
    });
    return modelData;
  }

  private async extendModelWithGakuonField(
    modelName: string,
  ): Promise<boolean> {
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
      await this.request("modelFieldAdd", {
        modelName,
        fieldName: GAKUON_FIELD,
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

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  async updateCardMetadata(card: Card, metadata: any): Promise<boolean> {
    try {
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
        gakuon: metadata,
      };

      return this.updateNoteFields(card.note, {
        [GAKUON_FIELD]: JSON.stringify(updatedData, null, 2),
      });
    } catch (error) {
      console.error("Failed to update card metadata:", error);
      return false;
    }
  }

  async retrieveMediaFile(filename: string): Promise<string | null> {
    try {
      const result = await this.request<string>("retrieveMediaFile", {
        filename,
      });
      return result;
    } catch (error) {
      console.error("Error retrieving media file:", error);
      return null;
    }
  }

  async getDeckNames(): Promise<string[]> {
    return this.request<string[]>("deckNames");
  }

  async sync(): Promise<void> {
    try {
      await this.request("sync", {});
    } catch (e: unknown) {
      if (
        (e as { message?: string })?.message?.includes("auth not configured")
      ) {
        // Skip syncing when auth is not configured
        return;
      }
      throw e;
    }
  }
}

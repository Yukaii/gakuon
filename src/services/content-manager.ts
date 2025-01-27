import { AnkiService } from "./anki";
import { OpenAIService } from "./openai";
import type { Card, DeckConfig, DynamicContent } from "../config/types";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

export class ContentManager {
  private tmpDir = tmpdir();

  constructor(
    private ankiService: AnkiService,
    private openaiService: OpenAIService,
    private debug = false,
  ) {
    this.debugLog("Using tmpDir", this.tmpDir);
  }

  private debugLog(...args: any[]) {
    if (this.debug) {
      console.log("[ContentManager]", ...args);
    }
  }

  private generateTempFilename(cardId: number, type: string): string {
    const random = randomBytes(4).toString("hex");
    return join(this.tmpDir, `gakuon_${cardId}_${type}_${random}.mp3`);
  }

  async getOrGenerateContent(
    card: Card,
    deckConfig: DeckConfig,
    forceRegenerate = false,
  ): Promise<{
    content: DynamicContent;
    audioFiles: Promise<string>[];
    isNewContent: boolean;
  }> {
    // Check for existing content
    if (
      !forceRegenerate &&
      (await this.ankiService.hasGeneratedContent(card))
    ) {
      this.debugLog("Using existing content for card:", card.cardId);
      return this.getExistingContent(card);
    }

    // Generate new content
    this.debugLog("Generating new content for card:", card.cardId);
    return this.generateAndStoreContent(card, deckConfig);
  }

  private async getExistingContent(card: Card) {
    const metadata = await this.ankiService.getCardMetadata(card);

    // Get stored content
    const content = metadata.content || {};

    // Get audio references
    const audioFiles = Object.entries(metadata.audio || {}).map(
      ([_, reference]) => Promise.resolve(reference as string),
    );

    return { content, audioFiles, isNewContent: false };
  }

  private async generateAndStoreContent(card: Card, deckConfig: DeckConfig) {
    // Generate content
    const content = await this.openaiService.generateContent(card, deckConfig);

    // Generate audio for fields that need it
    const audioPromises: Promise<string>[] = [];
    const audioMap: Record<string, string> = {};

    for (const [field, fieldConfig] of Object.entries(
      deckConfig.responseFields,
    )) {
      if (fieldConfig.audio && content[field]) {
        const tempPath = this.generateTempFilename(card.cardId, field);
        const audioPromise = this.openaiService.generateAudio(
          content[field],
          tempPath,
          "alloy",
        );
        audioPromises.push(audioPromise);

        // Store in Anki and get reference
        const audioFile = await audioPromise;
        const filename = `gakuon_${card.cardId}_${field}.mp3`;
        await this.ankiService.storeMediaFile(filename, audioFile);
        audioMap[field] = `[sound:${filename}]`;
      }
    }

    // Store metadata
    await this.ankiService.updateCardMetadata(card, {
      lastGenerated: new Date().toISOString(),
      content,
      audio: audioMap,
    });

    return {
      content,
      audioFiles: audioPromises,
      isNewContent: true,
    };
  }
}

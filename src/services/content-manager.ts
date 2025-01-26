import { AnkiService } from './anki';
import { OpenAIService } from './openai';
import type { Card, CardContent, DeckConfig } from '../config/types';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

export class ContentManager {
  private tmpDir = tmpdir()

  constructor(
    private ankiService: AnkiService,
    private openaiService: OpenAIService,
    private debug = false
  ) {
    this.debugLog('Using tmpDir',this.tmpDir)
  }

  private debugLog(...args: any[]) {
    if (this.debug) {
      console.log('[ContentManager]', ...args);
    }
  }

  private generateTempFilename(cardId: number, type: string): string {
    const random = randomBytes(4).toString('hex');
    return join(this.tmpDir, `gakuon_${cardId}_${type}_${random}.mp3`);
  }

  async getOrGenerateContent(
    card: Card,
    deckConfig: DeckConfig,
    forceRegenerate = false
  ): Promise<{
    content: CardContent;
    audioFiles: Promise<string>[];
    isNewContent: boolean;
  }> {
    // Check for existing content
    if (!forceRegenerate && await this.ankiService.hasGeneratedContent(card)) {
      this.debugLog('Using existing content for card:', card.cardId);
      return this.getExistingContent(card);
    }

    // Generate new content
    this.debugLog('Generating new content for card:', card.cardId);
    return this.generateAndStoreContent(card, deckConfig);
  }

  private async getExistingContent(card: Card) {
    const metadata = await this.ankiService.getCardMetadata(card);

    const content: CardContent = {
      sentence: metadata.sentence,
      targetExplanation: metadata.targetExplanation,
      nativeExplanation: metadata.nativeExplanation
    };

    // These are the stored [sound:filename] references
    const audioFiles = [
      Promise.resolve(metadata.audioSentence),
      Promise.resolve(metadata.audioTarget),
      Promise.resolve(metadata.audioNative)
    ];

    return { content, audioFiles, isNewContent: false };
  }

  private async generateAndStoreContent(card: Card, deckConfig: DeckConfig) {
    // Generate content
    const content = await this.openaiService.generateContent(card, deckConfig);

    // Generate audio files in temp directory
    const audioPromises = [
      this.openaiService.generateAudio(
        content.sentence,
        this.generateTempFilename(card.cardId, 'sentence'),
        'alloy'
      ),
      this.openaiService.generateAudio(
        content.targetExplanation,
        this.generateTempFilename(card.cardId, 'target'),
        'alloy'
      ),
      this.openaiService.generateAudio(
        content.nativeExplanation,
        this.generateTempFilename(card.cardId, 'native'),
        'alloy'
      )
    ];

    // Wait for audio generation and store in Anki
    const audioFiles = await Promise.all(audioPromises);
    const audioNames = await Promise.all(
      audioFiles.map(async (filepath, index) => {
        const filename = `gakuon_${card.cardId}_${index}.mp3`;
        this.debugLog('Storing audio file in Anki:', filename);
        await this.ankiService.storeMediaFile(filename, filepath);
        return `[sound:${filename}]`;
      })
    );

    // Store metadata in card's comment/notes field
    await this.ankiService.updateCardMetadata(card, content, audioNames);

    return {
      content,
      audioFiles: audioPromises,
      isNewContent: true
    };
  }
}

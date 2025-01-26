import { AnkiService } from './anki';
import { OpenAIService } from './openai';
import type { Card, CardContent, DeckConfig } from '../config/types';

export class ContentManager {
  constructor(
    private ankiService: AnkiService,
    private openaiService: OpenAIService,
    private audioDir: string
  ) {}

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
      return this.getExistingContent(card);
    }

    // Generate new content
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

    // Generate audio files
    const audioPromises = [
      this.openaiService.generateAudio(
        content.sentence,
        `${card.cardId}_sentence.mp3`,
        this.audioDir,
        'alloy'
      ),
      this.openaiService.generateAudio(
        content.targetExplanation,
        `${card.cardId}_target.mp3`,
        this.audioDir,
        'alloy'
      ),
      this.openaiService.generateAudio(
        content.nativeExplanation,
        `${card.cardId}_native.mp3`,
        this.audioDir,
        'alloy'
      )
    ];

    // Wait for audio generation and store in Anki
    const audioFiles = await Promise.all(audioPromises);
    const audioNames = await Promise.all(
      audioFiles.map(async (filepath, index) => {
        const filename = `gakuon_${card.cardId}_${index}.mp3`;
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

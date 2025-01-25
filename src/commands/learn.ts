import { mkdir } from 'fs/promises';
import { loadConfig, findDeckConfig } from '../config/loader';
import { OpenAIService } from '../services/openai';
import { AnkiService, type Card } from '../services/anki';
import { playAudio } from '../services/audio';
import { waitForKeyPress, displayControls } from '../utils/keyboard';
import type { CardContent, DeckConfig } from '../config/types';

interface AudioGeneration {
  content: CardContent;
  audioFiles: Promise<string>[];
}

async function generateCardAudio(
  card: Card,
  deckConfig: DeckConfig,
  openaiService: OpenAIService,
  audioDir: string,
  ttsVoice: string
): Promise<AudioGeneration> {
  const content = await openaiService.generateContent(card, deckConfig);

  const audioFiles = [
    openaiService.generateAudio(
      content.sentence,
      `${card.cardId}_sentence.mp3`,
      audioDir,
      ttsVoice
    ),
    openaiService.generateAudio(
      content.targetExplanation,
      `${card.cardId}_target.mp3`,
      audioDir,
      ttsVoice
    ),
    openaiService.generateAudio(
      content.nativeExplanation,
      `${card.cardId}_native.mp3`,
      audioDir,
      ttsVoice
    )
  ];

  return { content, audioFiles };
}

export async function learn() {
  try {
    const config = loadConfig();
    const ankiService = new AnkiService(config.global.ankiHost);
    const openaiService = new OpenAIService(config.global.openaiApiKey);

    await mkdir(config.global.audioDir, { recursive: true });

    const dueCards = await ankiService.getDueCardsInfo(config.global.defaultDeck);

    if (dueCards.length === 0) {
      console.log('No cards due for review!');
      return;
    }

    console.log(`Starting review session with ${dueCards.length} cards...`);
    console.log('Controls: SPACE to play, 1-4 to rate, Q to quit, R to replay');

    // Prefetch queue for next cards
    const prefetchQueue: AudioGeneration[] = [];
    const MAX_PREFETCH = 2;

    // Helper function to start prefetching
    async function startPrefetch(startIdx: number) {
      for (let i = startIdx; i < Math.min(startIdx + MAX_PREFETCH, dueCards.length); i++) {
        const card = dueCards[i];
        const deckConfig = findDeckConfig(card.deckName, config.decks);
        if (deckConfig) {
          const audioGen = generateCardAudio(
            card,
            deckConfig,
            openaiService,
            config.global.audioDir,
            config.global.ttsVoice
          );
          prefetchQueue.push(await audioGen);
        }
      }
    }

    // Start initial prefetch
    await startPrefetch(0);

    for (let currentIdx = 0; currentIdx < dueCards.length; currentIdx++) {
      const card = dueCards[currentIdx];
      const deckConfig = findDeckConfig(card.deckName, config.decks);
      if (!deckConfig) {
        console.error(`No configuration found for deck: ${card.deckName}`);
        continue;
      }

      // Get current card's audio (either from prefetch or generate new)
      let currentAudio = prefetchQueue.shift();
      if (!currentAudio) {
        currentAudio = await generateCardAudio(
          card,
          deckConfig,
          openaiService,
          config.global.audioDir,
          config.global.ttsVoice
        );
      }

      // Start prefetching next cards if queue is getting low
      if (prefetchQueue.length < MAX_PREFETCH) {
        startPrefetch(currentIdx + 1 + prefetchQueue.length);
      }

      const { content, audioFiles } = currentAudio;

      // Display generated content
      console.log('\nGenerated content:');
      console.log('1. Example sentence:', content.sentence);
      console.log('2. Japanese explanation:', content.targetExplanation);
      console.log('3. English explanation:', content.nativeExplanation);

      // Progressive audio playback
      console.log('\nPlaying audio...');
      const sections = ['Example sentence', 'Japanese explanation', 'English explanation'];

      for (let i = 0; i < audioFiles.length; i++) {
        console.log(`\nPlaying ${sections[i]}...`);
        const audioFile = await audioFiles[i];
        await playAudio(audioFile);
      }

      // Interactive review loop
      let playing = true;
      displayControls();

      while (playing) {
        const key = await waitForKeyPress();

        switch (key) {
          case ' ':
            console.log('\nReplaying all audio...');
            for (let i = 0; i < audioFiles.length; i++) {
              console.log(`\nPlaying ${sections[i]}...`);
              const audioFile = await audioFiles[i];
              await playAudio(audioFile);
            }
            break;
          case 'r':
            console.log('\nReplaying example sentence...');
            const sentenceAudio = await audioFiles[0];
            await playAudio(sentenceAudio);
            break;
          case 'q':
            console.log('\nExiting review session...');
            return;
          case '1':
          case '2':
          case '3':
          case '4':
            const success = await ankiService.answerCard(
              card.cardId,
              parseInt(key, 10)
            );
            if (success) {
              playing = false;
            } else {
              console.log('Failed to answer card. Please try again.');
            }
            break;
        }
      }
    }

    console.log('\nReview session completed!');
  } catch (error) {
    console.error('Error during review:', error);
  }
}

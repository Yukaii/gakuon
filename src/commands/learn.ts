import { mkdir } from 'fs/promises';
import { loadConfig, findDeckConfig } from '../config/loader';
import { OpenAIService } from '../services/openai';
import { AnkiService } from '../services/anki';
import { AudioPlayer } from '../services/audio';
import { KeyAction, KeyboardHandler } from '../utils/keyboard';
import type { CardContent, DeckConfig, Card } from '../config/types';
import { ContentManager } from '../services/content-manager';

interface AudioGeneration {
  content: CardContent;
  audioFiles: Promise<string>[];
  isNewContent?: boolean;
}

async function getCardContent(
  card: Card,
  deckConfig: DeckConfig,
  contentManager: ContentManager,
  forceRegenerate = false
): Promise<AudioGeneration> {
  const { content, audioFiles, isNewContent } = await contentManager.getOrGenerateContent(
    card,
    deckConfig,
    forceRegenerate
  );
  return { content, audioFiles, isNewContent };
}

export async function learn() {
  const audioPlayer = new AudioPlayer();
  const keyboard = new KeyboardHandler();

  try {
    const config = loadConfig();
    const ankiService = new AnkiService(config.global.ankiHost);
    const openaiService = new OpenAIService(config.global.openaiApiKey);
    const contentManager = new ContentManager(ankiService, openaiService, config.global.audioDir);

    keyboard.start();

    await mkdir(config.global.audioDir, { recursive: true });

    const dueCards = await ankiService.getDueCardsInfo(config.global.defaultDeck);

    if (dueCards.length === 0) {
      console.log('No cards due for review!');
      return;
    }

    console.log(`Starting review session with ${dueCards.length} cards...`);

    // Prefetch queue for next cards
    const prefetchQueue: AudioGeneration[] = [];
    const MAX_PREFETCH = 2;

    // Helper function to start prefetching
    async function startPrefetch(startIdx: number) {
      for (let i = startIdx; i < Math.min(startIdx + MAX_PREFETCH, dueCards.length); i++) {
        const card = dueCards[i];
        const deckConfig = findDeckConfig(card.deckName, config.decks);
        if (deckConfig) {
          const audioGen = getCardContent(card, deckConfig, contentManager);
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
        currentAudio = await getCardContent(card, deckConfig, contentManager);
      }

      // Start prefetching next cards if queue is getting low
      if (prefetchQueue.length < MAX_PREFETCH) {
        startPrefetch(currentIdx + 1 + prefetchQueue.length);
      }

      const { content, audioFiles, isNewContent } = currentAudio;
      let isCardComplete = false;

      console.clear();
      console.log(`Card ${currentIdx + 1}/${dueCards.length}`);
      console.log('\nGenerated content:');
      console.log('1. Example sentence:', content.sentence);
      console.log('2. Japanese explanation:', content.targetExplanation);
      console.log('3. English explanation:', content.nativeExplanation);
      if (!isNewContent) {
        console.log('\n(Using cached content. Press G to regenerate)');
      }
      keyboard.displayControls();

      // Progressive audio playback
      console.log('\nPlaying audio...');
      const sections = ['Example sentence', 'Japanese explanation', 'English explanation'];

      // Initial audio playback
      const resolvedAudioFiles = await Promise.all(audioFiles);

      // Event handling
      keyboard.on(KeyAction.PLAY_ALL, async () => {
        for (const [index, audioFile] of resolvedAudioFiles.entries()) {
          if (!isCardComplete) {
            console.log(`\nPlaying ${sections[index]}...`);
            await audioPlayer.play(audioFile);
          }
        }
      });

      keyboard.on(KeyAction.PLAY_SENTENCE, async () => {
        if (!isCardComplete) {
          await audioPlayer.play(resolvedAudioFiles[0]);
        }
      });

      keyboard.on(KeyAction.STOP, () => {
        audioPlayer.stop();
      });

      keyboard.on(KeyAction.NEXT, () => {
        if (!isCardComplete) {
          audioPlayer.stop();
          isCardComplete = true;
        }
      });

      keyboard.on(KeyAction.PREVIOUS, () => {
        if (currentIdx > 0) {
          currentIdx -= 2; // Will be incremented in the for loop
          isCardComplete = true;
        }
      });

      keyboard.on(KeyAction.QUIT, () => {
        audioPlayer.stop();
        keyboard.stop();
        process.exit(0);
      });

      keyboard.on(KeyAction.REGENERATE, async () => {
        if (!isCardComplete) {
          console.log('\nRegenerating content...');
          const newAudio = await getCardContent(card, deckConfig, contentManager, true);
          currentAudio = newAudio;

          // Update display
          console.clear();
          console.log(`Card ${currentIdx + 1}/${dueCards.length}`);
          console.log('\nNewly Generated content:');
          console.log('1. Example sentence:', newAudio.content.sentence);
          console.log('2. Japanese explanation:', newAudio.content.targetExplanation);
          console.log('3. English explanation:', newAudio.content.nativeExplanation);
          keyboard.displayControls();

          // Play new audio
          const newResolvedAudioFiles = await Promise.all(newAudio.audioFiles);
          for (const [index, audioFile] of newResolvedAudioFiles.entries()) {
            if (!isCardComplete) {
              console.log(`\nPlaying ${sections[index]}...`);
              await audioPlayer.play(audioFile);
            }
          }
        }
      });

      const rateCard = async (ease: number) => {
        if (!isCardComplete) {
          const success = await ankiService.answerCard(card.cardId, ease);
          if (success) {
            isCardComplete = true;
            audioPlayer.stop();
          }
        }
      };

      keyboard.on(KeyAction.RATE_1, () => rateCard(1));
      keyboard.on(KeyAction.RATE_2, () => rateCard(2));
      keyboard.on(KeyAction.RATE_3, () => rateCard(3));
      keyboard.on(KeyAction.RATE_4, () => rateCard(4));

      // Play initial audio
      keyboard.emit(KeyAction.PLAY_ALL);

      // Wait for card completion
      while (!isCardComplete) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Clean up listeners for this card
      keyboard.removeAllListeners();
    }

    console.log('\nReview session completed!');
  } catch (error) {
    console.error('Error during review:', error);
  } finally {
    keyboard.stop();
    audioPlayer.stop();
  }
}

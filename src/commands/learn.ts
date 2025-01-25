import { mkdir } from 'fs/promises';
import { loadConfig, findDeckConfig } from '../config/loader';
import { OpenAIService } from '../services/openai';
import { ankiRequest } from '../services/anki';
import { playAudio } from '../services/audio';
import { waitForKeyPress, displayControls } from '../utils/keyboard';

export async function learn() {
  try {
    const config = loadConfig();
    const openaiService = new OpenAIService(config.global.openaiApiKey);

    // Ensure audio directory exists
    await mkdir(config.global.audioDir, { recursive: true });

    // Get cards due for review
    const cardIds = await ankiRequest(config.global.ankiHost, 'findCards', {
      query: `deck:"${config.global.defaultDeck}" is:due`
    });

    if (cardIds.length === 0) {
      console.log('No cards due for review!');
      return;
    }

    console.log(`Starting review session with ${cardIds.length} cards...`);
    console.log('Controls: SPACE to play, 1-4 to rate, Q to quit, R to replay');

    for (let i = 0; i < cardIds.length; i++) {
      const cardInfo = await ankiRequest(config.global.ankiHost, 'cardsInfo', { cards: [cardIds[i]] });
      const card = cardInfo[0];

      const deckConfig = findDeckConfig(card.deckName, config.decks);
      if (!deckConfig) {
        console.error(`No configuration found for deck: ${card.deckName}`);
        continue;
      }

      console.log(`\nCard ${i + 1}/${cardIds.length}`);
      console.log(`Vocabulary: ${card.fields["Vocabulary-Kanji"].value}`);
      console.log(`Meaning: ${card.fields["Vocabulary-English"].value}`);

      const content = await openaiService.generateContent(card, deckConfig);

      console.log('\nGenerating audio files...');
      const audioFiles = await Promise.all([
        openaiService.generateAudio(
          content.sentence,
          `${cardIds[i]}_sentence.mp3`,
          config.global.audioDir,
          config.global.ttsVoice
        ),
        openaiService.generateAudio(
          content.targetExplanation,
          `${cardIds[i]}_target.mp3`,
          config.global.audioDir,
          config.global.ttsVoice
        ),
        openaiService.generateAudio(
          content.nativeExplanation,
          `${cardIds[i]}_native.mp3`,
          config.global.audioDir,
          config.global.ttsVoice
        )
      ]);

      // Display generated content
      console.log('\nGenerated content:');
      console.log('1. Example sentence:', content.sentence);
      console.log('2. Japanese explanation:', content.targetExplanation);
      console.log('3. English explanation:', content.nativeExplanation);

      // Initial audio playback
      console.log('\nPlaying audio...');
      const sections = ['Example sentence', 'Japanese explanation', 'English explanation'];
      for (const [index, audioFile] of audioFiles.entries()) {
        console.log(`\nPlaying ${sections[index]}...`);
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
            for (const [index, audioFile] of audioFiles.entries()) {
              console.log(`\nPlaying ${sections[index]}...`);
              await playAudio(audioFile);
            }
            break;
          case 'r':
            console.log('\nReplaying example sentence...');
            await playAudio(audioFiles[0]);
            break;
          case 'q':
            console.log('\nExiting review session...');
            return;
          case '1':
          case '2':
          case '3':
          case '4':
            await ankiRequest(config.global.ankiHost, 'answerCards', {
              answers: [{
                cardId: card.cardId,
                ease: parseInt(key, 10),
              }]
            });
            playing = false;
            break;
        }
      }
    }

    console.log('\nReview session completed!');
  } catch (error) {
    console.error('Error during review:', error);
  }
}

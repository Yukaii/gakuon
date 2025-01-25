#!/usr/bin/env bun
import { OpenAI } from 'openai';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const BANNER = `
   ____       _
  / ___| __ _| | ___   _ ___  _ __
 | |  _ / _\` | |/ / | | / _ \\| '_ \\
 | |_| | (_| |   <| |_| | (_) | | | |
  \\____|\\__,_|_|\\_\\\\__,_|\\___/|_| |_|

 学音 - AI-Powered Audio Learning System
 --------------------------------------
`;

// Types
interface Config {
  ankiHost: string;
  openaiApiKey: string;
  defaultDeck: string;
  audioDir: string;
  ttsVoice: string;
  language: {
    target: string;
    native: string;
  };
}

interface CardContent {
  sentence: string;
  targetExplanation: string;
  nativeExplanation: string;
}


// Configuration
const config: Config = {
  ankiHost: 'http://localhost:8765',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  defaultDeck: process.env.DECK_NAME!,
  audioDir: join(homedir(), '.gakuon', 'audio'),
  ttsVoice: 'alloy',
  language: {
    target: 'Japanese',
    native: 'English'
  }
};

// OpenAI client
const openai = new OpenAI({
  apiKey: config.openaiApiKey
});

// AnkiConnect API wrapper
async function ankiRequest(action: string, params = {}) {
  const response = await fetch(config.ankiHost, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, version: 6, params })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

// Generate content using OpenAI
async function generateContent(cardFront: string, cardBack: string): Promise<CardContent> {
  const prompt = `Given an Anki card with:
- Vocabulary: ${cardFront}
- English: ${cardBack}
- Example: ${cardBack}

Generate:
1. A natural example sentence using the word/phrase (different from the example provided)
2. A simple explanation in Japanese
3. An explanation in English

Format the response as a JSON object with properties: sentence, targetExplanation, nativeExplanation`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });

  return JSON.parse(completion.choices[0].message.content!) as CardContent;
}

// Generate audio using OpenAI TTS
async function generateAudio(text: string, filename: string): Promise<string> {
  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    voice: config.ttsVoice as any,
    input: text,
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  const audioPath = join(config.audioDir, filename);
  await writeFile(audioPath, buffer);
  return audioPath;
}

// Play audio using system command
async function playAudio(filepath: string) {
  // -nodisp: Don't show the video window
  // -autoexit: Exit when the audio finishes
  // -hide_banner: Don't show ffplay banner
  // -loglevel quiet: Suppress logging output
  await Bun.spawn(['ffplay', '-nodisp', '-autoexit', '-hide_banner', '-loglevel', 'quiet', filepath]).exited;
}

// Main review loop
async function reviewLoop() {
  try {
    // Ensure audio directory exists
    await mkdir(config.audioDir, { recursive: true });

    // Get cards due for review
    const cardIds = await ankiRequest('findCards', {
      query: `deck:"${config.defaultDeck}" is:due`
    });

    if (cardIds.length === 0) {
      console.log('No cards due for review!');
      return;
    }

    console.log(`Starting review session with ${cardIds.length} cards...`);
    console.log('Controls: SPACE to play, 1-4 to rate, Q to quit, R to replay');

        for (let i = 0; i < cardIds.length; i++) {
      const cardInfo = await ankiRequest('cardsInfo', { cards: [cardIds[i]] });
      const card = cardInfo[0];

      console.log(`\nCard ${i + 1}/${cardIds.length}`);
      console.log(`Vocabulary: ${card.fields["Vocabulary-Kanji"].value}`);
      console.log(`Meaning: ${card.fields["Vocabulary-English"].value}`);

      // Generate content
      const content = await generateContent(
        card.fields["Vocabulary-Kanji"].value,
        card.fields["Vocabulary-English"].value
      );

      // Generate audio files
      console.log('\nGenerating audio files...');
      const audioFiles = await Promise.all([
        generateAudio(content.sentence, `${cardIds[i]}_sentence.mp3`),
        generateAudio(content.targetExplanation, `${cardIds[i]}_target.mp3`),
        generateAudio(content.nativeExplanation, `${cardIds[i]}_native.mp3`)
      ]);

      // Display generated content
      console.log('\nGenerated content:');
      console.log('1. Example sentence:', content.sentence);
      console.log('2. Japanese explanation:', content.targetExplanation);
      console.log('3. English explanation:', content.nativeExplanation);

      // Automatically play audio files first time
      console.log('\nPlaying audio...');
      for (const [index, audioFile] of audioFiles.entries()) {
        const sections = ['Example sentence', 'Japanese explanation', 'English explanation'];
        console.log(`\nPlaying ${sections[index]}...`);
        await playAudio(audioFile);
      }

      // Handle keyboard input and playback
      let playing = true;
      console.log('\nControls:');
      console.log('SPACE: Replay all audio');
      console.log('R: Replay example sentence');
      console.log('1-4: Rate card and continue');
      console.log('Q: Quit session');

      while (playing) {
        const key = await new Promise(resolve => {
          process.stdin.setRawMode(true);
          process.stdin.resume();
          process.stdin.once('data', data => {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            resolve(data.toString());
          });
        });

        switch (key) {
          case ' ':
            console.log('\nReplaying all audio...');
            for (const [index, audioFile] of audioFiles.entries()) {
              const sections = ['Example sentence', 'Japanese explanation', 'English explanation'];
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
            await ankiRequest('guiAnswerCard', { ease: parseInt(key) });
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

// Start the application
console.log(BANNER);
console.log('Starting Gakuon review session...');
reviewLoop();

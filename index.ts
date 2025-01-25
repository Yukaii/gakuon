#!/usr/bin/env bun
import { OpenAI } from 'openai';
import { parse } from '@iarna/toml';
import { mkdir, writeFile } from 'fs/promises';
import { readFileSync } from 'fs';
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

interface DeckConfig {
  name: string;
  pattern: string;  // Regex pattern to match deck names
  fields: {
    front: string;
    back: string;
    example?: string;
    notes?: string;
  };
  prompt: string;
}

interface GakuonConfig {
  global: {
    ankiHost: string;
    openaiApiKey: string;
    audioDir: string;
    ttsVoice: string;
    language: {
      target: string;
      native: string;
    };
    defaultDeck: string;
  };
  decks: DeckConfig[];
}


interface CardContent {
  sentence: string;
  targetExplanation: string;
  nativeExplanation: string;
}

// Helper function to interpolate environment variables
function interpolateEnvVars(value: string): string {
  // Match both ${VAR_NAME} and $VAR_NAME patterns
  return value.replace(/\$\{([^}]+)\}|\$([A-Z_][A-Z0-9_]*)/g, (match, p1, p2) => {
    const envVar = p1 || p2; // p1 is for ${VAR}, p2 is for $VAR
    const envValue = process.env[envVar];

    if (!envValue) {
      console.warn(`Warning: Environment variable ${envVar} is not set`);
      return match; // Return original string if env var is not found
    }

    return envValue;
  });
}

// Helper function to recursively process configuration object
function processConfigValues(obj: any): any {
  if (typeof obj === 'string') {
    return interpolateEnvVars(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => processConfigValues(item));
  }

  if (obj && typeof obj === 'object') {
    const processed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      processed[key] = processConfigValues(value);
    }
    return processed;
  }

  return obj;
}

function expandTildePath(path: string): string {
  if (path.startsWith('~/') || path === '~') {
    return path.replace(/^~/, homedir());
  }
  return path;
}

function loadConfig(): GakuonConfig {
  const configPath = join(homedir(), '.gakuon', 'config.toml');
  const configFile = readFileSync(configPath, 'utf-8');
  const rawConfig = parse(configFile) as any as GakuonConfig;

  // Process environment variables first
  const withEnvVars = processConfigValues(rawConfig);

  // Explicitly handle paths in the config
  return {
    ...withEnvVars,
    global: {
      ...withEnvVars.global,
      audioDir: expandTildePath(withEnvVars.global.audioDir)
    }
  };
}

// Find matching deck configuration
function findDeckConfig(deckName: string, configs: DeckConfig[]): DeckConfig | undefined {
  return configs.find(config => new RegExp(config.pattern).test(deckName));
}

// load configuration
const config = loadConfig();

// OpenAI client
const openai = new OpenAI({
  apiKey: config.global.openaiApiKey
});

// AnkiConnect API wrapper
async function ankiRequest(action: string, params = {}) {
  const response = await fetch(config.global.ankiHost, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, version: 6, params })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

// Generate content using OpenAI
async function generateContent(card: any, deckConfig: DeckConfig): Promise<CardContent> {
  // Extract fields based on deck configuration
  const frontContent = card.fields[deckConfig.fields.front].value;
  const backContent = card.fields[deckConfig.fields.back].value;
  const exampleContent = deckConfig.fields.example
    ? card.fields[deckConfig.fields.example].value
    : null;
  const notesContent = deckConfig.fields.notes
    ? card.fields[deckConfig.fields.notes].value
    : null;

  // Replace placeholders in prompt template
  let prompt = deckConfig.prompt
    .replace('${front}', frontContent)
    .replace('${back}', backContent);

  if (exampleContent) {
    prompt = prompt.replace('${example}', exampleContent);
  }
  if (notesContent) {
    prompt = prompt.replace('${notes}', notesContent);
  }

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
    voice: config.global.ttsVoice as any,
    input: text,
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  const audioPath = join(config.global.audioDir, filename);
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
    await mkdir(config.global.audioDir, { recursive: true });

    // Get cards due for review
    const cardIds = await ankiRequest('findCards', {
      query: `deck:"${config.global.defaultDeck}" is:due`
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

      // Find matching deck configuration
      const deckConfig = findDeckConfig(card.deckName, config.decks);
      if (!deckConfig) {
        console.error(`No configuration found for deck: ${card.deckName}`);
        continue;
      }

      console.log(`\nCard ${i + 1}/${cardIds.length}`);
      console.log(`Vocabulary: ${card.fields["Vocabulary-Kanji"].value}`);
      console.log(`Meaning: ${card.fields["Vocabulary-English"].value}`);

      // Generate content
      const content = await generateContent(card, deckConfig);

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

import OpenAI from 'openai';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import type { DeckConfig, CardContent } from '../config/types';

export class OpenAIService {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateContent(card: any, deckConfig: DeckConfig): Promise<CardContent> {
    const frontContent = card.fields[deckConfig.fields.front].value;
    const backContent = card.fields[deckConfig.fields.back].value;
    const exampleContent = deckConfig.fields.example
      ? card.fields[deckConfig.fields.example].value
      : null;
    const notesContent = deckConfig.fields.notes
      ? card.fields[deckConfig.fields.notes].value
      : null;

    let prompt = deckConfig.prompt
      .replace('${front}', frontContent)
      .replace('${back}', backContent);

    if (exampleContent) {
      prompt = prompt.replace('${example}', exampleContent);
    }
    if (notesContent) {
      prompt = prompt.replace('${notes}', notesContent);
    }

    const completion = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    return JSON.parse(completion.choices[0].message.content!) as CardContent;
  }

  async generateAudio(text: string, filename: string, audioDir: string, voice: string): Promise<string> {
    const mp3 = await this.client.audio.speech.create({
      model: "tts-1",
      voice: voice as any,
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const audioPath = join(audioDir, filename);
    await writeFile(audioPath, buffer);
    return audioPath;
  }
}

import OpenAI from "openai";
import { writeFile } from "node:fs/promises";
import WebSocket from "ws";
import { AudioGenerationError, TtsMethod } from "../config/types";
global.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

import {
  type DeckConfig,
  type Card,
  PromptError,
  type DynamicContent,
} from "../config/types";
import { EdgeSpeechTTS } from "@lobehub/tts";

export class OpenAIService {
  public client: OpenAI;

  constructor(
    private apiKey: string,
    private baseUrl = "https://api.openai.com/v1",
    private chatModel = "gpt-4o",
    private ttsModel = "tts-1",
    public ttsMethod = TtsMethod.OPENAI,
    private debug = false,
  ) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  private debugLog(...args: any[]) {
    if (this.debug) {
      console.log("[OpenAIService]", ...args);
    }
  }

  private validateFields(card: Card, deckConfig: DeckConfig): void {
    const missingFields: string[] = [];
    const invalidFields: string[] = [];

    // Check all fields referenced in prompt
    const fieldReferences = [...deckConfig.prompt.matchAll(/\${([^}]+)}/g)].map(
      (match) => match[1],
    );

    // Validate field mappings exist
    for (const fieldRef of fieldReferences) {
      if (!deckConfig.fields[fieldRef]) {
        invalidFields.push(fieldRef);
        continue;
      }

      const ankiField = deckConfig.fields[fieldRef];
      if (!card.fields[ankiField]) {
        missingFields.push(`${fieldRef} (${ankiField})`);
      }
    }

    if (missingFields.length > 0 || invalidFields.length > 0) {
      throw new PromptError("Field validation failed", {
        missingFields,
        invalidFields,
      });
    }
  }

  private replaceFieldReferences(
    prompt: string,
    card: Card,
    deckConfig: DeckConfig,
  ): string {
    let result = prompt;
    const fieldReferences = [...prompt.matchAll(/\${([^}]+)}/g)].map(
      (match) => match[1],
    );

    for (const fieldRef of fieldReferences) {
      const ankiField = deckConfig.fields[fieldRef];
      const value = card.fields[ankiField]?.value || "";
      result = result.replace(`\${${fieldRef}}`, value);
    }

    return result;
  }

  private generateResponseFormat(deckConfig: DeckConfig): string {
    return `Format the response as a JSON object with the following properties:
${Object.entries(deckConfig.responseFields)
  .map(
    ([field, config]) =>
      `- ${field}: ${config.description}${config.required ? " (required)" : " (optional)"} ${config.locale ? `(locale: ${config.locale})` : ""}`,
  )
  .join("\n")}
  
  Required fields must be present in the response.`;
  }

  async generateContent(
    card: Card,
    deckConfig: DeckConfig,
  ): Promise<DynamicContent> {
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    while (attempts < MAX_ATTEMPTS) {
      try {
        // Validate fields before processing
        this.validateFields(card, deckConfig);

        // Replace field references in prompt
        const processedPrompt = this.replaceFieldReferences(
          deckConfig.prompt,
          card,
          deckConfig,
        );

        const fullPrompt = `${processedPrompt}\n\n${this.generateResponseFormat(deckConfig)}`;
        this.debugLog(fullPrompt);
        this.debugLog(this.chatModel);
        const completion = await this.client.chat.completions.create({
          model: this.chatModel,
          messages: [{ role: "user", content: fullPrompt }],
          response_format: { type: "json_object" },
        });

        const response = JSON.parse(
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          completion.choices[0].message.content!,
        ) as Record<string, string>;

        // Validate required fields
        const missingRequired = Object.entries(deckConfig.responseFields)
          .filter(([field, config]) => config.required && !response[field])
          .map(([field]) => field);

        if (missingRequired.length === 0) {
          return response;
        }

        this.debugLog("AI response missing required fields", {
          missingFields: missingRequired,
        });

        this.debugLog(
          `Now Regenerating ... remaining attempts: ${MAX_ATTEMPTS - attempts}`,
        );

        attempts++;
      } catch (error) {
        if (error instanceof PromptError) {
          throw error;
        }

        throw new AudioGenerationError("Content generation failed", {
          messages: [(error as Error).message],
        });
      }
    }

    throw new AudioGenerationError("Content generation failed", {
      messages: [
        "Max attempts reached, but didn't get all of the required fields",
      ],
    });
  }

  async generateAudio(
    text: string,
    outputPath: string,
    voice: string,
    locale = "en-US",
  ): Promise<string> {
    let mp3Buffer: Response;

    // If the tts method is set to ollama, use our own tts service: EdgeSpeechTTS
    try {
      this.debugLog(
        `Generating audio with ${
          this.ttsMethod === TtsMethod.EDGE_TTS ? "EdgeSpeechTTS" : "OpenAI"
        } service`,
      );

      if (this.ttsMethod === TtsMethod.EDGE_TTS) {
        // Use EdgeSpeechTTS for ollama model
        const tts = new EdgeSpeechTTS({ locale });

        mp3Buffer = await tts.create({
          input: text,
          options: {
            voice: voice,
          },
        });
      } else {
        // logic for openai models
        mp3Buffer = await this.client.audio.speech.create({
          model: this.ttsModel,
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          voice: voice as any,
          input: text,
        });
      }
    } catch (error) {
      throw new AudioGenerationError("Audio generation failed", {
        messages: [
          (error as Error).message,
          `TTS method: ${this.ttsMethod}`,
          `TTS model: ${this.ttsModel}`,
        ],
      });
    }

    const buffer = Buffer.from(await mp3Buffer.arrayBuffer());
    await writeFile(outputPath, buffer);
    return outputPath;
  }
}

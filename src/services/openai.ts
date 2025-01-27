import OpenAI from "openai";
import { writeFile } from "fs/promises";
import {
  type DeckConfig,
  type Card,
  PromptError,
  type DynamicContent,
} from "../config/types";

export class OpenAIService {
  public client: OpenAI;

  constructor(
    private apiKey: string,
    private debug = false,
  ) {
    this.client = new OpenAI({ apiKey });
  }

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
      `- ${field}: ${config.description}${config.required ? " (required)" : " (optional)"}`,
  )
  .join("\n")}`;
  }

  async generateContent(
    card: Card,
    deckConfig: DeckConfig,
  ): Promise<DynamicContent> {
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

      const completion = await this.client.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [{ role: "user", content: fullPrompt }],
        response_format: { type: "json_object" },
      });

      const response = JSON.parse(
        completion.choices[0].message.content!,
      ) as Record<string, string>;

      // Validate required fields
      const missingRequired = Object.entries(deckConfig.responseFields)
        .filter(([field, config]) => config.required && !response[field])
        .map(([field]) => field);

      if (missingRequired.length > 0) {
        throw new PromptError("AI response missing required fields", {
          missingFields: missingRequired,
        });
      }

      return response;
    } catch (error) {
      if (error instanceof PromptError) {
        throw error;
      }
      throw new PromptError("Content generation failed", {
        configIssues: [(error as Error).message],
      });
    }
  }

  async generateAudio(
    text: string,
    outputPath: string,
    voice: string,
  ): Promise<string> {
    const mp3 = await this.client.audio.speech.create({
      model: "tts-1",
      voice: voice as any,
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    await writeFile(outputPath, buffer);
    return outputPath;
  }
}

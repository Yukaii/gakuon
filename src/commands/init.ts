import { AnkiService } from "../services/anki";
import { OpenAIService } from "../services/openai";
import { loadConfig, saveConfig } from "../config/loader";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
import Enquirer from "enquirer";
import { parse } from "@iarna/toml";
import type { DeckConfig } from "../config/types";

interface InitOptions {
  debug?: boolean;
  config?: string;
  write?: boolean;
}

async function generateDeckConfig(
  openai: OpenAIService,
  anki: AnkiService,
  deckName: string,
  sampleSize = 3,
): Promise<any> {
  // Get sample cards from deck
  const cardIds = await anki.findCards(deckName);
  const sampleCards = await anki.getCardsInfo(cardIds.slice(0, sampleSize));

  // Extract field structure
  const fieldStructure = Object.keys(sampleCards[0].fields);

  // Generate config using OpenAI
  const prompt = `You are a TOML configuration generator. Analyze this Anki deck structure and output a TOML configuration for an audio-based learning system.

Deck Name: ${deckName}
Available Fields: ${fieldStructure.join(", ")}

Sample Card Contents:
${sampleCards
  .map((card) =>
    fieldStructure
      .map((field) => `${field}: ${card.fields[field].value}`)
      .join("\n"),
  )
  .join("\n\n")}

Example format:
[[decks]]
name = "Japanese Core 2k"
pattern = "Japanese.*Core.*2k"
fields.word = "Vocabulary-Kanji"        # Main word/phrase to learn
fields.reading = "Vocabulary-Kana"      # Reading/pronunciation
fields.meaning = "Vocabulary-English"   # English translation
fields.context = "Expression"          # Example usage
fields.pos = "Vocabulary-Pos"          # Part of speech

prompt = """
Given a Japanese vocabulary card:
- Word: \${word} (\${reading})
- Meaning: \${meaning}
- Part of Speech: \${pos}
- Context: \${context}

Generate natural and helpful content for learning this word.
"""

[decks.responseFields]
example.description = "A natural example sentence using the word"
example.required = true
example.audio = true

explanation_jp.description = "Simple explanation in Japanese"
explanation_jp.required = true
explanation_jp.audio = true

explanation_en.description = "Detailed explanation in English"
explanation_en.required = true
explanation_en.audio = true

Requirements:
1. Output valid TOML without any markdown formatting or code blocks
2. Use actual field names from the provided deck structure
3. Create appropriate field mappings and prompt template
4. Define response fields suitable for audio learning
5. Start output directly with [[decks]]`;

  const completion = await openai.client.chat.completions.create({
    model: config.global.openai.initModel,
    messages: [{ role: "user", content: prompt }],
  });

  return completion.choices[0].message.content;
}

export async function init(options: InitOptions = {}) {
  const debug = options.debug || false;

  try {
    // Initialize services
    const config = loadConfig(options.config);
    const ankiService = new AnkiService(config.global.ankiHost, debug);
    const openaiService = new OpenAIService(
      config.global.openaiApiKey,
      config.global.openai.baseUrl,
      config.global.openai.chatModel,
      config.global.openai.ttsModel,
      debug
    );

    // Get available decks
    const decks = await ankiService.getDeckNames();

    // Select deck
    const { deckName } = await Enquirer.prompt<{ deckName: string }>({
      type: "select",
      name: "deckName",
      message: "Select a deck to configure:",
      choices: decks,
    });

    console.log("\nAnalyzing deck structure and generating configuration...");

    // Generate deck config
    const deckConfig = await generateDeckConfig(
      openaiService,
      ankiService,
      deckName,
    );

    // Show generated config
    console.log("\nGenerated configuration:");
    console.log(deckConfig);

    if (options.write) {
      try {
        // Ensure config directory exists
        await mkdir(join(homedir(), ".gakuon"), { recursive: true });

        // Parse TOML and merge config
        const newDeckConfig = parse(deckConfig);
        config.decks.push(newDeckConfig as unknown as DeckConfig);

        // Save config
        await saveConfig(config);
        console.log("Configuration saved successfully!");
      } catch (error) {
        console.error("Failed to parse or save configuration:", error);
      }
    } else {
      console.log("\nTo save this configuration, you can:");
      console.log("1. Run the command again with -W/--write flag");
      console.log("2. Manually add it to ~/.gakuon/config.toml");
    }
  } catch (error) {
    console.error("Error during initialization:", error);
  }
}

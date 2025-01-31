import { AnkiService } from "../services/anki";
import { OpenAIService } from "../services/openai";
import { loadConfig } from "../config/loader";
import { findDeckConfig } from "../config/loader";
import type { Card } from "../config/types";
import Enquirer from "enquirer";

interface TestOptions {
  debug?: boolean;
  config?: string;
  samples?: string;
  deck?: string;
}

export async function test(options: TestOptions = {}) {
  const debug = options.debug || false;
  const sampleSize = Number.parseInt(options.samples || "3", 10);

  try {
    // Initialize services
    const config = loadConfig(options.config);
    const ankiService = new AnkiService(config.global.ankiHost, debug);
    const openaiService = new OpenAIService(
      config.global.openaiApiKey,
      config.global.openai.baseUrl,
      config.global.openai.chatModel,
      config.global.openai.ttsModel,
      debug,
    );

    // Get available decks
    const decks = await ankiService.getDeckNames();

    // If deck is specified via CLI, validate it exists
    if (options.deck && !decks.includes(options.deck)) {
      console.error(`Deck "${options.deck}" not found`);
      return;
    }

    // Select deck if not specified
    const deckName =
      options.deck ||
      (
        await Enquirer.prompt<{ deckName: string }>({
          type: "select",
          name: "deckName",
          message: "Select a deck to test:",
          choices: decks,
        })
      ).deckName;

    // Find deck config
    const deckConfig = findDeckConfig(deckName, config.decks);
    if (!deckConfig) {
      console.error(`No configuration found for deck: ${deckName}`);
      return;
    }

    console.log(`\nTesting configuration for deck: ${deckName}`);
    console.log(`Generating ${sampleSize} sample responses...\n`);

    // Get random cards from deck
    const cardIds = await ankiService.findCards(deckName);
    const randomIndices = Array.from({ length: sampleSize }, () =>
      Math.floor(Math.random() * cardIds.length),
    );
    const sampleCards = await ankiService.getCardsInfo(
      randomIndices.map((i) => cardIds[i]),
    );

    // Test each card
    for (const [index, card] of sampleCards.entries()) {
      console.log(`\nTest ${index + 1}/${sampleSize}:`);
      console.log("Card Fields:");
      Object.entries(card.fields).forEach(([field, { value }]) => {
        console.log(`${field}: ${value}`);
      });

      try {
        console.log("\nGenerated Content:");
        const content = await openaiService.generateContent(
          card as Card,
          deckConfig,
        );
        Object.entries(content).forEach(([field, value]) => {
          console.log(`\n${field}:`);
          console.log(value);
        });
      } catch (error) {
        console.error(`\nError generating content:`, error);
      }

      if (index < sampleSize - 1) {
        await Enquirer.prompt<{ continue: boolean }>({
          type: "confirm",
          name: "continue",
          message: "Continue to next sample?",
          initial: true,
        });
      }
    }

    console.log("\nTest completed!");
    console.log(
      "Review the generated content and adjust your deck configuration as needed.",
    );
    console.log(
      "You can modify the configuration file at ~/.gakuon/config.toml",
    );
  } catch (error) {
    console.error("Error during testing:", error);
  }
}

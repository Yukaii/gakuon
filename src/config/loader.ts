import { parse, stringify } from "@iarna/toml";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Buffer } from "node:buffer";
import {
  type GakuonConfig,
  type DeckConfig,
  QueueOrder,
  ReviewSortOrder,
  NewCardGatherOrder,
} from "./types";
import { interpolateEnvVars } from "../utils/path";

export const DEFAULT_CONFIG: GakuonConfig = {
  global: {
    ankiHost: "http://localhost:8765",
    openaiApiKey: "${OPENAI_API_KEY}",
    ttsVoice: "alloy",
    cardOrder: {
      queueOrder: QueueOrder.LEARNING_REVIEW_NEW,
      reviewOrder: ReviewSortOrder.DUE_DATE_RANDOM,
      newCardOrder: NewCardGatherOrder.DECK,
    },
  },
  decks: [],
};

// Define environment variable mappings for global config
const ENV_VAR_MAPPINGS = {
  "global.ankiHost": "GAKUON_ANKI_HOST",
  "global.openaiApiKey": "OPENAI_API_KEY",
  "global.ttsVoice": "GAKUON_TTS_VOICE",
  "global.defaultDeck": "GAKUON_DEFAULT_DECK",
  "global.cardOrder.queueOrder": "GAKUON_QUEUE_ORDER",
  "global.cardOrder.reviewOrder": "GAKUON_REVIEW_ORDER",
  "global.cardOrder.newCardOrder": "GAKUON_NEW_CARD_ORDER"
};

// Keys that should undergo environment variable interpolation
const ALLOWED_ENV_KEYS = new Set(Object.keys(ENV_VAR_MAPPINGS));

function processConfigValues(obj: any, path: string[] = []): any {
  if (typeof obj === "string") {
    const fullPath = path.join(".");
    if (ALLOWED_ENV_KEYS.has(fullPath)) {
      const envVar = ENV_VAR_MAPPINGS[fullPath as keyof typeof ENV_VAR_MAPPINGS];
      const envValue = process.env[envVar];
      if (envValue !== undefined) {
        return envValue;
      }
      return interpolateEnvVars(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) =>
      processConfigValues(item, [...path, index.toString()]),
    );
  }

  if (obj && typeof obj === "object") {
    const processed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      processed[key] = processConfigValues(value, [...path, key]);
    }
    return processed;
  }

  return obj;
}

function processRawConfig(rawConfig: any): GakuonConfig {
  // Process environment variables first
  const withEnvVars = processConfigValues(rawConfig);

  // Handle enum conversions for card order settings from env vars
  const queueOrder = process.env.GAKUON_QUEUE_ORDER;
  const reviewOrder = process.env.GAKUON_REVIEW_ORDER;
  const newCardOrder = process.env.GAKUON_NEW_CARD_ORDER;

  return {
    ...withEnvVars,
    global: {
      ...withEnvVars.global,
      cardOrder: {
        queueOrder: queueOrder as QueueOrder || withEnvVars.global.cardOrder.queueOrder,
        reviewOrder: reviewOrder as ReviewSortOrder || withEnvVars.global.cardOrder.reviewOrder,
        newCardOrder: newCardOrder as NewCardGatherOrder || withEnvVars.global.cardOrder.newCardOrder,
      },
    },
  };
}

export function loadConfig(customPath?: string): GakuonConfig {
  // First try to load from BASE64_GAKUON_CONFIG environment variable
  const base64Config = process.env.BASE64_GAKUON_CONFIG;
  if (base64Config) {
    try {
      const decodedConfig = Buffer.from(base64Config, 'base64').toString('utf-8');
      const rawConfig = parse(decodedConfig) as any;
      return processRawConfig(rawConfig);
    } catch (error) {
      console.warn('Failed to parse BASE64_GAKUON_CONFIG:', error);
      // Fall through to file-based config
    }
  }

  // Fall back to file-based config
  const configPath = customPath || join(homedir(), ".gakuon", "config.toml");

  if (!existsSync(configPath)) {
    saveConfig(DEFAULT_CONFIG);
  }

  const configFile = readFileSync(configPath, "utf-8");
  const rawConfig = parse(configFile) as any;
  return processRawConfig(rawConfig);
}

// Rest of deck-related functions remain unchanged
export function findDeckConfig(
  deckName: string,
  configs: DeckConfig[],
): DeckConfig | undefined {
  return configs.find((config) => new RegExp(config.pattern).test(deckName));
}

function reverseProcessConfigValues(obj: any, path: string[] = []): any {
  if (typeof obj === "string") {
    const fullPath = path.join(".");
    if (ALLOWED_ENV_KEYS.has(fullPath)) {
      const envVar = ENV_VAR_MAPPINGS[fullPath as keyof typeof ENV_VAR_MAPPINGS];
      const envValue = process.env[envVar];
      if (obj === envValue) {
        return `\${${envVar}}`;
      }
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) =>
      reverseProcessConfigValues(item, [...path, index.toString()]),
    );
  }

  if (obj && typeof obj === "object") {
    const processed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      processed[key] = reverseProcessConfigValues(value, [...path, key]);
    }
    return processed;
  }

  return obj;
}

// Rest of config saving and backup functions remain unchanged
export async function saveConfig(config: GakuonConfig): Promise<void> {
  const configPath = join(homedir(), ".gakuon", "config.toml");

  try {
    const processedConfig = reverseProcessConfigValues(config);
    const tomlContent = stringify(processedConfig);

    const configWithHeader = `# Gakuon Configuration File
# Generated on ${new Date().toISOString()}
# Do not edit while Anki is running

${tomlContent}`;

    writeFileSync(configPath, configWithHeader, "utf-8");
  } catch (error) {
    throw new Error(`Failed to save configuration: ${error}`);
  }
}

export async function backupConfig(): Promise<string> {
  const configPath = join(homedir(), ".gakuon", "config.toml");
  const backupPath = join(
    homedir(),
    ".gakuon",
    `config.backup.${Date.now()}.toml`,
  );

  try {
    const currentConfig = readFileSync(configPath, "utf-8");
    writeFileSync(backupPath, currentConfig, "utf-8");
    return backupPath;
  } catch (error) {
    throw new Error(`Failed to backup configuration: ${error}`);
  }
}

export async function saveConfigSafely(config: GakuonConfig): Promise<void> {
  try {
    await backupConfig();
    await saveConfig(config);
  } catch (error) {
    throw new Error(`Failed to save configuration safely: ${error}`);
  }
}

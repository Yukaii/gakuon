import { Buffer } from "node:buffer";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { type JsonMap, parse, stringify } from "@iarna/toml";
import { ZodError } from "zod";
import { interpolateEnvVars } from "../utils/path";
import {
  type DeckConfig,
  type GakuonConfig,
  GakuonConfigSchema,
  NewCardGatherOrder,
  QueueOrder,
  ReviewSortOrder,
  TtsMethod,
} from "./types";

export const DEFAULT_CONFIG: GakuonConfig = {
  global: {
    ankiHost: "http://localhost:8765",
    openaiApiKey: "${OPENAI_API_KEY}",
    ttsVoice: "alloy",
    ttsMethod: TtsMethod.OPENAI,
    openai: {
      baseUrl: "https://api.openai.com/v1",
      chatModel: "gpt-4o",
      initModel: "gpt-4o",
      ttsModel: "tts-1",
    },
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
  "global.cardOrder.newCardOrder": "GAKUON_NEW_CARD_ORDER",
  "global.openai.baseUrl": "GAKUON_OPENAI_BASE_URL",
  "global.openai.chatModel": "GAKUON_OPENAI_CHAT_MODEL",
  "global.openai.initModel": "GAKUON_OPENAI_INIT_MODEL",
  "global.openai.ttsModel": "GAKUON_OPENAI_TTS_MODEL",
};

// Keys that should undergo environment variable interpolation
const ALLOWED_ENV_KEYS = new Set(Object.keys(ENV_VAR_MAPPINGS));

function processConfigValues(obj: unknown, path: string[] = []): unknown {
  if (typeof obj === "string") {
    const fullPath = path.join(".");
    if (ALLOWED_ENV_KEYS.has(fullPath)) {
      const envVar =
        ENV_VAR_MAPPINGS[fullPath as keyof typeof ENV_VAR_MAPPINGS];
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
    const processed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      processed[key] = processConfigValues(value, [...path, key]);
    }
    return processed;
  }

  return obj;
}

type ProcessedConfig = Partial<GakuonConfig> & {
  global?: Partial<GakuonConfig["global"]> & {
    openai?: Partial<GakuonConfig["global"]["openai"]>;
    cardOrder?: Partial<GakuonConfig["global"]["cardOrder"]>;
  };
};

function processRawConfig(rawConfig: unknown): GakuonConfig {
  // Process environment variables first
  const withEnvVars = processConfigValues(rawConfig);
  const processed = withEnvVars as ProcessedConfig;

  // Handle enum conversions for card order settings from env vars
  const queueOrder = process.env.GAKUON_QUEUE_ORDER;
  const reviewOrder = process.env.GAKUON_REVIEW_ORDER;
  const newCardOrder = process.env.GAKUON_NEW_CARD_ORDER;

  // Ensure openai config exists with defaults
  const openaiConfig = {
    baseUrl: DEFAULT_CONFIG.global.openai.baseUrl,
    chatModel: DEFAULT_CONFIG.global.openai.chatModel,
    initModel: DEFAULT_CONFIG.global.openai.initModel,
    ttsModel: DEFAULT_CONFIG.global.openai.ttsModel,
    ...(processed.global?.openai || {}),
  };

  const configObj: GakuonConfig = {
    ...processed,
    decks: processed.decks || DEFAULT_CONFIG.decks,
    global: {
      ankiHost: processed.global?.ankiHost || DEFAULT_CONFIG.global.ankiHost,
      openaiApiKey:
        processed.global?.openaiApiKey || DEFAULT_CONFIG.global.openaiApiKey,
      ttsVoice: processed.global?.ttsVoice || DEFAULT_CONFIG.global.ttsVoice,
      ttsMethod: processed.global?.ttsMethod || DEFAULT_CONFIG.global.ttsMethod,
      defaultDeck: processed.global?.defaultDeck,
      openai: openaiConfig,
      cardOrder: {
        queueOrder:
          (queueOrder as QueueOrder) ||
          processed.global?.cardOrder?.queueOrder ||
          DEFAULT_CONFIG.global.cardOrder.queueOrder,
        reviewOrder:
          (reviewOrder as ReviewSortOrder) ||
          processed.global?.cardOrder?.reviewOrder ||
          DEFAULT_CONFIG.global.cardOrder.reviewOrder,
        newCardOrder:
          (newCardOrder as NewCardGatherOrder) ||
          processed.global?.cardOrder?.newCardOrder ||
          DEFAULT_CONFIG.global.cardOrder.newCardOrder,
      },
    },
  };
  return GakuonConfigSchema.parse(configObj);
}

export function loadConfig(customPath?: string): GakuonConfig {
  // First try to load from BASE64_GAKUON_CONFIG environment variable
  const base64Config = process.env.BASE64_GAKUON_CONFIG;
  if (base64Config) {
    try {
      const decodedConfig = Buffer.from(base64Config, "base64").toString(
        "utf-8",
      );
      const rawConfig = parse(decodedConfig);
      try {
        return processRawConfig(rawConfig);
      } catch (error) {
        if (error instanceof ZodError) {
          throw new Error(
            `Invalid configuration from BASE64_GAKUON_CONFIG: ${error.message}. Issues: ${JSON.stringify(
              error.issues,
              null,
              2,
            )}`,
          );
        }
        throw error;
      }
    } catch (error) {
      console.warn("Failed to parse BASE64_GAKUON_CONFIG:", error);
      // Fall through to file-based config
    }
  }

  // Fall back to file-based config
  const configPath = customPath || join(homedir(), ".gakuon", "config.toml");
  if (!existsSync(configPath)) {
    saveConfig(DEFAULT_CONFIG);
  }

  const configFile = readFileSync(configPath, "utf-8");
  const rawConfig = parse(configFile);
  try {
    return processRawConfig(rawConfig);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(
        `Invalid configuration from file ${configPath}: ${error.message}. Issues: ${JSON.stringify(
          error.issues,
          null,
          2,
        )}`,
      );
    }
    throw error;
  }
}

// Rest of deck-related functions remain unchanged
export function findDeckConfig(
  deckName: string,
  configs: DeckConfig[],
): DeckConfig | undefined {
  return configs.find((config) => new RegExp(config.pattern).test(deckName));
}

function reverseProcessConfigValues(
  obj: unknown,
  path: string[] = [],
): unknown {
  if (typeof obj === "string") {
    const fullPath = path.join(".");
    if (ALLOWED_ENV_KEYS.has(fullPath)) {
      const envVar =
        ENV_VAR_MAPPINGS[fullPath as keyof typeof ENV_VAR_MAPPINGS];
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
    const processed: Record<string, unknown> = {};
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
    // Create directory if it doesn't exist
    const dirPath = dirname(configPath);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
    
    const processedConfig = reverseProcessConfigValues(config);
    const tomlContent = stringify(processedConfig as JsonMap);

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

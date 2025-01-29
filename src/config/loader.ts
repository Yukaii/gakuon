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

// Define allowed keys for environment variable interpolation
const ALLOWED_ENV_KEYS = new Set(["global.openaiApiKey"]);

function processConfigValues(obj: any, path: string[] = []): any {
  if (typeof obj === "string") {
    const fullPath = path.join(".");
    return ALLOWED_ENV_KEYS.has(fullPath) ? interpolateEnvVars(obj) : obj;
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

export function loadConfig(customPath?: string): GakuonConfig {
  // First try to load from BASE64_GAKUON_CONFIG environment variable
  const base64Config = import.meta.env.BASE64_GAKUON_CONFIG;
  if (base64Config) {
    try {
      const decodedConfig = Buffer.from(base64Config, 'base64').toString('utf-8');
      const rawConfig = parse(decodedConfig) as any as GakuonConfig;
      const withEnvVars = processConfigValues(rawConfig);
      return {
        ...withEnvVars,
        global: {
          ...withEnvVars.global,
        },
      };
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
  const rawConfig = parse(configFile) as any as GakuonConfig;

  const withEnvVars = processConfigValues(rawConfig);

  return {
    ...withEnvVars,
    global: {
      ...withEnvVars.global,
    },
  };
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
      const envValue = process.env.OPENAI_API_KEY;
      return obj === envValue ? "${OPENAI_API_KEY}" : obj;
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

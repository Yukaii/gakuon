import { parse, stringify } from '@iarna/toml';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { type GakuonConfig, type DeckConfig, QueueOrder, ReviewSortOrder, NewCardGatherOrder } from './types';
import { interpolateEnvVars } from '../utils/path';

const DEFAULT_CONFIG: GakuonConfig = {
  global: {
    ankiHost: 'http://localhost:8765',
    openaiApiKey: '${OPENAI_API_KEY}',
    ttsVoice: 'alloy',
    cardOrder: {
      queueOrder: QueueOrder.LEARNING_REVIEW_NEW,
      reviewOrder: ReviewSortOrder.DUE_DATE_RANDOM,
      newCardOrder: NewCardGatherOrder.DECK,
    }
  },
  decks: []
};

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

export function loadConfig(): GakuonConfig {
  const configPath = join(homedir(), '.gakuon', 'config.toml');

  if (!existsSync(configPath)) {
    saveConfig(DEFAULT_CONFIG)
  }


  const configFile = readFileSync(configPath, 'utf-8');
  const rawConfig = parse(configFile) as any as GakuonConfig;

  const withEnvVars = processConfigValues(rawConfig);

  return {
    ...withEnvVars,
    global: {
      ...withEnvVars.global,
    }
  };
}

export function findDeckConfig(deckName: string, configs: DeckConfig[]): DeckConfig | undefined {
  return configs.find(config => new RegExp(config.pattern).test(deckName));
}

function reverseProcessConfigValues(obj: any): any {
  if (typeof obj === 'string' && obj.includes(process.env.OPENAI_API_KEY || '')) {
    // Replace API key with environment variable reference
    return '${OPENAI_API_KEY}';
  }

  if (Array.isArray(obj)) {
    return obj.map(item => reverseProcessConfigValues(item));
  }

  if (obj && typeof obj === 'object') {
    const processed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      processed[key] = reverseProcessConfigValues(value);
    }
    return processed;
  }

  return obj;
}

export async function saveConfig(config: GakuonConfig): Promise<void> {
  const configPath = join(homedir(), '.gakuon', 'config.toml');

  try {
    // Reverse process config values to store environment variables as references
    const processedConfig = reverseProcessConfigValues(config);

    // Convert config to TOML
    const tomlContent = stringify(processedConfig);

    // Add header comment
    const configWithHeader = `# Gakuon Configuration File
# Generated on ${new Date().toISOString()}
# Do not edit while Anki is running

${tomlContent}`;

    // Write to file
    writeFileSync(configPath, configWithHeader, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save configuration: ${error}`);
  }
}

// Optional: Add backup functionality
export async function backupConfig(): Promise<string> {
  const configPath = join(homedir(), '.gakuon', 'config.toml');
  const backupPath = join(homedir(), '.gakuon', `config.backup.${Date.now()}.toml`);

  try {
    const currentConfig = readFileSync(configPath, 'utf-8');
    writeFileSync(backupPath, currentConfig, 'utf-8');
    return backupPath;
  } catch (error) {
    throw new Error(`Failed to backup configuration: ${error}`);
  }
}

// Usage in init command:
export async function saveConfigSafely(config: GakuonConfig): Promise<void> {
  try {
    // Create backup first
    await backupConfig();

    // Save new config
    await saveConfig(config);
  } catch (error) {
    throw new Error(`Failed to save configuration safely: ${error}`);
  }
}

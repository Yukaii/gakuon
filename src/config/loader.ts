import { parse } from '@iarna/toml';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { GakuonConfig } from './types';
import { expandTildePath, interpolateEnvVars } from '../utils/path';

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
  const configFile = readFileSync(configPath, 'utf-8');
  const rawConfig = parse(configFile) as any as GakuonConfig;

  const withEnvVars = processConfigValues(rawConfig);

  return {
    ...withEnvVars,
    global: {
      ...withEnvVars.global,
      audioDir: expandTildePath(withEnvVars.global.audioDir)
    }
  };
}

export function findDeckConfig(deckName: string, configs: DeckConfig[]): DeckConfig | undefined {
  return configs.find(config => new RegExp(config.pattern).test(deckName));
}

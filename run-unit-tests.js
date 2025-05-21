#!/usr/bin/env node

/**
 * Script to run only unit tests, excluding integration tests
 */
import { execSync } from 'child_process';

try {
  execSync('bun run jest --testPathIgnorePatterns="<rootDir>/tests/" --forceExit', {
    stdio: 'inherit'
  });
  process.exit(0);
} catch (error) {
  process.exit(1);
}
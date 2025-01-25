#!/usr/bin/env node
import { Command } from 'commander';
import { learn } from './commands/learn';
import { BANNER } from './utils/banner';

const program = new Command();

console.log(BANNER);

program
  .name('gakuon')
  .description('AI-Powered Audio Learning System for Anki')
  .version('0.1.0');

program
  .command('learn')
  .description('Start an audio-based learning session')
  .action(learn);

program.parse();

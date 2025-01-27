#!/usr/bin/env node
import { Command } from "commander";
import { learn } from "./commands/learn";
import { init } from "./commands/init";
import { serve } from "./commands/serve";
import { BANNER } from "./utils/banner";

const program = new Command();

console.log(BANNER);

program
  .name("gakuon")
  .description("AI-Powered Audio Learning System for Anki")
  .version("0.1.0");

program
  .command("learn")
  .description("Start an audio-based learning session")
  .option("-d, --debug", "Enable debug mode")
  .option("--deck <name>", "Specify deck to use") // Added deck option
  .action(learn);

program
  .command("init")
  .description("Initialize deck configuration interactively")
  .option("-d, --debug", "Enable debug mode")
  .action(init);

  program
    .command("serve")
    .description("Start the Gakuon HTTP server")
    .option("-p, --port <number>", "Port to listen on", "3000")
    .option("-d, --debug", "Enable debug mode")
    .action(serve);

program.parse();

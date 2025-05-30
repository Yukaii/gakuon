#!/usr/bin/env node
import { Command } from "commander";
import { learn } from "./commands/learn";
import { init } from "./commands/init";
import { serve } from "./commands/serve";
import { test } from "./commands/test";
import { BANNER } from "./utils/banner";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);

const program = new Command();

console.log(BANNER);

program
  .name("gakuon")
  .description("AI-Powered Audio Learning System for Anki")
  .version(pkg.version);

program
  .command("learn")
  .description("Start an audio-based learning session")
  .option("-d, --debug", "Enable debug mode")
  .option("--deck <name>", "Specify deck to use") // Added deck option
  .option("-c, --config <path>", "Path to config file")
  .action(learn);

program
  .command("init")
  .description("Initialize deck configuration interactively")
  .option("-c, --config <path>", "Path to config file")
  .option("-d, --debug", "Enable debug mode")
  .option("-W, --write", "Write configuration to file")

  .action(init);

program
  .command("serve")
  .description("Start the Gakuon HTTP server")
  .option("-p, --port <number>", "Port to listen on", "4989")
  .option("-d, --debug", "Enable debug mode")
  .option("--serve-client", "Serve built client app from dist/client")
  .option("-c, --config <path>", "Path to config file")
  .action(serve);

program
  .command("test")
  .description("Test deck configuration with sample cards")
  .option("-d, --debug", "Enable debug mode")
  .option("-c, --config <path>", "Path to config file")
  .option("-n, --samples <number>", "Number of sample cards to test", "3")
  .option("--deck <name>", "Specify deck to test")
  .action(test);

program.parse();

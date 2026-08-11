#!/usr/bin/env node
/**
 * CLI entry point for the context system
 */

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { indexCommand } from "./commands/index.js";
import { explainCommand } from "./commands/explain.js";
import { searchCommand } from "./commands/search.js";
import { workspaceCommands } from "./commands/workspace.js";
import { enhancedContextCommands } from "./commands/context-enhanced.js";

const program = new Command();

program
  .name("dev")
  .description("Personal Engineering Context Fabric")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(statusCommand);
program.addCommand(indexCommand);
program.addCommand(explainCommand);
program.addCommand(searchCommand);

// PR7: Workspace commands
for (const cmd of workspaceCommands) {
  program.addCommand(cmd);
}

// PR7: Enhanced context commands
for (const cmd of enhancedContextCommands) {
  program.addCommand(cmd);
}

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AgentHarness } from "./agent/harness.js";
import { createDataTools } from "./agent/tools.js";
import { createModel, loadAgentEnvironment } from "./config.js";
import { SnapshotDataSource, type ReviewSnapshot } from "./snapshot-data-source.js";
import type { AgentProgressEvent, ReviewEvent } from "./types.js";

function usage(): never {
  console.error("Usage: npm run agent -- --event <event.json> --snapshot <snapshot.json>");
  process.exit(2);
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = process.argv[index + 1];
  if (index < 0 || !value || value.startsWith("--")) usage();
  return resolve(value);
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function progress(event: AgentProgressEvent): void {
  switch (event.type) {
    case "model_start":
      console.error(`[step ${event.step}] asking ${event.provider}:${event.model}`);
      break;
    case "tool_start":
      console.error(`[step ${event.step}] calling ${event.name}`);
      break;
    case "tool_end":
      console.error(`[step ${event.step}] ${event.name} ${event.ok ? "completed" : "failed"}`);
      break;
    case "decision":
      console.error(`[step ${event.step}] decision: ${event.decision.action}`);
      break;
    case "model_end":
      break;
  }
}

async function main(): Promise<void> {
  const event = await readJson<ReviewEvent>(argument("--event"));
  const snapshot = await readJson<ReviewSnapshot>(argument("--snapshot"));
  const config = loadAgentEnvironment();
  const model = createModel(config);
  const tools = createDataTools(new SnapshotDataSource(snapshot));

  const harness = new AgentHarness({
    model,
    tools,
    maxSteps: config.maxSteps,
    onProgress: progress,
  });
  const result = await harness.run(event);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

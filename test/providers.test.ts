import assert from "node:assert/strict";
import test from "node:test";
import { FireworksClient } from "../src/providers/fireworks.js";
import { InferenceError } from "../src/providers/openai-compatible.js";
import { OpenRouterClient } from "../src/providers/openrouter.js";

const completion = {
  id: "chat-1",
  model: "test-model",
  choices: [{ finish_reason: "stop", message: { role: "assistant", content: "done" } }],
  usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
};

test("Fireworks sends an OpenAI-compatible chat completion", async () => {
  let seenUrl = "";
  let seenInit: RequestInit | undefined;
  const fetchMock = (async (url: string | URL | Request, init?: RequestInit) => {
    seenUrl = String(url);
    seenInit = init;
    return Response.json(completion);
  }) as typeof fetch;
  const client = new FireworksClient({ apiKey: "fw-secret", model: "fw-model", fetch: fetchMock });

  const response = await client.complete({ messages: [{ role: "user", content: "hello" }] });

  assert.equal(seenUrl, "https://api.fireworks.ai/inference/v1/chat/completions");
  assert.equal(new Headers(seenInit?.headers).get("Authorization"), "Bearer fw-secret");
  assert.equal(JSON.parse(String(seenInit?.body)).model, "fw-model");
  assert.equal(response.message.content, "done");
  assert.deepEqual(response.usage, { promptTokens: 3, completionTokens: 1, totalTokens: 4 });
});

test("OpenRouter includes attribution and privacy routing", async () => {
  let seenInit: RequestInit | undefined;
  const fetchMock = (async (_url: string | URL | Request, init?: RequestInit) => {
    seenInit = init;
    return Response.json(completion);
  }) as typeof fetch;
  const client = new OpenRouterClient({
    apiKey: "or-secret",
    model: "anthropic/test",
    siteUrl: "https://murmur.dev",
    appName: "MURMUR",
    fetch: fetchMock,
  });

  await client.complete({ messages: [{ role: "user", content: "criticize" }] });

  const headers = new Headers(seenInit?.headers);
  assert.equal(headers.get("HTTP-Referer"), "https://murmur.dev");
  assert.equal(headers.get("X-OpenRouter-Title"), "MURMUR");
  assert.deepEqual(JSON.parse(String(seenInit?.body)).provider, {
    require_parameters: true,
    data_collection: "deny",
  });
});

test("retries rate limits and honors Retry-After", async () => {
  let calls = 0;
  const delays: number[] = [];
  const fetchMock = (async () => {
    calls += 1;
    if (calls === 1) {
      return Response.json({ error: { message: "slow down" } }, { status: 429, headers: { "Retry-After": "1" } });
    }
    return Response.json(completion);
  }) as typeof fetch;
  const client = new FireworksClient({
    apiKey: "secret",
    model: "model",
    fetch: fetchMock,
    maxRetries: 1,
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
    },
  });

  await client.complete({ messages: [{ role: "user", content: "hello" }] });

  assert.equal(calls, 2);
  assert.deepEqual(delays, [1000]);
});

test("does not retry authentication errors or expose the key", async () => {
  let calls = 0;
  const fetchMock = (async () => {
    calls += 1;
    return Response.json({ error: { message: "invalid authentication" } }, { status: 401 });
  }) as typeof fetch;
  const client = new FireworksClient({ apiKey: "super-secret", model: "model", fetch: fetchMock });

  await assert.rejects(
    client.complete({ messages: [{ role: "user", content: "hello" }] }),
    (error: unknown) => {
      assert.ok(error instanceof InferenceError);
      assert.equal(error.status, 401);
      assert.equal(error.message, "invalid authentication");
      assert.ok(!error.message.includes("super-secret"));
      return true;
    },
  );
  assert.equal(calls, 1);
});

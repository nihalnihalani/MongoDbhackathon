import assert from "node:assert/strict";
import test from "node:test";
import { createModel, loadAgentEnvironment } from "../src/config.js";

test("selects Fireworks as the complete inference provider", () => {
  const config = loadAgentEnvironment({
    MURMUR_PROVIDER: "fireworks",
    FIREWORKS_API_KEY: "fw-key",
    FIREWORKS_MODEL: "accounts/fireworks/models/test",
  });
  const model = createModel(config);

  assert.equal(config.provider, "fireworks");
  assert.equal(model.provider, "fireworks");
  assert.equal(model.model, "accounts/fireworks/models/test");
});

test("selects OpenRouter without requiring a Fireworks key", () => {
  const config = loadAgentEnvironment({
    MURMUR_PROVIDER: "openrouter",
    OPENROUTER_API_KEY: "or-key",
    OPENROUTER_MODEL: "anthropic/test",
  });
  const model = createModel(config);

  assert.equal(config.provider, "openrouter");
  assert.equal(model.provider, "openrouter");
  assert.equal(model.model, "anthropic/test");
});

test("requires only the selected provider's key", () => {
  assert.throws(
    () => loadAgentEnvironment({ MURMUR_PROVIDER: "openrouter", FIREWORKS_API_KEY: "unused" }),
    /OPENROUTER_API_KEY is required/,
  );
  assert.throws(
    () => loadAgentEnvironment({ MURMUR_PROVIDER: "fireworks", OPENROUTER_API_KEY: "unused" }),
    /FIREWORKS_API_KEY is required/,
  );
});

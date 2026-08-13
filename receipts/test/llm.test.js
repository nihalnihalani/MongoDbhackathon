import assert from 'node:assert/strict';
import test from 'node:test';

process.env.REVIEW_LLM = 'on';
process.env.FIREWORKS_API_KEY = 'fireworks-test-key';
process.env.FIREWORKS_MODEL = 'accounts/fireworks/models/test-model';
process.env.OPENROUTER_API_KEY = 'openrouter-test-key';
process.env.OPENROUTER_MODEL = 'anthropic/test-model';
process.env.OPENROUTER_SITE_URL = 'https://receipts.test';
process.env.OPENROUTER_APP_NAME = 'PR-Elo Test';

const { standardReview, deepReview } = await import('../src/llm.js');

const pr = {
  prNum: 481,
  author: 'agent-kevin',
  subsystem: 'payments/rounding',
  changeType: 'feature',
  title: 'Round invoice totals',
  evidence: [],
  code: 'function roundMoney(amount) { return Math.round(amount * 100) / 100; }',
};

test('Fireworks and OpenRouter can each run both review depths', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({
      choices: [{ message: { content: '{"verdict":"approve","notes":"Looks sound.","risks":[]}' } }],
    });
  };

  for (const provider of ['fireworks', 'openrouter']) {
    process.env.REVIEW_PROVIDER = provider;
    const standard = await standardReview(pr);
    const deep = await deepReview(pr, [{
      num: 41,
      subsystem: 'payments/rounding',
      description: 'Half-cent boundary rounded down.',
      similarity: 0.94,
    }]);
    assert.match(standard.model, new RegExp(`^${provider}/`));
    assert.match(deep.model, new RegExp(`^${provider}/`));
  }

  assert.equal(calls.length, 4);
  assert.ok(calls.slice(0, 2).every((call) => call.url.includes('api.fireworks.ai')));
  assert.ok(calls.slice(2).every((call) => call.url.includes('openrouter.ai')));
  assert.ok(calls.every((call) => JSON.parse(String(call.init.body)).response_format?.type === 'json_object'));
  const openRouterHeaders = new Headers(calls[2].init.headers);
  assert.equal(openRouterHeaders.get('HTTP-Referer'), 'https://receipts.test');
  assert.equal(openRouterHeaders.get('X-OpenRouter-Title'), 'PR-Elo Test');
});

test('invalid provider selection falls back loudly', async () => {
  process.env.REVIEW_PROVIDER = 'invalid';
  const review = await standardReview(pr);
  assert.equal(review.model, 'template (invalid unavailable)');
  assert.match(review.notes, /template verdict/);
});

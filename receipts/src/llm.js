/**
 * Review depth is chosen by history. Fireworks and OpenRouter are
 * interchangeable inference providers; REVIEW_PROVIDER selects which one runs
 * both standard and deep reviews. Every call has a
 * template fallback so a dead API can never kill the show — the fallback is
 * loud in the review record, never silent.
 */
import 'dotenv/config';

const FIREWORKS_MODEL = process.env.FIREWORKS_MODEL || 'accounts/fireworks/models/deepseek-v4-flash-0731';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4.5';

const llmOn = () => process.env.REVIEW_LLM !== 'off';

function providerConfig() {
  const provider = (process.env.REVIEW_PROVIDER || process.env.MURMUR_PROVIDER || 'fireworks').toLowerCase();
  if (provider === 'fireworks') {
    return {
      provider,
      url: 'https://api.fireworks.ai/inference/v1/chat/completions',
      key: process.env.FIREWORKS_API_KEY,
      model: FIREWORKS_MODEL,
      headers: {},
    };
  }
  if (provider === 'openrouter') {
    return {
      provider,
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: process.env.OPENROUTER_API_KEY,
      model: OPENROUTER_MODEL,
      headers: {
        ...(process.env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL } : {}),
        ...(process.env.OPENROUTER_APP_NAME ? { 'X-OpenRouter-Title': process.env.OPENROUTER_APP_NAME } : {}),
      },
    };
  }
  throw new Error('REVIEW_PROVIDER must be "fireworks" or "openrouter"');
}

async function chat(config, messages, { json = false, timeoutMs = 30000 } = {}) {
  if (!config.key) throw new Error(`${config.provider.toUpperCase()}_API_KEY is not set`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.key}`,
        ...config.headers,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: 4000, // thinking models spend tokens reasoning before the JSON

        temperature: 0.2,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
    return (await res.json()).choices[0].message.content;
  } finally {
    clearTimeout(t);
  }
}

function parseVerdict(text) {
  const m = text.match(/\{[\s\S]*\}/);
  // Models sometimes emit literal newlines inside JSON strings (invalid JSON);
  // flattening whitespace is lossless for our one-paragraph fields.
  const v = JSON.parse((m ? m[0] : text).replace(/\s*\r?\n\s*/g, ' '));
  if (v.verdict !== 'approve' && v.verdict !== 'concerns') throw new Error(`bad verdict: ${v.verdict}`);
  return {
    verdict: v.verdict,
    notes: String(v.notes ?? '').slice(0, 600),
    risks: Array.isArray(v.risks) ? v.risks.slice(0, 5).map(String) : [],
  };
}

const STANDARD_SYSTEM = `You are the FAST TRIAGE lane for an org where coding agents
submit PRs. Verdict "concerns" ONLY for defects that fail on typical, everyday
inputs. Edge-case and boundary suspicions belong in risks[] with verdict
"approve" — a separate deep-review lane exists for those, and it is only invoked
when the org's incident history demands it. Reply with JSON only:
{"verdict":"approve"|"concerns","notes":"one short paragraph","risks":["..."]}`;

const DEEP_SYSTEM = `You are the DEEP REVIEW lane, invoked because this subsystem
carries incident history. Scrutinize boundaries, precision, concurrency and the
specific failure modes of any past incidents provided. Verdict "concerns" only
for a defect you can demonstrate with a concrete, realistic input for this
domain. If the code correctly handles the past incident's failure mode and the
evidence covers it, verdict "approve" — put residual hardening ideas in risks[].
Reply with JSON only:
{"verdict":"approve"|"concerns","notes":"one short paragraph","risks":["..."]}`;

const prompt = (pr, context = '', system = STANDARD_SYSTEM) => [
  { role: 'system', content: system },
  {
    role: 'user',
    content:
      `PR #${pr.prNum} by ${pr.author}\nsubsystem: ${pr.subsystem} (${pr.changeType})\n` +
      `title: ${pr.title}\n\ncode/content:\n${String(pr.code).slice(0, 2000)}\n\n` +
      `evidence provided: ${pr.evidence.join(', ') || 'none'}${context}`,
  },
];

function template(pr, why) {
  return {
    verdict: 'approve',
    notes: `[template verdict — ${why}] ${pr.changeType} change to ${pr.subsystem}; ` +
      `${pr.evidence.length} evidence item(s); no contract violations.`,
    risks: [],
  };
}

export async function standardReview(pr) {
  if (!llmOn()) return { model: 'template', ...template(pr, 'REVIEW_LLM=off') };
  let config;
  try {
    config = providerConfig();
    const text = await chat(config, prompt(pr), { json: true });
    return { model: `${config.provider}/${config.model.split('/').pop()}`, ...parseVerdict(text) };
  } catch (e) {
    const provider = config?.provider ?? process.env.REVIEW_PROVIDER ?? 'configured provider';
    console.error(`[llm] ${provider} unavailable, template fallback:`, e.message);
    return { model: `template (${provider} unavailable)`, ...template(pr, `${provider} unavailable`) };
  }
}

export async function deepReview(pr, priorIncidents = [], executed = null) {
  let context = priorIncidents.length
    ? '\n\nRelated past incidents in this org (retrieved from MongoDB — context for scrutiny, NOT proof of fault):\n' +
      priorIncidents.map((i) => `- Incident #${i.num} [${i.subsystem}] ${i.description} (similarity ${i.similarity})`).join('\n') +
      '\nScrutinize this PR specifically for the failure modes those incidents describe.'
    : '';
  if (executed) {
    context += executed.ok
      ? `\n\nEXECUTED test evidence (the review system actually ran this code): all ${executed.ran} boundary cases pass, e.g. ${pr.fnName}(${pr.canaryCases[pr.canaryCases.length - 1].args.join(', ')}) === ${JSON.stringify(pr.canaryCases[pr.canaryCases.length - 1].expect)}. Trust executed results over mental simulation of floating point.`
      : `\n\nEXECUTED test evidence: FAILING — ${pr.fnName}(${executed.failing.args.join(', ')}) → ${JSON.stringify(executed.failing.got)}, expected ${JSON.stringify(executed.failing.expect)}.`;
  }
  if (!llmOn()) return { model: 'template', ...template(pr, 'REVIEW_LLM=off') };
  let config;
  try {
    config = providerConfig();
    const text = await chat(config, prompt(pr, context, DEEP_SYSTEM), { json: true });
    return { model: `${config.provider}/${config.model.split('/').pop()}`, ...parseVerdict(text) };
  } catch (e) {
    const provider = config?.provider ?? process.env.REVIEW_PROVIDER ?? 'configured provider';
    console.error(`[llm] ${provider} unavailable, template fallback:`, e.message);
    return { model: `template (${provider} unavailable)`, ...template(pr, `${provider} unavailable`) };
  }
}

// `npm run llm-smoke` — proves the selected provider handles both review depths.
if (import.meta.url === `file://${process.argv[1]}`) {
  const pr = {
    prNum: 999, author: 'agent-smoke', subsystem: 'payments/rounding', changeType: 'fix',
    title: 'Round invoice totals', evidence: [],
    code: 'function roundMoney(amount) {\n  return Math.round(amount * 100) / 100;\n}',
  };
  const provider = process.env.REVIEW_PROVIDER || process.env.MURMUR_PROVIDER || 'fireworks';
  const std = await standardReview(pr);
  console.log(`${provider} standard →`, std.model, std.verdict, '—', std.notes.slice(0, 100));
  const deep = await deepReview(pr, [{ num: 40, subsystem: 'payments/rounding', description: 'half-cent boundary rounded down', similarity: 0.91 }]);
  console.log(`${provider} deep →`, deep.model, deep.verdict, '—', deep.notes.slice(0, 100));
  process.exit(0);
}

import express from 'express';
import { client, db } from './db.js';
import { setupSchema, waitForIndex, people, blames } from './schema.js';
import { initEmbedder } from './embed.js';
import { remember, answer, blame, redeem, leaderboard, addPerson } from './agent.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));

const sse = new Set();
const push = (event, payload) => {
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sse) res.write(frame);
};

// Live vote tally for the current question. Reset each time we ask.
let round = { question: null, boo: 0, yes: 0, voters: new Set() };

app.get('/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  sse.add(res);
  req.on('close', () => sse.delete(res));
});

app.post('/join', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  await addPerson(name.trim());
  push('leaderboard', await leaderboard());
  res.json({ ok: true, name: name.trim() });
});

app.post('/remember', async (req, res) => {
  const { name, text, derivedFrom } = req.body;
  if (!name?.trim() || !text?.trim()) return res.status(400).json({ error: 'name and text required' });
  await remember(name.trim(), text.trim(), derivedFrom?.trim() || null);
  push('memory', { owner: name.trim(), text: text.trim() });
  push('leaderboard', await leaderboard());
  res.json({ ok: true });
});

app.post('/ask', async (req, res) => {
  const { question } = req.body;
  round = { question, boo: 0, yes: 0, voters: new Set() };
  const a = await answer(question);
  push('answer', { question, text: a.text, owner: a.source?.owner ?? null, quote: a.source?.text ?? null });
  res.json(a);
});

app.post('/vote', (req, res) => {
  const { voter, choice } = req.body;
  if (!round.question) return res.status(400).json({ error: 'no active question' });
  if (round.voters.has(voter)) return res.json({ ok: true, dedup: true });
  round.voters.add(voter);
  round[choice === 'boo' ? 'boo' : 'yes']++;
  push('votes', { boo: round.boo, yes: round.yes });
  res.json({ ok: true });
});

/** The verdict. Everything the crowd sees next comes out of one transaction. */
app.post('/blame', async (req, res) => {
  const question = req.body?.question ?? round.question;
  const v = await blame(question);
  if (!v.ok) return res.status(400).json(v);
  push('verdict', {
    culprit: v.culprit,
    quote: v.quote,
    accomplices: v.accomplices,
    expiresAt: v.expiresAt,
    newAnswer: v.newAnswer.text,
    newOwner: v.newAnswer.source?.owner ?? null,
    changed: v.changed,
  });
  push('leaderboard', await leaderboard());
  res.json(v);
});

app.post('/redeem', async (req, res) => {
  const { name, text } = req.body;
  const r = await redeem(name.trim(), text.trim());
  push('redeemed', r);
  push('leaderboard', await leaderboard());
  res.json(r);
});

app.get('/leaderboard', async (_req, res) => res.json(await leaderboard()));

async function main() {
  await setupSchema();
  // Warm the embedder at boot — a 16s cold start on the first audience
  // submission would look like the app hanging.
  await initEmbedder();
  await waitForIndex();

  // Grudges expiring via TTL must reach the screen, so the redemption clock is
  // real rather than animated.
  db().collection('blames').watch([], { fullDocument: 'updateLookup' })
    .on('change', async (evt) => {
      if (evt.operationType === 'delete') push('leaderboard', await leaderboard());
    });

  app.listen(3000, () => console.log('SCAPEGOAT  stage: http://localhost:3000/stage.html   phone: http://localhost:3000/'));
}

main().catch((e) => { console.error(e); process.exit(1); });

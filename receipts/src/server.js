/**
 * Web process: operator console (/) + stage screen (/stage.html) + SSE.
 * Every pixel on the stage reacts to a MongoDB change stream — the server
 * holds no demo state. Decisions live in the reviewer worker; this process
 * is deliberately just plumbing.
 */
import express from 'express';
import { client, db } from './db.js';
import { initEmbedder } from './embed.js';
import {
  setupSchema, waitForIndex, receipts, incidents, contracts, reviewerStatus,
} from './schema.js';
import { submitPR, shipPR, confirmIncident, addEvidence, standing } from './ops.js';

const PORT = 4000;
const app = express();
app.use(express.json());
app.use(express.static('public'));

const sse = new Set();
const push = (event, payload) => {
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sse) res.write(frame);
};

app.get('/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  sse.add(res);
  req.on('close', () => sse.delete(res));
});

const api = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (e) {
    console.error('[api]', e.message);
    res.status(400).json({ error: e.message });
  }
};

app.post('/submit', api(async (req) => {
  const pr = await submitPR(req.body);
  return { ok: true, prNum: pr.prNum };
}));

app.post('/ship', api(async (req) => shipPR(Number(req.body.prNum))));

app.post('/confirm', api(async (req) => {
  const out = await confirmIncident(Number(req.body.prNum), req.body.overrides ?? {});
  push('standing', await standing());
  return out;
}));

app.post('/evidence', api(async (req) => {
  const r = await addEvidence(Number(req.body.prNum), String(req.body.evidenceKey), req.body.code ?? null);
  return { ok: true, prNum: r.prNum, evidence: r.evidence };
}));

app.get('/standing', api(() => standing()));

app.get('/state', api(async () => ({
  receipts: await receipts().find({}, { projection: { canaryCases: 0 } }).sort({ prNum: -1 }).limit(30).toArray(),
  incidents: await incidents().find({}, { projection: { embedding: 0 } }).sort({ num: -1 }).limit(10).toArray(),
  contracts: await contracts().find().sort({ createdAt: -1 }).toArray(),
  reviewer: await reviewerStatus().findOne({ _id: 'reviewer' }),
  standing: await standing(),
})));

async function main() {
  await setupSchema();
  await initEmbedder(); // warmed here so /submit embeds without a cold start
  await waitForIndex();

  receipts().watch([], { fullDocument: 'updateLookup' }).on('change', async (evt) => {
    if (!evt.fullDocument && evt.operationType !== 'delete') return;
    if (evt.fullDocument) {
      const { canaryCases, ...doc } = evt.fullDocument;
      push('receipt', doc);
    }
    push('standing', await standing());
  });
  incidents().watch([], { fullDocument: 'updateLookup' }).on('change', (evt) => {
    if (evt.fullDocument) {
      const { embedding, ...doc } = evt.fullDocument;
      push('incident', doc);
    }
  });
  contracts().watch([], { fullDocument: 'updateLookup' }).on('change', (evt) => {
    if (evt.fullDocument) push('contract', evt.fullDocument);
  });

  // Reviewer liveness: heartbeat doc older than 6s (or alive:false) reads as
  // dead. This is what makes killing the process visible on the big screen.
  setInterval(async () => {
    const r = await reviewerStatus().findOne({ _id: 'reviewer' }).catch(() => null);
    const alive = Boolean(r?.alive && Date.now() - new Date(r.lastSeen).getTime() < 6000);
    push('reviewer', { generation: r?.generation ?? 0, msgCount: r?.msgCount ?? 0, alive });
  }, 2000);

  app.listen(PORT, () => console.log(
    `PR-Elo  console: http://localhost:${PORT}/   stage: http://localhost:${PORT}/stage.html`,
  ));
}

main().catch((e) => { console.error(e); process.exit(1); });

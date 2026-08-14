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
  githubDeliveries, githubPublications,
} from './schema.js';
import { submitPR, shipPR, confirmIncident, addEvidence, standing } from './ops.js';
import {
  processGitHubDelivery,
  processPendingGitHubDeliveries,
  processPendingGitHubPublications,
  publishGitHubReceipt,
  recordGitHubDelivery,
  verifyGitHubSignature,
} from './github.js';

const PORT = Number(process.env.PORT || 4000);
const app = express();

const sse = new Set();
const push = (event, payload) => {
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sse) res.write(frame);
};

// Signature verification must see the exact bytes GitHub signed. This route
// therefore owns a raw parser and must remain before the global JSON parser.
app.post('/webhooks/github', express.raw({ type: 'application/json', limit: '2mb' }), async (req, res) => {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ error: 'GITHUB_WEBHOOK_SECRET is not configured' });
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? '');
    if (!verifyGitHubSignature(raw, req.get('X-Hub-Signature-256'), secret)) {
      return res.status(401).json({ error: 'invalid GitHub webhook signature' });
    }
    const payload = JSON.parse(raw.toString('utf8'));
    const delivery = await recordGitHubDelivery({
      deliveryId: req.get('X-GitHub-Delivery'),
      eventName: req.get('X-GitHub-Event'),
      payload,
    });
    res.status(202).json({
      ok: true,
      deliveryId: delivery._id,
      accepted: delivery.accepted,
      duplicate: delivery.duplicate,
    });
    if (delivery.accepted) {
      setImmediate(() => {
        processGitHubDelivery(delivery._id).catch((error) => {
          console.error(`[github] delivery ${delivery._id} failed:`, error.message);
        });
      });
    }
  } catch (error) {
    console.error('[github] webhook rejected:', error.message);
    res.status(400).json({ error: error.message });
  }
});

app.use(express.json());
app.use(express.static('public'));

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

app.get('/health', api(async () => ({
  ok: true,
  mongodb: Boolean(await reviewerStatus().findOne({ _id: 'reviewer' }).catch(() => null)),
  webhookConfigured: Boolean(process.env.GITHUB_WEBHOOK_SECRET),
  githubPublishingConfigured: Boolean(process.env.GITHUB_TOKEN) || process.env.GITHUB_AUTH_MODE !== 'disabled',
})));

app.get('/api/live', api(async () => {
  const delivery = await githubDeliveries().findOne(
    { accepted: true },
    { sort: { receivedAt: -1 } },
  );
  const receipt = delivery?.receiptPrNum
    ? await receipts().findOne({ prNum: delivery.receiptPrNum }, { projection: { canaryCases: 0 } })
    : await receipts().findOne(
      { 'github.repository': { $exists: true } },
      { sort: { ts: -1 }, projection: { canaryCases: 0 } },
    );
  const [publication, contract, incident, reviewer] = await Promise.all([
    receipt
      ? githubPublications().findOne({ receiptPrNum: receipt.prNum }, { sort: { createdAt: -1 } })
      : null,
    contracts().findOne({ demoKey: 'named-enum-msvc' }),
    incidents().findOne({ num: 132850 }, { projection: { embedding: 0 } }),
    reviewerStatus().findOne({ _id: 'reviewer' }),
  ]);
  const reviewerAlive = Boolean(
    reviewer?.alive && Date.now() - new Date(reviewer.lastSeen).getTime() < 6000,
  );
  return {
    now: new Date(),
    receipt,
    delivery,
    publication,
    contract,
    incident,
    reviewer: reviewer ? { ...reviewer, alive: reviewerAlive } : null,
  };
}));

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

  // Venue wifi will blip; a dropped stream re-opens after 2s and the stage
  // repaints from /state on its own SSE reconnect. Never crash the web process.
  const watchSafe = (label, coll, onChange) => {
    const stream = coll().watch([], { fullDocument: 'updateLookup' });
    stream.on('change', onChange);
    stream.on('error', async (e) => {
      console.error(`[server] ${label} stream dropped, resuming in 2s:`, e.message);
      await stream.close().catch(() => {});
      setTimeout(() => watchSafe(label, coll, onChange), 2000);
    });
  };

  watchSafe('receipts', receipts, async (evt) => {
    if (!evt.fullDocument && evt.operationType !== 'delete') return;
    if (evt.fullDocument) {
      const { canaryCases, ...doc } = evt.fullDocument;
      push('receipt', doc);
      if (doc.github && doc.review && ['approved', 'concerns', 'blocked'].includes(doc.status)) {
        publishGitHubReceipt(doc)
          .then((publication) => publication && push('publication', publication))
          .catch((error) => console.error(`[github] publish PR #${doc.github.number} failed:`, error.message));
      }
    }
    push('standing', await standing());
  });
  watchSafe('incidents', incidents, (evt) => {
    if (evt.fullDocument) {
      const { embedding, ...doc } = evt.fullDocument;
      push('incident', doc);
    }
  });
  watchSafe('contracts', contracts, (evt) => {
    if (evt.fullDocument) push('contract', evt.fullDocument);
  });
  githubDeliveries().watch([], { fullDocument: 'updateLookup' }).on('change', (evt) => {
    if (evt.fullDocument) push('github_delivery', evt.fullDocument);
  });
  githubPublications().watch([], { fullDocument: 'updateLookup' }).on('change', (evt) => {
    if (evt.fullDocument) push('publication', evt.fullDocument);
  });

  // Reviewer liveness: heartbeat doc older than 6s (or alive:false) reads as
  // dead. This is what makes killing the process visible on the big screen.
  setInterval(async () => {
    const r = await reviewerStatus().findOne({ _id: 'reviewer' }).catch(() => null);
    const alive = Boolean(r?.alive && Date.now() - new Date(r.lastSeen).getTime() < 6000);
    push('reviewer', { generation: r?.generation ?? 0, msgCount: r?.msgCount ?? 0, alive });
  }, 2000);

  // GitHub may have received a 202 just before this process died. Replaying
  // durable received/failed deliveries on boot closes that crash window.
  processPendingGitHubDeliveries().catch((error) => {
    console.error('[github] pending-delivery recovery failed:', error.message);
  });
  processPendingGitHubPublications().catch((error) => {
    console.error('[github] pending-publication recovery failed:', error.message);
  });

  app.listen(PORT, () => console.log(
    `PR-Elo  console: http://localhost:${PORT}/   stage: http://localhost:${PORT}/stage.html   ` +
      `live GitHub: http://localhost:${PORT}/live.html`,
  ));
}

main().catch((e) => { console.error(e); process.exit(1); });

/**
 * Idea-agnostic stage plumbing: a MongoDB change stream pushed to the browser
 * over SSE, so the projection screen reacts to database writes with no polling.
 *
 * This is the piece every candidate demo needs — the audience has to SEE a
 * document change cause something. Bind it to whatever collection wins.
 */
import express from 'express';
import { client, db } from './db.js';

const clients = new Set();

export function broadcast(event, payload) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) res.write(frame);
}

/** Streams every change on `collectionName` straight to the stage screen. */
export async function watchCollection(collectionName) {
  const stream = db().collection(collectionName).watch([], {
    fullDocument: 'updateLookup',
  });

  stream.on('change', (evt) => {
    broadcast('change', {
      op: evt.operationType,
      id: evt.documentKey?._id,
      doc: evt.fullDocument ?? null,
      at: Date.now(),
    });
  });

  // A dead change stream means the stage screen silently stops updating, which
  // on stage looks like the whole demo froze. Surface it loudly instead.
  stream.on('error', (err) => {
    console.error(`[stage] change stream on ${collectionName} died:`, err.message);
    broadcast('stream-error', { collection: collectionName, message: err.message });
    process.exitCode = 1;
  });

  console.log(`[stage] watching ${collectionName}`);
  return stream;
}

export function createStageServer({ port = 3000, staticDir = 'public' } = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.static(staticDir));

  app.get('/events', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write('event: hello\ndata: {"ok":true}\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
  });

  app.get('/health', async (_req, res) => {
    const ping = await db().admin().ping().then(() => true).catch(() => false);
    res.json({ mongo: ping, stageClients: clients.size });
  });

  return { app, listen: () => app.listen(port, () => console.log(`[stage] http://localhost:${port}`)) };
}

export async function bootStage({ collection, port = 3000 }) {
  await client.connect();
  const { app, listen } = createStageServer({ port });
  const server = listen();
  await watchCollection(collection);
  return { app, server };
}

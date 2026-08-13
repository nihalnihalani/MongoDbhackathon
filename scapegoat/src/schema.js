/**
 * SCAPEGOAT — the agent that never apologizes. It names the human responsible.
 *
 * Collections:
 *   people      { _id: name, credibility, blamed, trusted }
 *   memories    { text, embedding, owner, derivedFrom }
 *   incidents   { question, blamedOwner, chain, ts }
 *   blame_edges { from, to }        // who-told-whom, walked by $graphLookup
 *   blames      { person, expiresAt } // TTL — grudges expire, redemption is timed
 */
import { client, db } from './db.js';

export const EMBED_DIM = 384;
export const VECTOR_INDEX = 'memory_vec';

export const people = () => db().collection('people');
export const memories = () => db().collection('memories');
export const incidents = () => db().collection('incidents');
export const blameEdges = () => db().collection('blame_edges');
export const blames = () => db().collection('blames');

export const START_CREDIBILITY = 100;

export async function setupSchema() {
  await client.connect();

  await memories().createIndex({ owner: 1 });
  await people().createIndex({ credibility: -1 });
  await blameEdges().createIndex({ from: 1 });
  // Grudges expire on their own clock — this is the redemption timer the crowd watches.
  await blames().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'grudge_ttl' });

  const existing = await memories().listSearchIndexes().toArray().catch(() => []);
  if (!existing.some((i) => i.name === VECTOR_INDEX)) {
    await memories().createSearchIndex({
      name: VECTOR_INDEX,
      type: 'vectorSearch',
      definition: {
        fields: [
          { type: 'vector', path: 'embedding', numDimensions: EMBED_DIM, similarity: 'cosine' },
          { type: 'filter', path: 'owner' },
        ],
      },
    });
    console.log('[schema] building vector index (async)');
  }
}

export async function waitForIndex(timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const idx = (await memories().listSearchIndexes().toArray()).find((i) => i.name === VECTOR_INDEX);
    if (idx?.queryable) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('vector index never became queryable');
}

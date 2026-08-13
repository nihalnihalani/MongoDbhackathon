/**
 * PR-Elo — persistent review confidence.
 *
 * Every merged PR leaves a receipt connecting author, subsystem, promised
 * safeguards and eventual production outcome. Confirmed failures create
 * review contracts: specific evidence future PRs must carry. Reviewer
 * processes are disposable; the contracts are not.
 *
 * Collections:
 *   contributors     { _id: agentName, kind, createdAt }
 *   pr_receipts      { prNum, author, subsystem, changeType, title, code, fnName,
 *                      evidence[], canaryCases[], onFail, status, outcome,
 *                      review, canary, ts }
 *                      status:  submitted | approved | concerns | blocked | merged
 *                      outcome: pending | clean | failed
 *   incidents        { num, prNum, author, subsystem, description, failingCase,
 *                      embedding, confirmedBy, ts }
 *   review_contracts { subsystem, requirement, evidenceKey, incidentNum,
 *                      authorAtFault, active, satisfiedBy[], createdAt }
 *   counters         { _id, seq }
 *   reviewer_status  { _id:'reviewer', generation, msgCount, alive, lastSeen }
 */
import { client, db } from './db.js';

export const EMBED_DIM = 384;
export const VECTOR_INDEX = 'incident_vec';

export const contributors = () => db().collection('contributors');
export const receipts = () => db().collection('pr_receipts');
export const incidents = () => db().collection('incidents');
export const contracts = () => db().collection('review_contracts');
export const counters = () => db().collection('counters');
export const reviewerStatus = () => db().collection('reviewer_status');

export async function nextSeq(name) {
  const r = await counters().findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return r.seq;
}

export async function setSeq(name, value) {
  await counters().updateOne({ _id: name }, { $set: { seq: value } }, { upsert: true });
}

export async function setupSchema() {
  await client.connect();

  await receipts().createIndex({ prNum: 1 }, { unique: true });
  await receipts().createIndex({ author: 1, subsystem: 1 });
  await incidents().createIndex({ num: 1 }, { unique: true });
  await contracts().createIndex({ subsystem: 1, active: 1 });

  const existing = await incidents().listSearchIndexes().toArray().catch(() => []);
  if (!existing.some((i) => i.name === VECTOR_INDEX)) {
    await incidents().createSearchIndex({
      name: VECTOR_INDEX,
      type: 'vectorSearch',
      definition: {
        fields: [
          { type: 'vector', path: 'embedding', numDimensions: EMBED_DIM, similarity: 'cosine' },
        ],
      },
    });
    console.log('[schema] building incident vector index (async)');
  }
}

export async function waitForIndex(timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const idx = (await incidents().listSearchIndexes().toArray()).find((i) => i.name === VECTOR_INDEX);
    if (idx?.queryable) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('incident vector index never became queryable');
}

import { client, db } from './db.js';
import { embed } from './embed.js';
import {
  memories, people, incidents, blameEdges, blames,
  VECTOR_INDEX, START_CREDIBILITY,
} from './schema.js';

/**
 * The whole thesis lives in this pipeline: a person's standing is a first-class
 * rank term, so a social judgment mechanically rewrites which documents come
 * back next. Discredited people are not merely downranked — the $match drops
 * them out of the agent's future entirely.
 */
export async function retrieve(question, { limit = 5 } = {}) {
  const qv = await embed(question);

  return memories().aggregate([
    {
      $vectorSearch: {
        index: VECTOR_INDEX,
        path: 'embedding',
        queryVector: qv,
        numCandidates: 100,
        limit: 25,
      },
    },
    { $addFields: { vectorScore: { $meta: 'vectorSearchScore' } } },
    { $lookup: { from: 'people', localField: 'owner', foreignField: '_id', as: 'ownerDoc' } },
    { $unwind: '$ownerDoc' },
    // Fully discredited people are excluded, not downweighted. This is the punishment.
    { $match: { 'ownerDoc.credibility': { $gt: 0 } } },
    {
      $addFields: {
        credibility: '$ownerDoc.credibility',
        score: { $multiply: ['$vectorScore', { $divide: ['$ownerDoc.credibility', START_CREDIBILITY] }] },
      },
    },
    { $sort: { score: -1 } },
    { $limit: limit },
    { $project: { text: 1, owner: 1, credibility: 1, vectorScore: 1, score: 1, derivedFrom: 1 } },
  ]).toArray();
}

/**
 * Extractive by design: the agent quotes a human verbatim and names them. This
 * needs no LLM (so it survives having zero API keys), it cannot hallucinate,
 * and deadpan attribution is funnier on stage than generated prose.
 */
export async function answer(question) {
  const hits = await retrieve(question);
  if (!hits.length) {
    return { question, text: 'I have no one to blame for an answer to that.', source: null, hits: [] };
  }
  const top = hits[0];
  return {
    question,
    text: `I believe, on the authority of ${top.owner}, that: "${top.text}"`,
    source: top,
    hits,
  };
}

/**
 * The verdict. Every write commits together: if this half-applied, the agent
 * would publicly accuse a human and then keep trusting them — an incoherent
 * state on stage. Blame flows uphill through who-told-whom, and traversal depth
 * IS the sentence.
 */
export async function blame(question, { graceSeconds = 45 } = {}) {
  const hits = await retrieve(question);
  if (!hits.length) return { ok: false, reason: 'nothing to blame' };

  const culprit = hits[0];

  // Who does this memory descend from? Depth becomes degree of guilt.
  const chainRows = await memories().aggregate([
    { $match: { _id: culprit._id } },
    {
      $graphLookup: {
        from: 'blame_edges',
        startWith: '$owner',
        connectFromField: 'to',
        connectToField: 'from',
        as: 'chain',
        maxDepth: 3,
        depthField: 'hops',
      },
    },
  ]).toArray();

  // A person can appear on several derivation edges (they told the culprit more
  // than one thing). Charge them once, at their closest hop — otherwise blame
  // stacks per-edge and the verdict card repeats the same name.
  const closestHop = new Map();
  for (const e of chainRows[0]?.chain ?? []) {
    if (e.to === culprit.owner) continue;
    const hops = e.hops + 1;
    if (!closestHop.has(e.to) || hops < closestHop.get(e.to)) closestHop.set(e.to, hops);
  }
  const accomplices = [...closestHop.entries()].map(([person, hops]) => ({ person, hops }))
    .sort((a, b) => a.hops - b.hops);

  const PENALTY = { 0: 40, 1: 15, 2: 7, 3: 3 };
  const expiresAt = new Date(Date.now() + graceSeconds * 1000);
  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      await people().updateOne(
        { _id: culprit.owner },
        { $inc: { credibility: -PENALTY[0], blamed: 1 } },
        { session },
      );
      for (const a of accomplices) {
        await people().updateOne(
          { _id: a.person },
          { $inc: { credibility: -(PENALTY[a.hops] ?? 3), blamed: 1 } },
          { session },
        );
      }
      await people().updateMany({ credibility: { $lt: 0 } }, { $set: { credibility: 0 } }, { session });
      await blames().insertOne(
        { person: culprit.owner, memory: culprit._id, expiresAt },
        { session },
      );
      await incidents().insertOne(
        {
          question,
          blamedOwner: culprit.owner,
          quote: culprit.text,
          accomplices,
          ts: new Date(),
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  const after = await answer(question);
  return {
    ok: true,
    culprit: culprit.owner,
    quote: culprit.text,
    accomplices,
    expiresAt,
    newAnswer: after,
    // The proof the crowd watches: same question, different answer, because a
    // document changed — not because the prompt did.
    changed: after.source?.owner !== culprit.owner,
  };
}

/** Redemption: one accepted memory restores standing, live. */
export async function redeem(person, text) {
  const embedding = await embed(text);
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await memories().insertOne({ text, embedding, owner: person, createdAt: new Date() }, { session });
      await people().updateOne(
        { _id: person },
        { $set: { credibility: START_CREDIBILITY }, $inc: { trusted: 1 } },
        { session },
      );
      await blames().deleteMany({ person }, { session });
    });
  } finally {
    await session.endSession();
  }
  return { ok: true, person, restored: START_CREDIBILITY };
}

export async function leaderboard() {
  return people().find({}, { projection: { credibility: 1, blamed: 1, trusted: 1 } })
    .sort({ credibility: -1 }).toArray();
}

export async function addPerson(name) {
  await people().updateOne(
    { _id: name },
    { $setOnInsert: { credibility: START_CREDIBILITY, blamed: 0, trusted: 0 } },
    { upsert: true },
  );
}

export async function remember(owner, text, derivedFrom = null) {
  await addPerson(owner);
  const embedding = await embed(text);
  const doc = { text, embedding, owner, derivedFrom, createdAt: new Date() };
  const { insertedId } = await memories().insertOne(doc);
  if (derivedFrom) await blameEdges().insertOne({ from: owner, to: derivedFrom });
  return insertedId;
}

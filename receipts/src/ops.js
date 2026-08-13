/**
 * Domain operations shared by the server, the reviewer worker, the seed and
 * the proof harness. Attribution rule: embeddings retrieve related incidents;
 * fault is only ever assigned by confirmIncident — a failing canary case plus
 * an explicit operator confirmation.
 */
import { client } from './db.js';
import { embed } from './embed.js';
import {
  contributors, receipts, incidents, contracts, nextSeq, VECTOR_INDEX,
} from './schema.js';

export async function submitPR({
  author, subsystem, changeType = 'feature', title, code, fnName = null,
  evidence = [], canaryCases = [], onFail = null, github = null,
}) {
  await contributors().updateOne(
    { _id: author },
    { $setOnInsert: { kind: 'coding-agent', createdAt: new Date() } },
    { upsert: true },
  );
  const prNum = await nextSeq('pr');
  const doc = {
    prNum, author, subsystem, changeType, title, code, fnName,
    evidence, canaryCases, onFail, github,
    status: 'submitted', outcome: 'pending', review: null, canary: null,
    ts: new Date(),
  };
  await receipts().insertOne(doc);
  return doc;
}

/** Top related incidents for a PR — review context, never a verdict. */
export async function similarIncidents(pr, limit = 3) {
  const qv = await embed(`${pr.subsystem} ${pr.title} ${String(pr.code).slice(0, 500)}`);
  return incidents().aggregate([
    { $vectorSearch: { index: VECTOR_INDEX, path: 'embedding', queryVector: qv, numCandidates: 50, limit } },
    { $project: { _id: 0, num: 1, subsystem: 1, description: 1, similarity: { $round: [{ $meta: 'vectorSearchScore' }, 2] } } },
  ]).toArray();
}

/**
 * The canary actually executes the PR's function against boundary cases.
 * A red canary is evidence — not yet fault.
 *
 * new Function() here is deliberate and demo-scoped: the "PR code" it runs is
 * authored by the operator at the console of a local demo. Do not expose this
 * endpoint to untrusted submitters without a real sandbox.
 */
export function runCanary(pr) {
  if (!pr.canaryCases?.length || !pr.fnName) return { ok: true, ran: 0 };
  let fn;
  try {
    fn = new Function(`${pr.code}; return ${pr.fnName};`)();
  } catch (e) {
    return { ok: false, ran: 0, failing: { args: [], expect: 'valid function', got: `parse error: ${e.message}` } };
  }
  let ran = 0;
  for (const c of pr.canaryCases) {
    ran += 1;
    let got;
    try { got = fn(...c.args); } catch (e) { got = `threw: ${e.message}`; }
    if (got !== c.expect) return { ok: false, ran, failing: { args: c.args, expect: c.expect, got } };
  }
  return { ok: true, ran };
}

export async function shipPR(prNum) {
  const pr = await receipts().findOne({ prNum });
  if (!pr) throw new Error(`PR #${prNum} not found`);
  const canary = runCanary(pr);
  await receipts().updateOne(
    { prNum },
    { $set: { status: 'merged', canary, ...(canary.ok ? { outcome: 'clean' } : {}) } },
  );
  return { prNum, canary };
}

/**
 * Operator confirms the failure↔PR linkage. One transaction writes the
 * incident, the failed outcome and the review contract together — a
 * half-applied verdict (incident recorded but no future requirement) would
 * defeat the whole premise.
 */
export async function confirmIncident(prNum, overrides = {}) {
  const pr = await receipts().findOne({ prNum });
  if (!pr) throw new Error(`PR #${prNum} not found`);
  const spec = { ...pr.onFail, ...overrides };
  if (!spec.requirement || !spec.evidenceKey) throw new Error('requirement and evidenceKey needed');
  const description = spec.description
    ?? `${pr.subsystem} failure in PR #${prNum} (${pr.title})`;

  const num = await nextSeq('incident');
  const embedding = await embed(`${pr.subsystem} ${description}`);
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await incidents().insertOne({
        num, prNum, author: pr.author, subsystem: pr.subsystem,
        description, failingCase: pr.canary?.failing ?? null,
        embedding, confirmedBy: 'operator', ts: new Date(),
      }, { session });
      await receipts().updateOne({ prNum }, { $set: { outcome: 'failed' } }, { session });
      await contracts().insertOne({
        subsystem: pr.subsystem,
        requirement: spec.requirement,
        evidenceKey: spec.evidenceKey,
        incidentNum: num,
        authorAtFault: pr.author,
        active: true,
        satisfiedBy: [],
        createdAt: new Date(),
      }, { session });
    });
  } finally {
    await session.endSession();
  }
  return { num, prNum, subsystem: pr.subsystem, requirement: spec.requirement, evidenceKey: spec.evidenceKey };
}

/**
 * Attach evidence (and optionally the fixed code) and requeue for review —
 * this is how proof debt gets paid. Evidence without a fix won't survive the
 * deep review, which re-reviews with the incident in context.
 */
export async function addEvidence(prNum, evidenceKey, code = null) {
  const r = await receipts().findOneAndUpdate(
    { prNum },
    {
      $addToSet: { evidence: evidenceKey },
      $set: { status: 'submitted', review: null, ...(code ? { code } : {}) },
    },
    { returnDocument: 'after' },
  );
  if (!r) throw new Error(`PR #${prNum} not found`);
  return r;
}

/**
 * Scoped standing: contributor × subsystem, never the whole person.
 * "unknown" is the starting state — no evidence does not mean maximum trust.
 */
export async function standing() {
  const rows = await receipts().aggregate([
    {
      $group: {
        _id: { author: '$author', subsystem: '$subsystem' },
        outcomes: { $sum: { $cond: [{ $ne: ['$outcome', 'pending'] }, 1, 0] } },
        clean: { $sum: { $cond: [{ $eq: ['$outcome', 'clean'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$outcome', 'failed'] }, 1, 0] } },
      },
    },
    {
      $lookup: {
        from: 'review_contracts',
        let: { sub: '$_id.subsystem', auth: '$_id.author' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$subsystem', '$$sub'] },
                  { $eq: ['$authorAtFault', '$$auth'] },
                  { $eq: ['$active', true] },
                ],
              },
            },
          },
        ],
        as: 'debts',
      },
    },
    {
      $addFields: {
        openDebt: {
          $size: { $filter: { input: '$debts', cond: { $eq: [{ $size: '$$this.satisfiedBy' }, 0] } } },
        },
      },
    },
    { $project: { debts: 0 } },
    {
      $group: {
        _id: '$_id.author',
        areas: {
          $push: {
            subsystem: '$_id.subsystem',
            outcomes: '$outcomes', clean: '$clean', failed: '$failed', openDebt: '$openDebt',
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]).toArray();

  for (const row of rows) {
    row.areas.sort((a, b) => a.subsystem.localeCompare(b.subsystem));
    for (const a of row.areas) {
      a.state = a.openDebt > 0 ? 'proof-debt'
        : a.outcomes === 0 ? 'unknown'
        : a.failed === 0 && a.clean >= 5 ? 'proven'
        : 'building';
    }
  }
  return rows;
}

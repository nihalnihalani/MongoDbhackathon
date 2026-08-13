/**
 * Seeds the org's history so the standing tree opens with all three states
 * visible: proven, unknown, and (after the live incident) proof debt.
 * Counters are set so the live demo lands on PR #481 and Incident #41.
 *
 *   node src/seed.js
 */
import { client } from './db.js';
import { embed, initEmbedder } from './embed.js';
import {
  setupSchema, waitForIndex, setSeq,
  contributors, receipts, incidents, contracts, counters, reviewerStatus,
} from './schema.js';
import { standing } from './ops.js';

const AGENTS = ['agent-maya', 'agent-kevin', 'agent-liam'];

// [author, subsystem, clean receipts] — history that earns "proven".
const HISTORY = [
  ['agent-maya', 'frontend/ui', 23],
  ['agent-maya', 'docs', 4],
  ['agent-kevin', 'api/endpoints', 6],
  ['agent-liam', 'database/migrations', 12],
  ['agent-liam', 'payments/rounding', 5],
  // agent-kevin has ZERO payments history — his live PR starts from "unknown",
  // not from 100. No evidence does not mean maximum trust.
];

// Prior confirmed incidents — the corpus vector search retrieves against.
const PRIOR_INCIDENTS = [
  [38, 'auth/session', 'agent-kevin', 'Session timeout treated as authenticated; users stayed logged in after expiry'],
  [39, 'frontend/ui', 'agent-maya', 'Unescaped HTML in profile bio allowed markup injection on the org dashboard'],
  [40, 'database/migrations', 'agent-liam', 'Migration locked the accounts table for 40 seconds during peak traffic'],
];

async function main() {
  await setupSchema();
  await initEmbedder();

  for (const c of [contributors(), receipts(), incidents(), contracts(), counters(), reviewerStatus()]) {
    await c.deleteMany({});
  }
  await waitForIndex();

  for (const name of AGENTS) {
    await contributors().insertOne({ _id: name, kind: 'coding-agent', createdAt: new Date() });
  }

  let prNum = 400;
  const docs = [];
  for (const [author, subsystem, n] of HISTORY) {
    for (let i = 0; i < n; i += 1) {
      prNum += 1;
      docs.push({
        prNum, author, subsystem, changeType: 'feature',
        title: `${subsystem} change ${i + 1}`, code: '// merged before the demo window',
        fnName: null, evidence: [], canaryCases: [], onFail: null,
        status: 'merged', outcome: 'clean', review: null, canary: null,
        ts: new Date(Date.now() - (n - i) * 86400000),
      });
    }
  }
  await receipts().insertMany(docs);

  for (const [num, subsystem, author, description] of PRIOR_INCIDENTS) {
    await incidents().insertOne({
      num, prNum: null, author, subsystem, description,
      failingCase: null, embedding: await embed(`${subsystem} ${description}`),
      confirmedBy: 'operator', ts: new Date(Date.now() - (41 - num) * 86400000),
    });
  }

  // One historical contract, already satisfied — the screen shows debt CAN be
  // paid, which makes the live unpaid one legible.
  await contracts().insertOne({
    subsystem: 'frontend/ui', requirement: 'Output-escaping audit',
    evidenceKey: 'escape-audit', incidentNum: 39, authorAtFault: 'agent-maya',
    active: true, satisfiedBy: [452], createdAt: new Date(Date.now() - 2 * 86400000),
  });

  await setSeq('pr', 480);        // live demo PR becomes #481
  await setSeq('incident', 40);   // live incident becomes #41
  await setSeq('reviewer_generation', 0);

  // Give the vector index a beat to pick up the incident embeddings.
  await new Promise((r) => setTimeout(r, 5000));

  console.log('\nStanding after seed:');
  for (const row of await standing()) {
    console.log(`  ${row._id}`);
    for (const a of row.areas) {
      console.log(`    ${a.subsystem}: ${a.state} (${a.clean} clean, ${a.failed} failed, debt ${a.openDebt})`);
    }
  }

  await client.close();
  console.log('\nSeeded. Start the reviewer and reload the stage.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });

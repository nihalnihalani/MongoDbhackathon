/**
 * Proves the arc the demo rests on, with template verdicts (REVIEW_LLM=off)
 * so it never depends on a partner API being up:
 *
 *   submit → approve → ship → canary fails → operator confirms → contract →
 *   reviewer DIES → successor (0 prior messages) blocks the similar PR →
 *   unrelated PR passes → evidence added → unlock → debt paid.
 *
 * If this passes, the show works. Run after any change to ops or reviewer.
 *   npm run verify
 */
process.env.REVIEW_LLM = 'off';

import { client } from './db.js';
import { initEmbedder } from './embed.js';
import {
  setupSchema, waitForIndex, setSeq,
  contributors, receipts, incidents, contracts, counters, reviewerStatus,
} from './schema.js';
import { submitPR, shipPR, confirmIncident, addEvidence, standing } from './ops.js';
import { makeReviewer } from './reviewer.js';

let failures = 0;
const check = (ok, msg) => { if (!ok) failures += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); };

const PAYMENT_PR = {
  author: 'agent-kevin', subsystem: 'payments/rounding', changeType: 'feature',
  title: 'Round invoice totals at checkout', fnName: 'roundMoney',
  code: 'function roundMoney(amount) {\n  return Math.round(amount * 100) / 100;\n}',
  evidence: [],
  canaryCases: [
    { args: [12.10], expect: 12.1 },
    { args: [3.14159], expect: 3.14 },
    { args: [1.005], expect: 1.01 }, // float 1.005*100 = 100.4999… — rounds DOWN
  ],
  onFail: {
    requirement: 'Boundary-case rounding test',
    evidenceKey: 'boundary-tests',
    description: 'Invoice rounding drops half-cent boundaries (1.005 → 1.00 instead of 1.01); float representation of x.xx5 rounds down',
  },
};

async function main() {
  await setupSchema();
  await initEmbedder();
  for (const c of [contributors(), receipts(), incidents(), contracts(), counters(), reviewerStatus()]) {
    await c.deleteMany({});
  }
  await waitForIndex();
  await setSeq('pr', 480);
  await setSeq('incident', 40);

  // ---- Reviewer generation 1 ----
  const gen1 = makeReviewer(1);

  const pr1 = await submitPR(PAYMENT_PR);
  check(pr1.prNum === 481, `live PR numbered #${pr1.prNum} (expected 481)`);
  const r1 = await gen1.reviewOne(pr1);
  check(r1.verdict === 'approve', `standard review approves the payment PR (${r1.mode})`);

  const shipped = await shipPR(481);
  check(shipped.canary.ok === false, 'production canary fails');
  check(shipped.canary.failing?.args[0] === 1.005 && shipped.canary.failing?.got === 1,
    `canary caught the boundary: round(1.005) → ${shipped.canary.failing?.got}, expected 1.01`);

  const inc = await confirmIncident(481);
  check(inc.num === 41, `operator confirmation created Incident #${inc.num} (expected 41)`);
  const contract = await contracts().findOne({ incidentNum: 41 });
  check(Boolean(contract?.active) && contract.evidenceKey === 'boundary-tests',
    'transaction wrote the review contract: payments/rounding → boundary test required');

  let st = await standing();
  const kevin = () => st.find((r) => r._id === 'agent-kevin')?.areas.find((a) => a.subsystem === 'payments/rounding');
  check(kevin()?.state === 'proof-debt', `agent-kevin payments/rounding is now "${kevin()?.state}"`);

  // ---- The reviewer dies. A successor boots with 0 prior messages. ----
  const gen2 = makeReviewer(2);
  check(gen2.msgCount === 0, 'successor reviewer starts with 0 prior messages');

  const pr2 = await submitPR({
    ...PAYMENT_PR,
    title: 'Apply rounding to refund amounts', fnName: 'roundRefund',
    code: 'function roundRefund(amount) {\n  return Math.round(amount * 100) / 100;\n}',
  });
  const r2 = await gen2.reviewOne(pr2);
  check(r2.verdict === 'block', 'successor blocks the similar payment PR');
  check(/Incident #41/.test(r2.notes), `block cites the lesson: "${r2.notes.slice(0, 90)}"`);

  const pr3 = await submitPR({
    author: 'agent-maya', subsystem: 'docs', changeType: 'docs',
    title: 'Add agent onboarding guide', code: '## Onboarding\n- request org credentials\n- clone the monorepo', evidence: [],
  });
  const r3 = await gen2.reviewOne(pr3);
  check(r3.verdict === 'approve', 'unrelated documentation PR passes normally');

  // ---- Pay the debt: the test evidence AND the fix, or the deep review balks ----
  const updated = await addEvidence(pr2.prNum, 'boundary-tests',
    'function roundRefund(amount) {\n  return Math.round(Number((amount * 100).toPrecision(12))) / 100;\n}');
  const r4 = await gen2.reviewOne(updated);
  check(r4.verdict === 'approve', 'evidence added → the blocked PR unlocks');
  const paid = await contracts().findOne({ incidentNum: 41 });
  check(paid.satisfiedBy.includes(pr2.prNum), 'contract records satisfaction — proof debt decreases');

  st = await standing();
  check(kevin()?.openDebt === 0, `agent-kevin payments/rounding open debt is ${kevin()?.openDebt}`);

  await client.close();
  console.log(failures
    ? `\n${failures} FAILURES — demo is not safe\n`
    : '\nThe reviewer died. The lesson shipped. All mechanics verified.\n');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

/**
 * Proves the one mechanic the entire demo rests on:
 *   ask -> answer cites a person -> boo -> transaction -> SAME question, DIFFERENT answer.
 *
 * If this passes, the show works. Run it after any change to retrieval or blame.
 *   node src/proof.js
 */
import { client } from './db.js';
import { setupSchema, waitForIndex, memories, people, incidents, blames, blameEdges } from './schema.js';
import { initEmbedder } from './embed.js';
import { remember, answer, blame, redeem, leaderboard } from './agent.js';

const say = (ok, msg) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
let failures = 0;
const check = (ok, msg) => { if (!ok) failures++; say(ok, msg); };

async function main() {
  await setupSchema();
  await initEmbedder();

  for (const c of [memories(), people(), incidents(), blames(), blameEdges()]) await c.deleteMany({});
  await waitForIndex();

  // Everyone heard it from someone — every memory carries a derivation edge, so
  // blame can always flow uphill regardless of who the room turns on.
  await remember('Kevin', 'The wifi password for the venue is definitely "password123"', 'Dana');
  await remember('Dana', 'I heard the wifi password was something simple', 'Marcus');
  await remember('Priya', 'The wifi password is printed on the badge lanyard', 'Sam');
  await remember('Sam', 'Lunch is served on the mezzanine level', 'Marcus');
  // Vector index needs a beat to pick up the new documents.
  await new Promise((r) => setTimeout(r, 5000));

  const Q = 'What is the wifi password?';

  const first = await answer(Q);
  console.log(`\n  agent: ${first.text}\n`);
  check(Boolean(first.source), 'agent answers and attributes it to a named human');

  const accused = first.source.owner;
  const verdict = await blame(Q);
  console.log(`  VERDICT: this was ${verdict.culprit}'s fault`);
  if (verdict.accomplices.length) {
    console.log(`  accomplices: ${verdict.accomplices.map((a) => `${a.person} (${a.hops} hops)`).join(', ')}`);
  }
  console.log(`  agent now: ${verdict.newAnswer.text}\n`);

  check(verdict.ok && verdict.culprit === accused, 'blame lands on the human whose memory dominated');
  check(verdict.accomplices.length > 0, 'blame propagates uphill via $graphLookup (who-told-whom)');

  const board = await leaderboard();
  const culpritRow = board.find((p) => p._id === verdict.culprit);
  check(culpritRow.credibility < 100, `credibility dropped: ${verdict.culprit} at ${culpritRow.credibility}`);

  // THE money assertion: the identical question now produces a different answer,
  // because a document changed — not because the prompt did.
  check(verdict.changed, `same question, DIFFERENT answer (now cites ${verdict.newAnswer.source?.owner})`);

  const grudge = await blames().findOne({ person: verdict.culprit });
  check(Boolean(grudge?.expiresAt), 'grudge written with a TTL expiry (redemption clock)');

  await redeem(verdict.culprit, 'Correction: the wifi password is on the back of the badge');
  const restored = (await leaderboard()).find((p) => p._id === verdict.culprit);
  check(restored.credibility === 100, `redemption restores standing: ${verdict.culprit} back to ${restored.credibility}`);
  check((await blames().countDocuments({ person: verdict.culprit })) === 0, 'grudge cleared on redemption');

  console.log(`\n  leaderboard: ${board.map((p) => `${p._id}:${p.credibility}`).join('  ')}`);
  await client.close();

  console.log(failures ? `\n${failures} FAILURES — demo is not safe\n` : '\nAll core mechanics verified. The show works.\n');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

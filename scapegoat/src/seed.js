/**
 * Demo corpus. Tuned so the confidently-wrong memory wins the FIRST answer —
 * the room boos, blame lands, and the truth surfaces underneath it. Seed order
 * does not matter; ranking does, so the wrong answer echoes the question's
 * wording more closely than the right one.
 *
 *   node src/seed.js
 */
import { client } from './db.js';
import { setupSchema, waitForIndex, memories, people, incidents, blames, blameEdges } from './schema.js';
import { initEmbedder } from './embed.js';
import { remember, answer } from './agent.js';

const CORPUS = [
  // The trap: phrased almost exactly like the question people will ask.
  ['Kevin', 'The wifi password is password123', 'Dana'],
  // Dana is in Kevin's derivation chain so blame can flow uphill, but her own
  // memory must not compete on the wifi question — otherwise the agent falls
  // from one wrong answer to another instead of landing on the truth.
  ['Dana', 'I set up the check-in laptops this morning', 'Marcus'],
  // The truth: correct, but worded further from the question.
  ['Priya', 'Network credentials are printed on the back of every badge lanyard', 'Sam'],
  ['Sam', 'Badges were handed out at the Terry Francois entrance', 'Marcus'],
  ['Marcus', 'Registration opened at one in the afternoon'],

  ['Kevin', 'Submissions are due at six thirty', 'Dana'],          // wrong — due at 5:00
  ['Priya', 'Hacking stops at five o\'clock sharp and the video is due then', 'Sam'],

  ['Sam', 'The stage is called the Embarcadero Stage'],
  ['Priya', 'Loud Luxury plays at eight'],
  ['Marcus', 'Pier 48 is one block from the Mission Rock Muni station'],
];

async function main() {
  await setupSchema();
  await initEmbedder();
  for (const c of [memories(), people(), incidents(), blames(), blameEdges()]) await c.deleteMany({});
  await waitForIndex();

  for (const [owner, text, src] of CORPUS) await remember(owner, text, src ?? null);
  await new Promise((r) => setTimeout(r, 5000)); // let the vector index catch up

  for (const q of ['What is the wifi password?', 'When are submissions due?']) {
    const a = await answer(q);
    console.log(`\n  Q: ${q}\n  A: ${a.text}`);
    console.log(`  ranking: ${a.hits.map((h) => `${h.owner}(${h.score.toFixed(3)})`).join('  ')}`);
  }

  await client.close();
  console.log('\nSeeded. Reload the stage screen.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });

/**
 * The reviewer worker — deliberately disposable. Kill it mid-demo; its
 * successor boots with zero conversation history and enforces the same
 * contracts, because every lesson lives in MongoDB, not in the process.
 *
 * Run: node src/reviewer.js   (Ctrl-C on stage for the death beat)
 */
import { client } from './db.js';
import { initEmbedder } from './embed.js';
import {
  setupSchema, waitForIndex, receipts, contracts, reviewerStatus, nextSeq,
} from './schema.js';
import { similarIncidents, runCanary } from './ops.js';
import { standardReview, deepReview } from './llm.js';

export function makeReviewer(generation) {
  let msgCount = 0;

  async function reviewOne(pr) {
    msgCount += 1;
    const by = `reviewer#${generation}`;

    // The only history this process has: contracts and incidents read from
    // MongoDB right now. Nothing is carried in memory between PRs on purpose.
    const active = await contracts().find({ subsystem: pr.subsystem, active: true }).toArray();
    const similar = await similarIncidents(pr).catch(() => []);
    const unmet = active.filter((c) => !pr.evidence.includes(c.evidenceKey));

    if (unmet.length) {
      const c = unmet[0];
      const sim = similar.find((s) => s.num === c.incidentNum);
      const review = {
        by, msgCount, mode: 'contract-block', model: null, verdict: 'block',
        notes: `Incident #${c.incidentNum} matched${sim ? ` (similarity ${sim.similarity})` : ''}. ` +
          `${c.requirement} required before this ${pr.subsystem} change can merge.`,
        unmet: unmet.map((u) => ({ incidentNum: u.incidentNum, evidenceKey: u.evidenceKey, requirement: u.requirement })),
      };
      await receipts().updateOne({ prNum: pr.prNum }, { $set: { status: 'blocked', review } });
      return review;
    }

    // Evidence present for a standing contract → record satisfaction. This is
    // the moment proof debt goes down, and the reviewer is the one who says so.
    for (const c of active) {
      if (pr.evidence.includes(c.evidenceKey)) {
        await contracts().updateOne({ _id: c._id }, { $addToSet: { satisfiedBy: pr.prNum } });
      }
    }

    // Depth follows history. The selected provider runs either prompt; provider
    // choice is deployment configuration, not review policy.
    const escalate = active.length > 0 || similar.some((s) => s.similarity >= 0.75);

    // Evidence is executed, not taken on faith: run the PR's own boundary
    // cases and give the model real results instead of speculation.
    const executed = escalate && pr.fnName && pr.canaryCases?.length ? runCanary(pr) : null;

    let result = escalate ? await deepReview(pr, similar, executed) : await standardReview(pr);

    // Executed, passing contract evidence outranks model opinion — that is the
    // org's rule, and the model's reservations stay on the record.
    const evidenceMet = active.length > 0 && active.every((c) => pr.evidence.includes(c.evidenceKey));
    if (escalate && executed?.ok && evidenceMet && result.verdict === 'concerns') {
      result = {
        ...result,
        verdict: 'approve',
        notes: `Contract evidence executed: ${executed.ran}/${executed.ran} boundary cases pass. ` +
          `Critic reservations on record: ${result.notes}`,
      };
    }
    const review = { by, msgCount, mode: escalate ? 'deep' : 'standard', ...result };
    const status = review.verdict === 'approve' ? 'approved' : 'concerns';
    await receipts().updateOne({ prNum: pr.prNum }, { $set: { status, review } });
    return review;
  }

  return { reviewOne, get msgCount() { return msgCount; } };
}

async function main() {
  // Boot must also outlive a network outage (venue DNS died live today):
  // retry until Atlas is reachable rather than exiting.
  for (;;) {
    try {
      await setupSchema();
      await waitForIndex();
      break;
    } catch (e) {
      console.error('[reviewer] cannot reach Atlas, retrying in 5s:', e.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  await initEmbedder();

  const generation = await nextSeq('reviewer_generation');
  const me = makeReviewer(generation);

  const beat = () => reviewerStatus().updateOne(
    { _id: 'reviewer' },
    { $set: { generation, msgCount: me.msgCount, alive: true, lastSeen: new Date() } },
    { upsert: true },
  ).catch(() => {});
  await beat();
  const heart = setInterval(beat, 2000);

  console.log(`[reviewer#${generation}] online — 0 prior messages, all knowledge from MongoDB`);

  // Anything submitted while no reviewer was alive gets picked up first.
  for await (const pr of receipts().find({ status: 'submitted' })) {
    const r = await me.reviewOne(pr);
    console.log(`[reviewer#${generation}] PR #${pr.prNum} → ${r.verdict}: ${r.notes.slice(0, 90)}`);
  }

  // Venue wifi will blip. A dropped change stream re-opens after 2s and any
  // PR submitted during the gap is picked up by the pending re-scan — the
  // reviewer only dies when someone kills it on purpose.
  const startWatch = () => {
    const stream = receipts().watch(
      [{
        $match: {
          $or: [
            { operationType: 'insert' },
            { 'updateDescription.updatedFields.status': 'submitted' },
          ],
        },
      }],
      { fullDocument: 'updateLookup' },
    );
    stream.on('change', async (evt) => {
      const pr = evt.fullDocument;
      if (pr?.status !== 'submitted') return;
      try {
        const r = await me.reviewOne(pr);
        console.log(`[reviewer#${generation}] PR #${pr.prNum} → ${r.verdict}: ${r.notes.slice(0, 90)}`);
      } catch (e) {
        console.error(`[reviewer#${generation}] review of PR #${pr?.prNum} failed:`, e);
      }
    });
    stream.on('error', async (e) => {
      if (dying) return; // client.close() interrupts the stream — that's the plan
      console.error('[reviewer] change stream dropped, resuming in 2s:', e.message);
      await stream.close().catch(() => {});
      setTimeout(async () => {
        try {
          startWatch();
          for await (const pr of receipts().find({ status: 'submitted' })) {
            await me.reviewOne(pr).catch((err) => console.error('[reviewer] rescan failed:', err.message));
          }
        } catch (err) {
          // Network still down (DNS included) — keep trying; the driver
          // recovers the moment the venue wifi does.
          console.error('[reviewer] resume failed, retrying:', err.message);
          stream.emit('error', err);
        }
      }, 2000);
    });
  };
  startWatch();

  // Graceful death marks the tombstone; kill -9 is caught by heartbeat expiry.
  let dying = false;
  process.on('SIGINT', async () => {
    dying = true;
    clearInterval(heart);
    await reviewerStatus().updateOne({ _id: 'reviewer' }, { $set: { alive: false } }).catch(() => {});
    console.log(`\n[reviewer#${generation}] dead after ${me.msgCount} message(s). The contracts survive me.`);
    await client.close();
    process.exit(0);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Supervisor stance: this process dies ONLY when a human kills it. Total
  // network loss (observed live: getaddrinfo ENOTFOUND during a wifi drop)
  // must strand it waiting, loudly, not exit it.
  process.on('unhandledRejection', (e) => console.error('[reviewer] unhandled rejection (surviving):', e?.message ?? e));
  process.on('uncaughtException', (e) => console.error('[reviewer] uncaught exception (surviving):', e?.message ?? e));
  main().catch((e) => { console.error(e); process.exit(1); });
}

/**
 * Adds one evidence-bounded organizational memory without deleting anyone's
 * existing demo data. The source sequence is public; the exact CI failure is
 * explicitly recorded as an inference rather than a fact.
 */
import { client } from './db.js';
import { embed, initEmbedder } from './embed.js';
import { reviewEventForReceipt } from './leaderboard.js';
import {
  contracts, incidents, leaderboardProfiles, receipts, setupSchema, waitForIndex,
} from './schema.js';

const INCIDENT = {
  num: 132850,
  prNum: null,
  author: null,
  subsystem: 'query/named-enum',
  description:
    'SERVER-132850 landed, was auto-reverted 2h23m later, then re-landed with an explicit ' +
    'EXPAND/rescan layer for MSVC traditional-preprocessor variadic macro dispatch. The remediation ' +
    'delta supports this review requirement; the public mirror does not expose the exact CI failure.',
  failingCase: null,
  confirmedBy: 'public landing/revert/reland sequence; causality marked as inference',
  sources: [
    'https://github.com/mongodb/mongo/commit/e062291c86174278fd58135d224185c2e8c92c2c',
    'https://github.com/mongodb/mongo/commit/f552a7a32f39d5ad237dda68b3770f9fd65fdfd8',
    'https://github.com/mongodb/mongo/commit/639953dff87d640ff58d63536ca7f6edd985debf',
  ],
};

const LEADERBOARD_PROFILES = [
  {
    _id: 'dmoody256:build/package-test',
    handle: 'dmoody256',
    repo: 'mongodb/mongo',
    subsystem: 'build/package-test',
    basis: '9 public commits during Aug 6–13; no scored failure event in this bounded sample',
    profileUrl: 'https://github.com/dmoody256',
    events: [],
  },
  {
    _id: 'sleaux:build/resmoke',
    handle: 'sleaux',
    repo: 'mongodb/mongo',
    subsystem: 'build/resmoke',
    basis: '9 public commits during Aug 6–13; no scored failure event in this bounded sample',
    profileUrl: 'https://github.com/sleaux',
    events: [],
  },
  {
    _id: 'nzolnierzmdb:query/named-enum',
    handle: 'nzolnierzmdb',
    repo: 'mongodb/mongo',
    subsystem: 'query/named-enum',
    basis: 'Public SERVER-132850 landing → auto-revert → corrective re-land',
    profileUrl: 'https://github.com/nzolnierzmdb',
    events: [
      {
        kind: 'auto-revert',
        label: 'SERVER-132850 auto-reverted',
        at: '2026-08-06T20:38:07Z',
        url: 'https://github.com/mongodb/mongo/commit/f552a7a32f39d5ad237dda68b3770f9fd65fdfd8',
        source: 'mongodb/mongo',
      },
      {
        kind: 'corrective-reland',
        label: 'SERVER-132850 corrective re-land',
        at: '2026-08-07T14:25:06Z',
        url: 'https://github.com/mongodb/mongo/commit/639953dff87d640ff58d63536ca7f6edd985debf',
        source: 'mongodb/mongo',
      },
    ],
  },
  {
    _id: 'elise-yz:replication/hash',
    handle: 'elise-yz',
    repo: 'mongodb/mongo',
    subsystem: 'replication/hash',
    basis: 'Public SERVER-132629 landing → auto-revert → corrective re-land',
    profileUrl: 'https://github.com/elise-yz',
    events: [
      {
        kind: 'auto-revert',
        label: 'SERVER-132629 auto-reverted',
        at: '2026-08-07T09:26:20Z',
        url: 'https://github.com/mongodb/mongo/commit/eff8cff0a62a78ab3d02643e8ec6b7f7ba5f7611',
        source: 'mongodb/mongo',
      },
      {
        kind: 'corrective-reland',
        label: 'SERVER-132629 corrective re-land',
        at: '2026-08-07T19:00:10Z',
        url: 'https://github.com/mongodb/mongo/commit/7d3eef2dfe353af4604b6cc3efdf61cd888816f9',
        source: 'mongodb/mongo',
      },
    ],
  },
  {
    _id: 'igpraznik:sharding/index-builds',
    handle: 'igpraznik',
    repo: 'mongodb/mongo',
    subsystem: 'sharding/index-builds',
    basis: 'Public SERVER-132822 landing → auto-revert; no re-land found in the Aug 6–13 window',
    profileUrl: 'https://github.com/igpraznik',
    events: [
      {
        kind: 'auto-revert',
        label: 'SERVER-132822 auto-reverted',
        at: '2026-08-13T10:14:08Z',
        url: 'https://github.com/mongodb/mongo/commit/9e0f6747a4106bbd89d766fa6ebf703d213e1f9b',
        source: 'mongodb/mongo',
      },
    ],
  },
  {
    _id: 'gorajing:query/named-enum',
    handle: 'gorajing',
    repo: 'gorajing/mongo',
    subsystem: 'query/named-enum',
    basis: 'Live signed-webhook PR-Elo receipts from the demo fork',
    profileUrl: 'https://github.com/gorajing',
    isCurrentUser: true,
    events: [],
  },
];

async function main() {
  await setupSchema();
  await initEmbedder();
  await waitForIndex();

  await incidents().updateOne(
    { num: INCIDENT.num },
    {
      $set: {
        ...INCIDENT,
        embedding: await embed(`${INCIDENT.subsystem} ${INCIDENT.description}`),
        ts: new Date('2026-08-07T15:04:19Z'),
      },
    },
    { upsert: true },
  );
  await contracts().updateOne(
    { demoKey: 'named-enum-msvc' },
    {
      $set: {
        subsystem: 'query/named-enum',
        requirement: 'MSVC traditional-preprocessor regression evidence',
        evidenceKey: 'msvc-preprocessor',
        incidentNum: INCIDENT.num,
        authorAtFault: null,
        active: true,
        sourceScope: 'code pattern, not contributor identity',
        createdAt: new Date('2026-08-07T15:04:19Z'),
      },
      $setOnInsert: { satisfiedBy: [] },
    },
    { upsert: true },
  );
  for (const profile of LEADERBOARD_PROFILES) {
    const { _id, ...fields } = profile;
    await leaderboardProfiles().updateOne(
      { _id },
      { $set: { ...fields, active: true, updatedAt: new Date() } },
      { upsert: true },
    );
  }

  // Backfill the two already-demonstrated fork PRs once. Future reviewer
  // transitions append immutable entries as their mutable receipt status moves.
  const legacyReceipts = await receipts().find({
    'github.repository': { $type: 'string' },
    status: { $in: ['blocked', 'concerns', 'approved'] },
    reviewEvents: { $exists: false },
  }).toArray();
  for (const receipt of legacyReceipts) {
    const event = reviewEventForReceipt(receipt);
    if (!event) continue;
    await receipts().updateOne(
      { _id: receipt._id, reviewEvents: { $exists: false } },
      { $set: { reviewEvents: [event] } },
    );
  }

  console.log('GitHub demo memory + evidence-linked contributor leaderboard ready.');
  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

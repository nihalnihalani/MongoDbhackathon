/**
 * Adds one evidence-bounded organizational memory without deleting anyone's
 * existing demo data. The source sequence is public; the exact CI failure is
 * explicitly recorded as an inference rather than a fact.
 */
import { client } from './db.js';
import { embed, initEmbedder } from './embed.js';
import { contracts, incidents, setupSchema, waitForIndex } from './schema.js';

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

  console.log('GitHub demo memory ready: query/named-enum requires msvc-preprocessor evidence.');
  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

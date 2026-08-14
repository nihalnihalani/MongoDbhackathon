import assert from 'node:assert/strict';
import test from 'node:test';

import { buildContributorLeaderboard, scoreEvents } from '../src/leaderboard.js';

test('scoreEvents exposes every transition from the 100 baseline', () => {
  const scored = scoreEvents([
    { kind: 'missing-evidence', label: 'PR #1 blocked', at: '2026-08-13T23:50:41Z' },
    { kind: 'missing-evidence', label: 'PR #2 blocked', at: '2026-08-14T01:15:53Z' },
  ]);

  assert.equal(scored.score, 90);
  assert.deepEqual(scored.trend, [100, 95, 90]);
  assert.deepEqual(scored.events.map(({ from, to, delta }) => ({ from, to, delta })), [
    { from: 100, to: 95, delta: -5 },
    { from: 95, to: 90, delta: -5 },
  ]);
});

test('leaderboard combines public MongoDB evidence with live fork receipts', () => {
  const profiles = [
    {
      handle: 'nzolnierzmdb',
      repo: 'mongodb/mongo',
      subsystem: 'query/named-enum',
      events: [
        { kind: 'auto-revert', label: 'SERVER-132850 auto-reverted', at: '2026-08-06T20:35:00Z' },
        { kind: 'corrective-reland', label: 'SERVER-132850 re-landed', at: '2026-08-07T14:25:06Z' },
      ],
    },
    {
      handle: 'gorajing',
      repo: 'gorajing/mongo',
      subsystem: 'query/named-enum',
      isCurrentUser: true,
      events: [],
    },
  ];
  const receipts = [
    {
      prNum: 1,
      author: 'gorajing',
      subsystem: 'query/named-enum',
      status: 'blocked',
      ts: new Date('2026-08-13T23:50:41Z'),
      github: { number: 1, htmlUrl: 'https://github.com/gorajing/mongo/pull/1' },
    },
    {
      prNum: 2,
      author: 'gorajing',
      subsystem: 'query/named-enum',
      status: 'blocked',
      ts: new Date('2026-08-14T01:15:53Z'),
      github: { number: 2, htmlUrl: 'https://github.com/gorajing/mongo/pull/2' },
    },
  ];

  const rows = buildContributorLeaderboard({ profiles, receipts });
  assert.deepEqual(rows.map(({ handle, score }) => ({ handle, score })), [
    { handle: 'nzolnierzmdb', score: 98 },
    { handle: 'gorajing', score: 90 },
  ]);
  assert.equal(rows[1].events[1].url, 'https://github.com/gorajing/mongo/pull/2');
  assert.equal(rows[1].isCurrentUser, true);
});

test('a recovered PR preserves its blocked event before adding verified evidence', () => {
  const rows = buildContributorLeaderboard({
    profiles: [{
      handle: 'gorajing',
      repo: 'gorajing/mongo',
      subsystem: 'query/named-enum',
      isCurrentUser: true,
      events: [],
    }],
    receipts: [{
      prNum: 3,
      author: 'gorajing',
      subsystem: 'query/named-enum',
      status: 'approved',
      ts: new Date('2026-08-14T02:00:00Z'),
      github: {
        number: 3,
        repository: 'gorajing/mongo',
        htmlUrl: 'https://github.com/gorajing/mongo/pull/3',
      },
      reviewEvents: [
        { kind: 'missing-evidence', status: 'blocked', at: new Date('2026-08-14T02:00:01Z') },
        { kind: 'verified-evidence', status: 'approved', at: new Date('2026-08-14T02:04:00Z') },
      ],
    }],
  });

  assert.equal(rows[0].score, 98);
  assert.deepEqual(rows[0].trend, [100, 95, 98]);
  assert.deepEqual(rows[0].events.map((event) => event.label), [
    'PR #3 blocked',
    'PR #3 approved',
  ]);
});

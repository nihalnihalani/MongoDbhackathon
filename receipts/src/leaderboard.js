const BASELINE = 100;

const DELTAS = Object.freeze({
  'missing-evidence': -5,
  'review-concerns': -3,
  'auto-revert': -6,
  'corrective-reland': 4,
  'verified-evidence': 3,
});

function dateValue(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function scoreEvents(events, baseline = BASELINE) {
  let score = baseline;
  const scored = [...events]
    .sort((left, right) => dateValue(left.at) - dateValue(right.at))
    .map((event) => {
      const delta = DELTAS[event.kind] ?? 0;
      const from = score;
      score += delta;
      return { ...event, delta, from, to: score };
    });
  return { score, trend: [baseline, ...scored.map((event) => event.to)], events: scored };
}

function eventKind(status) {
  if (status === 'blocked') return 'missing-evidence';
  if (status === 'concerns') return 'review-concerns';
  if (status === 'approved') return 'verified-evidence';
  return null;
}

export function reviewEventForReceipt(receipt, status = receipt.status, at = null) {
  const kind = eventKind(status);
  if (!kind) return null;
  const number = receipt.github?.number ?? receipt.prNum;
  return {
    kind,
    status,
    at: at ?? receipt.github?.publication?.publishedAt ?? receipt.ts,
    label: `PR #${number} ${status}`,
    url: receipt.github?.htmlUrl ?? null,
    source: receipt.github?.repository ?? 'MongoDB receipt',
  };
}

function receiptEvents(receipt) {
  if (!receipt.reviewEvents?.length) {
    const current = reviewEventForReceipt(receipt);
    return current ? [current] : [];
  }
  return receipt.reviewEvents
    .map((event) => {
      const generated = reviewEventForReceipt(receipt, event.status, event.at);
      return generated ? { ...generated, ...event } : null;
    })
    .filter(Boolean);
}

function reviewBand(score) {
  if (score >= 100) return { key: 'normal', label: 'normal review' };
  if (score >= 90) return { key: 'elevated', label: 'elevated review' };
  return { key: 'maximum', label: 'maximum review' };
}

export function buildContributorLeaderboard({ profiles, receipts }) {
  const byScope = new Map(
    profiles.map((profile) => [`${profile.handle}\u0000${profile.subsystem}`, { ...profile }]),
  );

  for (const receipt of receipts) {
    if (!receipt.author || !receipt.subsystem || !receipt.github) continue;
    const key = `${receipt.author}\u0000${receipt.subsystem}`;
    if (!byScope.has(key)) {
      byScope.set(key, {
        handle: receipt.author,
        repo: receipt.github.repository,
        subsystem: receipt.subsystem,
        isCurrentUser: receipt.author === 'gorajing',
        events: [],
      });
    }
  }

  const rows = [];
  for (const profile of byScope.values()) {
    const liveEvents = receipts
      .filter((receipt) => receipt.author === profile.handle && receipt.subsystem === profile.subsystem)
      .flatMap(receiptEvents);
    const scored = scoreEvents([...(profile.events ?? []), ...liveEvents]);
    rows.push({
      handle: profile.handle,
      repo: profile.repo,
      subsystem: profile.subsystem,
      isCurrentUser: Boolean(profile.isCurrentUser),
      profileUrl: profile.profileUrl ?? `https://github.com/${profile.handle}`,
      basis: profile.basis ?? 'Live PR-Elo receipts',
      ...scored,
      movement: scored.score - BASELINE,
      band: reviewBand(scored.score),
    });
  }

  return rows.sort((left, right) => right.score - left.score || left.handle.localeCompare(right.handle));
}

export const leaderboardScoring = {
  baseline: BASELINE,
  deltas: DELTAS,
};

import { createHmac, timingSafeEqual } from 'node:crypto';

const EVIDENCE_PREFIX = 'pr-elo-evidence:';

export function verifyGitHubSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || !secret || typeof signature !== 'string') return false;
  if (!/^sha256=[0-9a-f]{64}$/i.test(signature)) return false;

  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'), 'hex');
  const supplied = Buffer.from(signature.slice('sha256='.length), 'hex');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function classifySubsystem(files) {
  const paths = files.map((file) => String(file.filename ?? ''));
  if (paths.length === 0) return 'repository';
  if (paths.some((path) => /src\/mongo\/db\/query\/util\/.*named_enum/i.test(path))) {
    return 'query/named-enum';
  }
  if (paths.some((path) => path.startsWith('src/mongo/db/query/util/'))) return 'query/util';
  if (paths.some((path) => path.startsWith('src/mongo/db/query/'))) return 'query';
  if (paths.some((path) => path.startsWith('src/mongo/db/'))) return 'database';
  if (paths.every((path) => /(^|\/)(docs?|README)/i.test(path))) return 'docs';
  if (paths.some((path) => path.startsWith('src/'))) return 'server';
  return 'repository';
}

export function extractEvidence(pullRequest) {
  const evidence = [];
  const body = String(pullRequest.body ?? '');
  const marker = body.match(/^\s*PR-ELO-EVIDENCE:\s*(.+)$/im);
  if (marker) {
    evidence.push(...marker[1].split(',').map((item) => item.trim()).filter(Boolean));
  }
  for (const label of pullRequest.labels ?? []) {
    const name = String(label.name ?? '');
    if (name.toLowerCase().startsWith(EVIDENCE_PREFIX)) {
      const key = name.slice(EVIDENCE_PREFIX.length).trim();
      if (key) evidence.push(key);
    }
  }
  return [...new Set(evidence)];
}

function description(notes) {
  const compact = String(notes ?? '').replace(/\s+/g, ' ').trim();
  return (compact || 'Persistent review completed.').slice(0, 140);
}

export function githubStatusForReceipt(receipt) {
  if (!receipt?.review) return null;
  if (receipt.status === 'approved') {
    return { state: 'success', label: 'APPROVED', description: description(receipt.review.notes) };
  }
  if (receipt.status === 'blocked') {
    return { state: 'failure', label: 'BLOCKED', description: description(receipt.review.notes) };
  }
  if (receipt.status === 'concerns') {
    return { state: 'failure', label: 'CONCERNS', description: description(receipt.review.notes) };
  }
  return null;
}

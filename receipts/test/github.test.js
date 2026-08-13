import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import {
  classifySubsystem,
  extractEvidence,
  githubStatusForReceipt,
  verifyGitHubSignature,
} from '../src/github-utils.js';

test('verifyGitHubSignature accepts the exact signed bytes and rejects tampering', () => {
  const secret = 'demo-secret';
  const body = Buffer.from('{"action":"opened"}');
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  assert.equal(verifyGitHubSignature(body, signature, secret), true);
  assert.equal(verifyGitHubSignature(Buffer.from('{"action":"closed"}'), signature, secret), false);
  assert.equal(verifyGitHubSignature(body, 'sha256=short', secret), false);
});

test('classifySubsystem recognizes the named_enum incident scope', () => {
  assert.equal(
    classifySubsystem([
      { filename: 'src/mongo/db/query/util/named_enum_receipts_demo.h' },
      { filename: 'src/mongo/db/query/util/BUILD.bazel' },
    ]),
    'query/named-enum',
  );
  assert.equal(classifySubsystem([{ filename: 'docs/README.md' }]), 'docs');
  assert.equal(classifySubsystem([]), 'repository');
});

test('extractEvidence only accepts explicit receipts evidence markers', () => {
  assert.deepEqual(
    extractEvidence({
      body: 'Fix includes\nPR-ELO-EVIDENCE: msvc-preprocessor, compiler-matrix',
      labels: [{ name: 'pr-elo-evidence:cross-platform-tests' }, { name: 'bug' }],
    }),
    ['msvc-preprocessor', 'compiler-matrix', 'cross-platform-tests'],
  );
  assert.deepEqual(extractEvidence({ body: 'MSVC probably works', labels: [] }), []);
});

test('githubStatusForReceipt maps durable reviewer outcomes to commit statuses', () => {
  assert.deepEqual(githubStatusForReceipt({ status: 'approved', review: { notes: 'Looks good.' } }), {
    state: 'success',
    label: 'APPROVED',
    description: 'Looks good.',
  });
  assert.equal(githubStatusForReceipt({ status: 'blocked', review: { notes: 'Proof required.' } }).state, 'failure');
  assert.equal(githubStatusForReceipt({ status: 'submitted', review: null }), null);
});

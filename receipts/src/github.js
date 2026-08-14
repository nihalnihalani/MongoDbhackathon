/**
 * GitHub is an input and output adapter. The durable queue and the review
 * decision remain in MongoDB, so webhook retries and reviewer restarts do not
 * depend on one Express request staying alive.
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import 'dotenv/config';

import { submitPR } from './ops.js';
import { githubDeliveries, githubPublications, receipts } from './schema.js';
import {
  classifySubsystem,
  extractEvidence,
  githubStatusForReceipt,
  verifyGitHubSignature,
} from './github-utils.js';

export { verifyGitHubSignature } from './github-utils.js';

const SUPPORTED_ACTIONS = new Set(['opened', 'reopened', 'synchronize', 'edited', 'ready_for_review']);
const STATUS_CONTEXT = 'PR-Elo / persistent review';
const execFileAsync = promisify(execFile);

function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is missing from GitHub payload`);
  return value;
}

function pullRequestRecord(payload) {
  const pr = payload.pull_request;
  if (!pr || typeof pr.number !== 'number') throw new Error('pull_request is missing from GitHub payload');
  return {
    repository: required(payload.repository?.full_name, 'repository.full_name'),
    number: pr.number,
    title: required(pr.title, 'pull_request.title'),
    body: String(pr.body ?? ''),
    author: required(pr.user?.login, 'pull_request.user.login'),
    htmlUrl: required(pr.html_url, 'pull_request.html_url'),
    headSha: required(pr.head?.sha, 'pull_request.head.sha'),
    headRef: required(pr.head?.ref, 'pull_request.head.ref'),
    baseRef: required(pr.base?.ref, 'pull_request.base.ref'),
    draft: Boolean(pr.draft),
    labels: (pr.labels ?? []).map((label) => ({ name: String(label.name ?? '') })),
  };
}

export async function recordGitHubDelivery({ deliveryId, eventName, payload }) {
  required(deliveryId, 'X-GitHub-Delivery');
  const action = String(payload.action ?? 'unknown');
  const accepted = eventName === 'pull_request' && SUPPORTED_ACTIONS.has(action);
  const pullRequest = eventName === 'pull_request' ? pullRequestRecord(payload) : null;
  const now = new Date();
  const doc = {
    _id: deliveryId,
    eventName,
    action,
    accepted,
    pullRequest,
    status: accepted ? 'received' : 'ignored',
    receivedAt: now,
    updatedAt: now,
  };
  const result = await githubDeliveries().updateOne(
    { _id: deliveryId },
    { $setOnInsert: doc },
    { upsert: true },
  );
  return { ...doc, duplicate: result.upsertedCount === 0 };
}

async function githubCliRequest(path, { method, body }) {
  const args = ['api', path, '--method', method, '--header', 'Accept: application/vnd.github+json'];
  for (const [key, value] of Object.entries(body ?? {})) {
    const flag = typeof value === 'number' || typeof value === 'boolean' ? '-F' : '-f';
    args.push(flag, `${key}=${value}`);
  }
  try {
    const { stdout } = await execFileAsync('gh', args, { maxBuffer: 2_000_000 });
    return stdout.trim() ? JSON.parse(stdout) : null;
  } catch (error) {
    const detail = String(error.stderr ?? error.message).replace(/\s+/g, ' ').trim().slice(0, 240);
    throw new Error(`GitHub CLI ${method} ${path} failed: ${detail}`);
  }
}

async function githubRequest(path, { method = 'GET', body, token = process.env.GITHUB_TOKEN } = {}) {
  if (!token) return githubCliRequest(path, { method, body });
  const base = process.env.GITHUB_API_URL || 'https://api.github.com';
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'receipts-persistent-review-demo',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`GitHub ${method} ${path} failed (${response.status}): ${parsed?.message ?? text.slice(0, 180)}`);
  }
  return parsed;
}

function patchText(files) {
  return files
    .slice(0, 30)
    .map((file) => [
      `FILE ${file.filename} (${file.status}, +${file.additions}/-${file.deletions})`,
      file.patch || '[patch unavailable from GitHub]',
    ].join('\n'))
    .join('\n\n')
    .slice(0, 24_000);
}

async function fetchPullRequestFiles(pr, token) {
  return githubRequest(`/repos/${pr.repository}/pulls/${pr.number}/files?per_page=100`, { token });
}

async function markDelivery(id, update) {
  await githubDeliveries().updateOne(
    { _id: id },
    { $set: { ...update, updatedAt: new Date() } },
  );
}

export async function processGitHubDelivery(deliveryId, { token = process.env.GITHUB_TOKEN } = {}) {
  const claimed = await githubDeliveries().findOneAndUpdate(
    { _id: deliveryId, status: { $in: ['received', 'failed'] } },
    { $set: { status: 'processing', processingAt: new Date(), updatedAt: new Date() }, $unset: { error: '' } },
    { returnDocument: 'after' },
  );
  if (!claimed) return githubDeliveries().findOne({ _id: deliveryId });

  try {
    const pr = claimed.pullRequest;
    const files = await fetchPullRequestFiles(pr, token);
    const evidence = extractEvidence(pr);
    const subsystem = classifySubsystem(files);
    const github = {
      repository: pr.repository,
      number: pr.number,
      headSha: pr.headSha,
      headRef: pr.headRef,
      baseRef: pr.baseRef,
      htmlUrl: pr.htmlUrl,
      deliveryId,
      fileCount: files.length,
    };

    let receipt = await receipts().findOne({
      'github.repository': pr.repository,
      'github.number': pr.number,
      'github.headSha': pr.headSha,
    });

    if (receipt) {
      receipt = await receipts().findOneAndUpdate(
        { _id: receipt._id },
        {
          $set: {
            title: pr.title,
            author: pr.author,
            subsystem,
            code: patchText(files),
            evidence,
            github,
            status: 'submitted',
            review: null,
            ts: new Date(),
          },
        },
        { returnDocument: 'after' },
      );
    } else {
      receipt = await submitPR({
        author: pr.author,
        subsystem,
        changeType: 'pull-request',
        title: pr.title,
        code: patchText(files),
        evidence,
        github,
      });
    }

    await markDelivery(deliveryId, {
      status: 'processed',
      processedAt: new Date(),
      receiptPrNum: receipt.prNum,
      subsystem,
      evidence,
      files: files.map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
      })),
    });
    return githubDeliveries().findOne({ _id: deliveryId });
  } catch (error) {
    await markDelivery(deliveryId, {
      status: 'failed',
      failedAt: new Date(),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function processPendingGitHubDeliveries(options = {}) {
  // This is a single-worker demo process. A status left at `processing` can
  // only belong to the server instance that just died, so boot recovery may
  // safely return it to the queue before claiming pending work.
  await githubDeliveries().updateMany(
    { status: 'processing', accepted: true },
    {
      $set: { status: 'received', recoveredAt: new Date(), updatedAt: new Date() },
      $unset: { processingAt: '' },
    },
  );
  const pending = await githubDeliveries()
    .find({ status: { $in: ['received', 'failed'] }, accepted: true })
    .sort({ receivedAt: 1 })
    .limit(25)
    .toArray();
  const results = [];
  for (const delivery of pending) {
    try {
      results.push(await processGitHubDelivery(delivery._id, options));
    } catch (error) {
      console.error(`[github] delivery ${delivery._id} failed:`, error.message);
    }
  }
  return results;
}

function publicationKey(receipt) {
  return createHash('sha256')
    .update([
      receipt.github.repository,
      receipt.github.number,
      receipt.github.headSha,
      receipt.status,
      receipt.review.by,
      receipt.review.msgCount,
    ].join(':'))
    .digest('hex');
}

function reviewComment(receipt, result, key, targetUrl) {
  const memory = receipt.review.mode === 'contract-block'
    ? `MongoDB enforced ${receipt.review.unmet.length} durable review contract(s).`
    : `MongoDB selected the ${receipt.review.mode} review lane from persisted history.`;
  const unmet = (receipt.review.unmet ?? [])
    .map((item) => `- Incident #${item.incidentNum}: **${item.requirement}** (evidence key: \`${item.evidenceKey}\`)`)
    .join('\n');
  return [
    `<!-- pr-elo-review:${key} -->`,
    `## PR-Elo persistent review — ${result.label}`,
    '',
    receipt.review.notes,
    '',
    `**Why this scrutiny:** ${memory}`,
    ...(unmet ? ['', unmet] : []),
    '',
    `Reviewer: \`${receipt.review.by}\` · Mongo receipt: \`#${receipt.prNum}\` · Subsystem review-readiness event recorded`,
    ...(targetUrl ? [`[Open the live review receipt](${targetUrl})`] : []),
  ].join('\n');
}

async function findExistingComment(receipt, marker, token) {
  const comments = await githubRequest(
    `/repos/${receipt.github.repository}/issues/${receipt.github.number}/comments?per_page=100`,
    { token },
  );
  return comments.find((comment) => String(comment.body ?? '').includes(marker)) ?? null;
}

export async function publishGitHubReceipt(
  receipt,
  { token = process.env.GITHUB_TOKEN, publicBaseUrl = process.env.PUBLIC_APP_URL } = {},
) {
  const result = githubStatusForReceipt(receipt);
  if (!result || !receipt.github) return null;

  const key = publicationKey(receipt);
  const existing = await githubPublications().findOne({ _id: key });
  if (existing?.status === 'published') return existing;

  const targetUrl = publicBaseUrl
    ? `${publicBaseUrl.replace(/\/$/, '')}/live.html?repo=${encodeURIComponent(receipt.github.repository)}&pr=${receipt.github.number}`
    : receipt.github.htmlUrl;
  await githubPublications().updateOne(
    { _id: key },
    {
      $setOnInsert: {
        repository: receipt.github.repository,
        prNum: receipt.github.number,
        headSha: receipt.github.headSha,
        receiptPrNum: receipt.prNum,
        createdAt: new Date(),
      },
      $set: { status: 'publishing', updatedAt: new Date() },
    },
    { upsert: true },
  );

  try {
    const status = await githubRequest(
      `/repos/${receipt.github.repository}/statuses/${receipt.github.headSha}`,
      {
        method: 'POST',
        token,
        body: {
          state: result.state,
          context: STATUS_CONTEXT,
          description: result.description,
          target_url: targetUrl,
        },
      },
    );
    const marker = `<!-- pr-elo-review:${key} -->`;
    let comment = await findExistingComment(receipt, marker, token);
    if (!comment) {
      comment = await githubRequest(
        `/repos/${receipt.github.repository}/issues/${receipt.github.number}/comments`,
        {
          method: 'POST',
          token,
          body: { body: reviewComment(receipt, result, key, targetUrl) },
        },
      );
    }
    const published = {
      status: 'published',
      verdict: result.label,
      statusUrl: status.target_url ?? targetUrl,
      commentUrl: comment.html_url,
      publishedAt: new Date(),
      updatedAt: new Date(),
    };
    await githubPublications().updateOne({ _id: key }, { $set: published });
    await receipts().updateOne(
      { _id: receipt._id },
      { $set: { 'github.publication': { key, ...published } } },
    );
    return githubPublications().findOne({ _id: key });
  } catch (error) {
    await githubPublications().updateOne(
      { _id: key },
      { $set: { status: 'failed', error: error.message, failedAt: new Date(), updatedAt: new Date() } },
    );
    throw error;
  }
}

export async function processPendingGitHubPublications(options = {}) {
  // A reviewer can commit its verdict immediately before this process dies.
  // Scan durable reviewed receipts on boot so publication is recovered even
  // when no new receipt change arrives to wake the change-stream handler.
  const reviewed = await receipts()
    .find({
      'github.repository': { $type: 'string' },
      status: { $in: ['approved', 'concerns', 'blocked'] },
      review: { $type: 'object' },
    })
    .sort({ ts: 1 })
    .limit(100)
    .toArray();

  const results = [];
  for (const receipt of reviewed) {
    try {
      results.push(await publishGitHubReceipt(receipt, options));
    } catch (error) {
      console.error(`[github] publication recovery for receipt #${receipt.prNum} failed:`, error.message);
    }
  }
  return results;
}

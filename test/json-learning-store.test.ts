import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { JsonLearningDataSource } from "../src/json-learning-store.js";
import type { ReviewDecision, ReviewEvent } from "../src/types.js";

const event: ReviewEvent = {
  id: "event:481",
  type: "pull_request_opened",
  repository: "acme/web",
  occurredAt: "2026-08-13T20:00:00.000Z",
  contributor: "kevin",
  pullRequestNumber: 481,
  title: "Change session expiry",
  description: "Rewrites the session expiration comparison.",
};

const decision: ReviewDecision = {
  action: "comment",
  confidence: 0.9,
  summary: "The change repeats a known session failure mode.",
  findings: [],
  credibilityUpdate: {
    contributor: "kevin",
    previousScore: 46,
    proposedScore: 40,
    rationale: "Repeated auth risk without a regression test.",
    evidence: ["PR #481", "incident-88"],
  },
  memoriesToStore: [
    {
      subject: "src/auth/session.ts",
      kind: "code",
      summary: "Session expiration changes require a boundary regression test.",
      evidence: ["PR #481"],
      confidence: 0.95,
    },
  ],
  selfAssessment: null,
};

test("persists credibility and memories across data-source instances", async () => {
  const directory = await mkdtemp(join(tmpdir(), "murmur-learning-"));
  const path = join(directory, "state.json");
  const seed = {
    contributorContexts: { kevin: { credibility: 46, history: [] } },
    memories: [],
    pullRequestDiffs: { "482": { patch: "first version" } },
  };
  const first = await JsonLearningDataSource.open(path, seed);

  const commit = await first.commitLearning(event, decision);

  assert.deepEqual(commit, {
    applied: true,
    eventId: "event:481",
    credibilityUpdated: true,
    memoriesStored: 1,
  });

  const second = await JsonLearningDataSource.open(path, {
    ...seed,
    pullRequestDiffs: { "482": { patch: "new event evidence" } },
  });
  const context = await second.getContributorContext({ repository: "acme/web", contributor: "kevin" });
  assert.equal(typeof context === "object" && context !== null && !Array.isArray(context) ? context.credibility : null, 40);
  const memories = await second.searchOrganizationalMemory({
    repository: "acme/web",
    query: "session boundary",
  });
  assert.ok(Array.isArray(memories));
  assert.equal(memories.length, 1);

  const otherRepositoryContext = await second.getContributorContext({
    repository: "another/project",
    contributor: "kevin",
  });
  assert.equal(
    typeof otherRepositoryContext === "object" && otherRepositoryContext !== null && !Array.isArray(otherRepositoryContext)
      ? otherRepositoryContext.credibility
      : null,
    46,
  );
  const otherRepositoryMemories = await second.searchOrganizationalMemory({
    repository: "another/project",
    query: "session boundary",
  });
  assert.deepEqual(otherRepositoryMemories, []);

  const diff = await second.getPullRequestDiff({ repository: "acme/web", pullRequestNumber: 482 });
  assert.deepEqual(diff, { patch: "new event evidence" });
  const stored = JSON.parse(await readFile(path, "utf8")) as { stateVersion: number };
  assert.equal(stored.stateVersion, 1);
});

test("does not apply the same event twice", async () => {
  const directory = await mkdtemp(join(tmpdir(), "murmur-idempotent-"));
  const path = join(directory, "state.json");
  const store = await JsonLearningDataSource.open(path, {
    contributorContexts: { kevin: { credibility: 46, history: [] } },
    memories: [],
  });

  await store.commitLearning(event, decision);
  const duplicate = await store.commitLearning(event, decision);

  assert.equal(duplicate.applied, false);
  const context = await store.getContributorContext({ repository: "acme/web", contributor: "kevin" });
  const history = typeof context === "object" && context !== null && !Array.isArray(context) ? context.history : null;
  assert.ok(Array.isArray(history));
  assert.equal(history.length, 1);
});

test("rejects a stale credibility proposal instead of overwriting newer learning", async () => {
  const directory = await mkdtemp(join(tmpdir(), "murmur-conflict-"));
  const path = join(directory, "state.json");
  const store = await JsonLearningDataSource.open(path, {
    contributorContexts: { kevin: { credibility: 50 } },
  });

  await assert.rejects(store.commitLearning(event, decision), /Stale credibility update/);

  const context = await store.getContributorContext({ repository: "acme/web", contributor: "kevin" });
  assert.equal(typeof context === "object" && context !== null && !Array.isArray(context) ? context.credibility : null, 50);
});

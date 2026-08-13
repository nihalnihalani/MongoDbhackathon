import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type {
  AgentLearningStore,
  JsonObject,
  JsonValue,
  LearningCommitResult,
  MemoryProposal,
  ReviewDecision,
  ReviewEvent,
} from "./types.js";
import type {
  ContributorContextInput,
  GitHistoryInput,
  MemorySearchInput,
  PullRequestInput,
  RepositoryFileInput,
  ReviewDataSource,
} from "./agent/tools.js";
import { SnapshotDataSource, type ReviewSnapshot } from "./snapshot-data-source.js";

interface AppliedEventRecord {
  appliedAt: string;
  credibilityUpdated: boolean;
  memoriesStored: number;
}

interface PersistentLearningState {
  stateVersion: 1;
  contributorContexts: Record<string, JsonValue>;
  memories: JsonValue[];
  appliedEvents: Record<string, AppliedEventRecord>;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function initialState(snapshot: ReviewSnapshot): PersistentLearningState {
  return {
    stateVersion: 1,
    contributorContexts: clone(snapshot.contributorContexts ?? {}),
    memories: clone(snapshot.memories ?? []),
    appliedEvents: {},
  };
}

function parseState(raw: string, path: string): PersistentLearningState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Learning state at ${path} is not valid JSON`, { cause: error });
  }
  if (!isObject(parsed) || parsed.stateVersion !== 1) {
    throw new Error(`Learning state at ${path} has an unsupported format`);
  }
  if (!isObject(parsed.contributorContexts) || !Array.isArray(parsed.memories) || !isObject(parsed.appliedEvents)) {
    throw new Error(`Learning state at ${path} is incomplete`);
  }
  return parsed as unknown as PersistentLearningState;
}

function currentCredibility(context: JsonValue | undefined): number | null {
  if (!isObject(context)) return null;
  const score = context.credibility;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function contributorKey(repository: string, contributor: string): string {
  return JSON.stringify([repository, contributor]);
}

function memoryId(event: ReviewEvent, memory: MemoryProposal): string {
  return createHash("sha256")
    .update(`${event.id}\u0000${memory.kind}\u0000${memory.subject}\u0000${memory.summary}`)
    .digest("hex");
}

function storedMemory(event: ReviewEvent, memory: MemoryProposal): JsonObject {
  return {
    id: memoryId(event, memory),
    eventId: event.id,
    repository: event.repository,
    learnedAt: event.occurredAt,
    subject: memory.subject,
    kind: memory.kind,
    summary: memory.summary,
    evidence: memory.evidence,
    confidence: memory.confidence,
  };
}

/**
 * Atomic local persistence for demos and development. It stores only learned
 * context; current PR/code evidence continues to come from the supplied snapshot.
 */
export class JsonLearningDataSource implements ReviewDataSource, AgentLearningStore {
  private state: PersistentLearningState;
  private readonly evidence: SnapshotDataSource;
  readonly path: string;

  private constructor(path: string, snapshot: ReviewSnapshot, state: PersistentLearningState) {
    this.path = resolve(path);
    this.state = state;
    this.evidence = new SnapshotDataSource(snapshot);
  }

  static async open(path: string, snapshot: ReviewSnapshot): Promise<JsonLearningDataSource> {
    const absolute = resolve(path);
    await mkdir(dirname(absolute), { recursive: true });
    let state: PersistentLearningState;
    try {
      state = parseState(await readFile(absolute, "utf8"), absolute);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      state = initialState(snapshot);
      await JsonLearningDataSource.withLock(absolute, async () => {
        try {
          state = parseState(await readFile(absolute, "utf8"), absolute);
        } catch (nested) {
          if (!(nested instanceof Error && "code" in nested && nested.code === "ENOENT")) throw nested;
          await JsonLearningDataSource.atomicWrite(absolute, state);
        }
      });
    }
    return new JsonLearningDataSource(absolute, snapshot, state);
  }

  async getContributorContext(input: ContributorContextInput): Promise<JsonValue> {
    const scoped = contributorKey(input.repository, input.contributor);
    return clone(this.state.contributorContexts[scoped] ?? this.state.contributorContexts[input.contributor] ?? { found: false });
  }

  async searchOrganizationalMemory(input: MemorySearchInput): Promise<JsonValue> {
    const terms = input.query.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
    const contributor = input.contributor?.toLowerCase();
    return this.state.memories
      .map((memory) => ({ memory, text: JSON.stringify(memory).toLowerCase() }))
      .filter(({ memory, text }) => {
        const sameRepository = !isObject(memory) || typeof memory.repository !== "string" || memory.repository === input.repository;
        return sameRepository && (!contributor || text.includes(contributor)) && (terms.length === 0 || terms.some((term) => text.includes(term)));
      })
      .slice(0, typeof input.limit === "number" ? input.limit : 8)
      .map(({ memory }) => clone(memory));
  }

  getPullRequestDiff(input: PullRequestInput, signal?: AbortSignal): Promise<JsonValue> {
    return this.evidence.getPullRequestDiff(input, signal);
  }

  getPullRequestChecks(input: PullRequestInput, signal?: AbortSignal): Promise<JsonValue> {
    return this.evidence.getPullRequestChecks(input, signal);
  }

  readRepositoryFile(input: RepositoryFileInput, signal?: AbortSignal): Promise<JsonValue> {
    return this.evidence.readRepositoryFile(input, signal);
  }

  getGitHistory(input: GitHistoryInput, signal?: AbortSignal): Promise<JsonValue> {
    return this.evidence.getGitHistory(input, signal);
  }

  async commitLearning(
    event: ReviewEvent,
    decision: ReviewDecision,
    signal?: AbortSignal,
  ): Promise<LearningCommitResult> {
    if (signal?.aborted) throw new Error("Learning commit aborted", { cause: signal.reason });
    return JsonLearningDataSource.withLock(this.path, async () => {
      const latest = parseState(await readFile(this.path, "utf8"), this.path);
      const existing = latest.appliedEvents[event.id];
      if (existing) {
        this.state = latest;
        return {
          applied: false,
          eventId: event.id,
          credibilityUpdated: existing.credibilityUpdated,
          memoriesStored: existing.memoriesStored,
        };
      }

      let credibilityUpdated = false;
      const update = decision.credibilityUpdate;
      if (update) {
        const scoped = contributorKey(event.repository, update.contributor);
        const priorContext = latest.contributorContexts[scoped] ?? latest.contributorContexts[update.contributor];
        const storedPrevious = currentCredibility(priorContext);
        if (storedPrevious !== update.previousScore) {
          throw new Error(
            `Stale credibility update for ${update.contributor}: model saw ${update.previousScore}, durable state has ${storedPrevious ?? "no score"}`,
          );
        }
        const context: JsonObject = isObject(priorContext) ? clone(priorContext) : {};
        const history = Array.isArray(context.history) ? clone(context.history) : [];
        history.push({
          type: "credibility_update",
          eventId: event.id,
          occurredAt: event.occurredAt,
          previousScore: storedPrevious,
          proposedScore: update.proposedScore,
          rationale: update.rationale,
          evidence: update.evidence,
        });
        context.credibility = update.proposedScore;
        context.history = history;
        latest.contributorContexts[scoped] = context;
        credibilityUpdated = true;
      }

      const knownMemoryIds = new Set(
        latest.memories.flatMap((memory) => (isObject(memory) && typeof memory.id === "string" ? [memory.id] : [])),
      );
      let memoriesStored = 0;
      for (const proposal of decision.memoriesToStore) {
        const memory = storedMemory(event, proposal);
        const id = memory.id as string;
        if (knownMemoryIds.has(id)) continue;
        latest.memories.push(memory);
        knownMemoryIds.add(id);
        memoriesStored += 1;
      }

      latest.appliedEvents[event.id] = {
        appliedAt: new Date().toISOString(),
        credibilityUpdated,
        memoriesStored,
      };
      await JsonLearningDataSource.atomicWrite(this.path, latest);
      this.state = latest;
      return { applied: true, eventId: event.id, credibilityUpdated, memoriesStored };
    });
  }

  private static async withLock<T>(path: string, action: () => Promise<T>): Promise<T> {
    const lockPath = `${path}.lock`;
    let lock;
    try {
      lock = await open(lockPath, "wx", 0o600);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        throw new Error(`Learning state is already being updated: ${path}`);
      }
      throw error;
    }
    try {
      return await action();
    } finally {
      await lock.close();
      await unlink(lockPath).catch(() => undefined);
    }
  }

  private static async atomicWrite(path: string, state: PersistentLearningState): Promise<void> {
    const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await rename(temporary, path);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }
}

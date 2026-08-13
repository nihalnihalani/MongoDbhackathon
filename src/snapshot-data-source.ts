import type { JsonValue } from "./types.js";
import type {
  ContributorContextInput,
  GitHistoryInput,
  MemorySearchInput,
  PullRequestInput,
  RepositoryFileInput,
  ReviewDataSource,
} from "./agent/tools.js";

export interface ReviewSnapshot {
  contributorContexts?: Record<string, JsonValue>;
  memories?: JsonValue[];
  pullRequestDiffs?: Record<string, JsonValue>;
  pullRequestChecks?: Record<string, JsonValue>;
  files?: Record<string, JsonValue>;
  gitHistory?: Record<string, JsonValue>;
}

/** Local/demo adapter only. Production backends should implement ReviewDataSource directly. */
export class SnapshotDataSource implements ReviewDataSource {
  constructor(private readonly snapshot: ReviewSnapshot) {}

  async getContributorContext(input: ContributorContextInput, _signal?: AbortSignal): Promise<JsonValue> {
    return this.snapshot.contributorContexts?.[input.contributor] ?? { found: false };
  }

  async searchOrganizationalMemory(input: MemorySearchInput, _signal?: AbortSignal): Promise<JsonValue> {
    const terms = input.query.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
    const memories = this.snapshot.memories ?? [];
    return memories
      .map((memory) => ({ memory, text: JSON.stringify(memory).toLowerCase() }))
      .filter(({ text }) => terms.length === 0 || terms.some((term) => text.includes(term)))
      .slice(0, typeof input.limit === "number" ? input.limit : 8)
      .map(({ memory }) => memory);
  }

  async getPullRequestDiff(input: PullRequestInput, _signal?: AbortSignal): Promise<JsonValue> {
    return this.snapshot.pullRequestDiffs?.[String(input.pullRequestNumber)] ?? { found: false };
  }

  async getPullRequestChecks(input: PullRequestInput, _signal?: AbortSignal): Promise<JsonValue> {
    return this.snapshot.pullRequestChecks?.[String(input.pullRequestNumber)] ?? { found: false };
  }

  async readRepositoryFile(input: RepositoryFileInput, _signal?: AbortSignal): Promise<JsonValue> {
    return this.snapshot.files?.[input.path] ?? { found: false };
  }

  async getGitHistory(input: GitHistoryInput, _signal?: AbortSignal): Promise<JsonValue> {
    return this.snapshot.gitHistory?.[input.path] ?? [];
  }
}

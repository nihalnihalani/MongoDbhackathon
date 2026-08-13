# GASLIGHT

An agent whose memory is an open database — and a change-stream-driven immune system
that decides, in real time, which of the audience's lies it believes.

Built for the MongoDB Persistent Context Sprint Hackathon.

## Local development

Development runs against **Atlas Local** in Docker, which provides a single-node
replica set (change streams, transactions) *and* Atlas Vector Search — so nothing
here is blocked on cloud credentials.

```bash
npm run db:start   # Atlas Local on :27017
cp .env.example .env
npm run verify     # proves every primitive the demo depends on
```

`npm run verify` is the gate before any feature work. It checks, and fails loudly on:

| Check | Why it matters |
| --- | --- |
| Replica set topology | Change streams and transactions require it |
| Change stream on insert | The immune worker's only wake signal — no polling loop exists |
| Multi-document transaction | The cure: tombstone + provenance commit atomically |
| Vector search queryable | Immune matching against existing beliefs |
| `$vectorSearch` with filter | The read path — accepted beliefs only |
| TTL index on `expiresAt` | Quarantined lies rot on a visible timer |

## Switching to the Atlas Hackathon Sandbox

The build must live in the sandbox to be eligible for the finalist round. On the day:

1. Create the project + cluster from the sandbox link emailed to you.
2. Put the connection string in `.env` as `MONGODB_URI`.
3. Update `--connectionString` in `.mcp.json` to match.
4. Run `npm run verify` **before writing any feature code** — it confirms the sandbox
   tier actually supports change streams and vector search, which is the single
   highest-risk assumption in the build plan.

## Data model

One collection, `beliefs`, and one state machine:

```
pending ──> accepted ────> tombstoned
        └─> quarantined ──> (TTL reaps)
```

Every transition has exactly one writer — the immune worker (via change stream),
the TTL reaper, or the surgery endpoint — and commits with its provenance in a
single transaction. That is why the audit trail can never disagree with the state.

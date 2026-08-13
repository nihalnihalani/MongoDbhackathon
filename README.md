# MongoDB Persistent Context Sprint Hackathon 2026

Team repo for the [Persistent Context Sprint Hackathon](https://cerebralvalley.ai/e/persistent-context-sprint-hackathon) — MongoDB .local Build Fest, Pier 48, San Francisco (Embarcadero Stage).

## 🎯 Goal: No Cold Start

Every agent starts from nothing. Build one that doesn't. Use MongoDB to hold state, memory, and live application data so the agent comes back with what it learned last time instead of relearning everything. What we store, retrieve, and checkpoint should change what the system does next — not just fill the prompt.

## Agent inference package

This repository includes the provider-neutral MURMUR review harness. Fireworks and OpenRouter are interchangeable inference providers selected with `MURMUR_PROVIDER`. MongoDB, GitHub, and frontend work are intentionally represented only by the `ReviewDataSource` interface.

```bash
npm install
export MURMUR_PROVIDER=fireworks # or openrouter
export FIREWORKS_API_KEY=...    # key for the selected provider
# export OPENROUTER_API_KEY=... # use this instead when provider=openrouter
npm test
npm run agent -- --event examples/pr-event.json --snapshot examples/review-snapshot.json
```

The CLI writes progress to stderr and the final structured result to stdout. It reads environment variables from the shell; it does not load `.env` files automatically. See [the inference integration guide](docs/agent-harness.md) for provider configuration, backend wiring, event/result types, and operational behavior.

## 📅 Key Times (event day)

| Time | What |
|---|---|
| 1:00 PM | Check-in, team formation, opening remarks |
| 1:30 PM | Hacking begins |
| 5:00 PM | **Submissions due** |
| 5:15–6:30 PM | Round 1 judging (async: demo video + repo) |
| 6:30–7:30 PM | Finalists, on-stage demos, live voting |
| 7:30 PM | Winners announced |

## 🧑‍⚖️ Judging Criteria

- **Creativity & Originality — 35%**
- **Technologies Used — 25%** (MongoDB core + partner tools: ElevenLabs, LangChain, OpenRouter, Fireworks)
- **Impact Potential — 20%**
- **Live Demo — 20%**

## ✅ Rules Checklist

- [ ] Repo **must be public before submission** (private during development is fine)
- [ ] Max 4 team members
- [ ] Demo shows **only work built during the hackathon**
- [ ] Build must live in the **Atlas Hackathon Sandbox** (check email for the link)
- [ ] Submit with a **1-minute demo video**: [submission form](https://cerebralvalley.ai/e/persistent-context-sprint-hackathon/submit)
- Avoid banned project types: basic RAG, Streamlit apps, dashboards-as-the-feature, basic chatbots, etc.

## 🛠️ Recommended MongoDB Stack

1. [MongoDB Agent Skills](https://www.mongodb.com/docs/agent-skills/) — install into the AI coding assistant
2. [MongoDB MCP Server](https://www.mongodb.com/docs/mcp-server/get-started/) — live DB access for the assistant
3. [Natural Language to MongoDB Queries](https://www.mongodb.com/docs/manual/natural-language-to-mongodb/) — prompting guidance

Key building blocks: [Vector Search](https://www.mongodb.com/products/platform/atlas-vector-search), [Atlas Search](https://www.mongodb.com/docs/atlas/atlas-search/), [Automated Embeddings](https://www.mongodb.com/company/blog/product-release-announcements/unlocking-ai-search-introducing-automated-embedding-in-mongodb-vector-search), [LangGraph checkpointing](https://www.mongodb.com/docs/atlas/ai-integrations/langgraph/build-agents/), [GenAI Showcase examples](https://github.com/mongodb-developer/GenAI-Showcase/tree/main).

## 🎁 Partner Credits

- **Cursor** — credits sent to registered email
- **ElevenLabs** — 1 month Creator tier via [Discord](https://discord.com/invite/VnBvbbcdEC) coupon bot
- **Fireworks** — $50 with code `MONGODB813` (by 10/1)
- **LangChain** — $50 + deployments ([claim](https://app.notion.com/p/Hackathon-Resources-from-LangChain-34f808527b1780c8a82bd0b8f0c322a2))
- **OpenRouter** — $10 ([claim](https://app.notion.com/p/openrouter/OpenRouter-x-MongoDB-3b52fd57c4dc80a4bf07ed6ab238aa2b))

## 💬 Community

Hackathon Discord: https://discord.gg/8VUq28JrP2

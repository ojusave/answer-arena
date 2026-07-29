# RAGtime

Compare embedding, rerank, and generation models on the same corpus and question. Each setup runs as a durable [Render Workflows](https://render.com/docs/workflows) task, gets scored by a shared judge model, and lands on a cost / latency / quality leaderboard.

[Deploy to Render](https://render.com/deploy?repo=https://github.com/ojusave/ragtime) · [Live demo](https://ragtime-web.onrender.com/) · [Workflows docs](https://render.com/docs/workflows)

![RAGtime comparing two RAG setups on the same question](static/images/compare.png)

## Highlights

- **One OpenRouter key** covers embeddings, optional rerank, chat, and judging, with per-stage cost and latency receipts
- **Render Workflows fan-out** runs setups in parallel with retries and lease-based trial claiming
- **Resumable stages**: completed retrieval / generation / judge work is checkpointed so retries skip what already finished
- **Per-run budget ceiling** via pre-call reservations and an idempotent cost ledger (`MAX_RUN_BUDGET_USD`, default $5)
- **Shared-deployment safe**: runs are session-scoped, and admission limits cap how many run at once per session and in total
- **Live model catalog** from the gateway: pickers are not hardcoded slugs
- **Swap points** for the model gateway and workflow dispatcher through `packages/composition` (`MODEL_GATEWAY`, `WORKFLOW_DISPATCHER`)

## Overview

RAGtime is a bake-off template for RAG pipelines. You load a corpus (the demo seeds 100 SciFact medical abstracts automatically), compose one or more setups (embedding + optional rerank + generation), and run them against the same question. The web service starts a `run_bakeoff` workflow; each trial claims a lease, walks retrieve → optional rerank → generate → judge, and streams stage events back into the UI.

The interesting part is not the leaderboard itself. It is seeing *why* two setups diverge: which passages each one retrieved, what the judge scored, and how much each stage cost.

## Usage

1. Open the [live demo](https://ragtime-web.onrender.com/) or your own deploy. The SciFact demo library seeds itself on first load.
2. Pick a sample question (or write your own) and compose setups in **Configure**.
3. Click **Run**. Answers appear side by side in **Compare**; the event log names the setup behind each stage.
4. Select an answer to open **Inspect**: retrieved passages, stage receipts, and judge dimensions.

![Configure question and setups](static/images/configure.png)

![Inspect retrieved passages and judge score for a selected setup](static/images/inspect.png)

## Deploy on Render

### 1. Blueprint (web + Postgres)

Use the [Deploy to Render](https://render.com/deploy?repo=https://github.com/ojusave/ragtime) button, or create a Blueprint from [`render.yaml`](render.yaml). That provisions:

| Resource | Name | Role |
|----------|------|------|
| Web Service | `ragtime-web` | SPA + API, health check at `/healthz`, `preDeployCommand: pnpm db:migrate` |
| Postgres 16 | `ragtime-db` | Chunks, pgvector embeddings, runs, trials, events |

### 2. Workflow service (manual)

Blueprints do not create Workflow services yet. In the Dashboard:

1. **New → Workflow**
2. Same repo, **root directory** empty (pnpm workspace needs the repo root)
3. **Build**: `pnpm install && pnpm build:workflows`
4. **Start**: `node apps/workflows/dist/index.js`
5. Same **region** as the web service and database (private networking)
6. Note the **Workflow Slug** and set `WORKFLOW_SLUG` on the web service to match (Blueprint default: `ragtime-workflows`)

### 3. Secrets

| Variable | Where | Purpose |
|----------|-------|---------|
| `OPENROUTER_API_KEY` | Web + Workflow | Model calls (web also uses it for the models proxy) |
| `RENDER_API_KEY` | Web | Start and cancel workflow tasks |
| `JUDGE_MODEL` | Web + Workflow | Default judge chat slug; runs are rejected without a judge |
| `WORKFLOW_SLUG` | Web | Must match the Dashboard workflow slug |
| `DATABASE_URL` | Workflow | Internal URL from `ragtime-db` (Blueprint wires this on the web service) |
| `APP_URL` | Workflow | Public web URL for OpenRouter `HTTP-Referer` (Blueprint sets this on the web service from `RENDER_EXTERNAL_URL`) |

Optional: set `MODEL_GATEWAY=fake` on both services for a zero-spend smoke deploy (no OpenRouter key).

### 4. Open the app

Visit the web service URL. Demo data seeds through the UI. Compose a small comparison (two setups, one question) and click **Run**.

A suggested-matrix smoke with budget-tier models usually lands in low single-digit USD, always bounded by `MAX_RUN_BUDGET_USD`. Cross-check summed stage costs against your [OpenRouter activity](https://openrouter.ai/activity) for the run window.

## Configuration

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | (required) | Postgres with pgvector |
| `OPENROUTER_API_KEY` | (required for real models) | Bearer token |
| `RENDER_API_KEY` | (required on web) | Workflow triggers |
| `APP_URL` | from `RENDER_EXTERNAL_URL` on web | OpenRouter attribution |
| `OPENROUTER_APP_TITLE` | `RAGtime` | `X-OpenRouter-Title` |
| `MODEL_GATEWAY` | `openrouter` | `fake` for zero-spend CI / smoke |
| `WORKFLOW_DISPATCHER` | `render` | Composition root for task triggers |
| `WORKFLOW_SLUG` | `ragtime-workflows` | `{slug}/{task_name}` prefix |
| `JUDGE_MODEL` | (required) | Fallback judge if the run config omits one |
| `MAX_RUN_BUDGET_USD` | `5` | Hard per-run ceiling |
| `MAX_PROVIDER_CALL_USD` | `0.5` | Max reserved for one provider call |
| `EMBED_BATCH_SIZE` | `64` | Texts per embeddings call |
| `DOC_INGEST_FANOUT_BATCH` | `8` | Parallel ingest subtasks per wave |
| `EMBED_FANOUT_BATCH` | `6` | Parallel embed batches per model |
| `TRIAL_FANOUT_BATCH` | `8` | Parallel `run_trial` subtasks per wave |
| `DB_POOL_MAX` | `3` | Pool size per process; keep low on basic Postgres |
| `MAX_TRIALS_PER_RUN` | `324` | Cap on setups × questions |
| `MAX_ACTIVE_RUNS_PER_SESSION` | `1` | Concurrent runs one browser session may hold; `0` disables |
| `MAX_ACTIVE_RUNS_TOTAL` | `5` | Concurrent runs deployment-wide; `0` disables |
| `CHAOS_FAILURE_RATE` | `0` | Injected pre-spend failures (0–1) for resilience demos |

### Shared deployments

Runs are scoped to an anonymous session cookie, so testers only see and cancel their own. Concurrency is bounded at run creation: the check runs inside a transaction holding a Postgres advisory lock, so simultaneous requests cannot both pass it. Over the limit, `POST /api/runs` returns `429` with a machine-readable `code` (`session_run_limit` or `global_run_limit`) and a `Retry-After` header.

Reloading the page reattaches to the session's active run via `GET /api/runs/active`, so a run stays watchable and cancelable rather than silently holding a slot. Runs that nothing will finish (a row whose workflow task was never dispatched, or a run whose workflow disappeared) are failed on the next admission check so their slot returns to the pool.

Worst-case concurrent spend is `MAX_ACTIVE_RUNS_TOTAL × MAX_RUN_BUDGET_USD`, which is $25 with the Blueprint defaults. Raising `MAX_ACTIVE_RUNS_TOTAL` also multiplies Postgres connections (`DB_POOL_MAX` per process) and provider rate-limit pressure, so move it alongside your database plan rather than on its own.

## How a run works

**Ingest**: demo or uploaded text is chunked (~800 tokens, 15% overlap) into Postgres.

**Embed**: for each embedding model in the run, missing chunk vectors are batched and stored in pgvector.

**Retrieve**: query embedding cached per `(run, question, model)`; cosine top-`retrieve_k` filtered by embedding model.

**Rerank**: optional OpenRouter rerank down to `final_k`.

**Generate**: context blocks with citation instructions.

**Judge**: one judge model scores faithfulness, correctness, and completeness; weighted `overall_score`.

**Aggregate**: `total_cost_usd` from settled stage receipts.

## Swapping a module

Ports live in `packages/core`. Implementations are chosen in `packages/composition` from env vars, not scattered through feature code.

| Concern | Env | Default | Swap |
|---------|-----|---------|------|
| Model gateway | `MODEL_GATEWAY` | `openrouter` | Add a gateway package implementing `ModelGateway`, register it in `packages/composition/src/model-gateway.ts` |
| Workflow dispatcher | `WORKFLOW_DISPATCHER` | `render` | Register another dispatcher in `packages/composition/src/workflow-dispatcher.ts` |
| Vector store / extractor / chunker / scorer | (wired in composition pipeline) | pgvector, html-to-text, recursive splitter, rubric judge | Replace the adapter behind the existing port |

`packages/gateway-fake` is the reference for deterministic zero-cost behavior.

## Project structure

```
ragtime/
  apps/web/              Fastify API + Vite React SPA
  apps/workflows/        Render Workflow tasks (ingest, embed, trial, bake-off)
  packages/core/         Ports, pipeline stages, prompts, schemas
  packages/composition/  Env-selected gateway + workflow wiring
  packages/db/           Drizzle schema, migrations, seed, PgVectorStore
  packages/gateway-openrouter/
  packages/gateway-fake/
  render.yaml            Blueprint (web + Postgres)
  static/images/         README screenshots from the live deploy
```

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Run stays in draft / 502 on start | `RENDER_API_KEY`, `WORKFLOW_SLUG`, and that the Workflow service is live in the same region |
| "Judge model required" | Set `JUDGE_MODEL` on web and workflows to a chat slug you can call |
| `sorry, too many clients already` | Lower `TRIAL_FANOUT_BATCH` / `EMBED_FANOUT_BATCH` or raise `DB_POOL_MAX` carefully on a larger Postgres plan |
| `429` with "already have a run in progress" | Expected: one active run per session by default. Cancel the current run, or raise `MAX_ACTIVE_RUNS_PER_SESSION` |
| `429` with "running N comparisons already" | The deployment hit `MAX_ACTIVE_RUNS_TOTAL`. Retry shortly, or raise it if your Postgres plan and provider quota allow |
| Empty model pickers | `OPENROUTER_API_KEY` on the web service; check `/api/models` |

Logs: web service and Workflow service logs in the Render Dashboard. Trial stage events also appear in the in-app event log.

## Tests

```bash
pnpm test
```

Builds workspace packages, then runs core / db / gateway / web unit tests (including event-log formatting).

## Contributing

Issues and PRs are welcome on [github.com/ojusave/ragtime](https://github.com/ojusave/ragtime). Keep changes small and focused; match existing module boundaries (`packages/composition` for wiring, `packages/core` for pipeline logic, `apps/workflows` for durable tasks).

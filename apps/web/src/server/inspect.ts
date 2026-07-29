import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  embedQuery,
  retrieveCandidates,
  rerankCandidates,
  topKByScore,
  generateAnswer,
  judgeAnswer,
  safePersistedError,
} from "@ragtime/core";
import { getDb, schema } from "@ragtime/db";
import { createPipelinePorts } from "@ragtime/composition";
import { asSessionRequest } from "./types.js";

export const inspectConfigSchema = z.object({
  corpusId: z.string().uuid(),
  query: z.string().min(1),
  embeddingModel: z.string(),
  rerankModel: z.string().nullable(),
  genModel: z.string(),
  retrieveK: z.number().int().min(1).default(20),
  finalK: z.number().int().min(1).default(5),
  relevanceThreshold: z.number().min(0).max(1).optional(),
  judgeModel: z.string().optional(),
});

/** A stream is opened immediately after the POST, so the handle is short-lived. */
const INSPECT_TTL_MS = 60_000;

type InspectSession = {
  config: z.infer<typeof inspectConfigSchema>;
  /** The stream runs paid provider calls, so only its creator may consume it. */
  ownerSessionId: string;
  expiresAt: number;
};

/** Thrown to unwind the pipeline when the client disconnects mid-stream. */
class InspectAborted extends Error {
  override readonly name = "InspectAborted";
}

const sessions = new Map<string, InspectSession>();

/** Drop handles whose stream was never opened; otherwise the map grows forever. */
function evictExpired(now: number): void {
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(id);
  }
}

export function registerInspectRoutes(app: FastifyInstance) {
  app.post("/api/inspect", async (req, reply) => {
    const parsed = inspectConfigSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    // Reject unknown corpora here rather than after paying for an embedding.
    const db = getDb();
    const corpus = await db.query.corpora.findFirst({
      where: eq(schema.corpora.id, parsed.data.corpusId),
      columns: { id: true },
    });
    if (!corpus) return reply.status(404).send({ error: "Corpus not found" });

    const now = Date.now();
    evictExpired(now);
    const inspectId = randomUUID();
    sessions.set(inspectId, {
      config: parsed.data,
      ownerSessionId: asSessionRequest(req).sessionId,
      expiresAt: now + INSPECT_TTL_MS,
    });
    return { data: { inspectId } };
  });

  app.get<{ Params: { id: string } }>("/api/inspect/:id/stream", async (req, reply) => {
    const now = Date.now();
    evictExpired(now);
    const session = sessions.get(req.params.id);
    // Same 404 for missing and unowned: knowing an id exists is itself a leak.
    if (!session || session.ownerSessionId !== asSessionRequest(req).sessionId) {
      return reply.status(404).send({ error: "Not found" });
    }
    // Claim it now so a replay of the same id cannot start a second pipeline.
    sessions.delete(req.params.id);

    const abort = new AbortController();
    reply.raw.on("close", () => abort.abort());
    /** Stop before starting another paid stage once the client has gone. */
    const ensureLive = () => {
      if (abort.signal.aborted) throw new InspectAborted("client disconnected");
    };

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const ports = createPipelinePorts();
    const cfg = session.config;
    let totalCost = 0;
    let totalLatency = 0;

    try {
      ensureLive();
      const embed = await embedQuery({
        gateway: ports.gateway,
        vectorStore: ports.vectorStore,
        runId: "inspect",
        questionId: "inspect-q",
        questionText: cfg.query,
        embeddingModel: cfg.embeddingModel,
        persist: false,
        onCost: async (usd) => {
          totalCost += usd;
        },
      });
      if (embed.receipt) {
        totalLatency += embed.receipt.latencyMs;
        send("stage", { stage: "embed", data: { dims: embed.vector.length }, receipt: embed.receipt });
      }

      const retrieval = await retrieveCandidates({
        vectorStore: ports.vectorStore,
        corpusId: cfg.corpusId,
        embeddingModel: cfg.embeddingModel,
        queryVector: embed.vector,
        retrieveK: cfg.retrieveK,
      });
      const retrievedChunks = await ports.vectorStore.getChunksByIds(retrieval.chunkIds);
      send("stage", {
        stage: "retrieve",
        data: {
          ...retrieval,
          chunks: retrieval.chunkIds.map((id, i) => ({
            id,
            idx: retrievedChunks.get(id)?.idx,
            content: retrievedChunks.get(id)?.content ?? "",
            score: retrieval.scores[i],
          })),
        },
        receipt: { latencyMs: retrieval.latencyMs, costUsd: 0 },
      });
      totalLatency += retrieval.latencyMs;

      let keptIds = topKByScore(retrieval.chunkIds, retrieval.scores, cfg.finalK);
      if (cfg.rerankModel) {
        ensureLive();
        const chunkMap = await ports.vectorStore.getChunksByIds(retrieval.chunkIds);
        const docs = retrieval.chunkIds.map((id) => chunkMap.get(id)?.content ?? "");
        const { stage, keptChunkIds } = await rerankCandidates({
          gateway: ports.gateway,
          rerankModel: cfg.rerankModel,
          query: cfg.query,
          chunkIds: retrieval.chunkIds,
          chunkContents: docs,
          finalK: cfg.finalK,
          relevanceThreshold: cfg.relevanceThreshold,
          onCost: async (usd) => {
            totalCost += usd;
          },
        });
        keptIds = keptChunkIds;
        totalLatency += stage.latencyMs;
        send("stage", { stage: "rerank", data: stage, receipt: stage });
      } else {
        send("stage", { stage: "rerank", data: { skipped: true }, receipt: { latencyMs: 0, costUsd: 0 } });
      }

      ensureLive();
      const chunkMap = await ports.vectorStore.getChunksByIds(keptIds);
      const gen = await generateAnswer({
        gateway: ports.gateway,
        genModel: cfg.genModel,
        question: cfg.query,
        keptChunkIds: keptIds,
        chunkMap,
        onCost: async (usd) => {
          totalCost += usd;
        },
      });
      totalLatency += gen.stage.latencyMs;
      send("stage", { stage: "generate", data: { answer: gen.answer, ...gen.stage }, receipt: gen.stage });

      const judgeModel = cfg.judgeModel ?? process.env.JUDGE_MODEL;
      if (judgeModel) {
        ensureLive();
        const context = keptIds.map((id) => chunkMap.get(id)?.content ?? "").join("\n\n");
        const judge = await judgeAnswer({
          scorer: ports.scorer,
          gateway: ports.gateway,
          judgeModel,
          context,
          question: cfg.query,
          referenceAnswer: "",
          candidate: gen.answer,
          onCost: async (usd) => {
            totalCost += usd;
          },
        });
        totalLatency += judge.latencyMs;
        send("stage", { stage: "judge", data: judge, receipt: judge });
      } else {
        send("stage", {
          stage: "judge",
          data: { skipped: true, reason: "Set JUDGE_MODEL or judgeModel in request" },
          receipt: { latencyMs: 0, costUsd: 0 },
        });
      }

      send("done", { totalCostUsd: totalCost, totalLatencyMs: totalLatency });
    } catch (err) {
      if (err instanceof InspectAborted) {
        app.log.info({ inspectId: req.params.id }, "Inspect stream aborted by client");
      } else {
        app.log.error(
          { inspectId: req.params.id, err },
          "Inspect pipeline failed"
        );
        // Upstream messages can carry internal detail: send a safe summary.
        send("pipeline_error", { message: safePersistedError(err, "Pipeline failed") });
      }
    } finally {
      reply.raw.end();
    }
  });
}

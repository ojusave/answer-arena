import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  getDb,
  schema,
  getChunksWithSources,
  countReadyDocuments,
} from "@ragtime/db";
import { getOwnedTrial } from "../lib/ownership.js";
import { asSessionRequest } from "../types.js";

const { combos, questions, corpora } = schema;

export function registerTrialRoutes(app: FastifyInstance): void {
  const db = getDb();

  app.get<{ Params: { id: string } }>("/api/trials/:id", async (req, reply) => {
    const { sessionId } = asSessionRequest(req);
    const owned = await getOwnedTrial(db, req.params.id, sessionId);
    if (!owned) return reply.status(404).send({ error: "Not found" });

    const { trial, run } = owned;
    const combo = await db.query.combos.findFirst({
      where: eq(combos.id, trial.comboId),
    });
    const question = await db.query.questions.findFirst({
      where: eq(questions.id, trial.questionId),
    });
    const corpus = await db.query.corpora.findFirst({
      where: eq(corpora.id, run.corpusId),
      columns: { id: true, name: true },
    });
    const stages = trial.stages as {
      retrieval?: { chunkIds: string[] };
      rerank?: { keptChunkIds: string[] };
    };
    const chunkIds = [
      ...(stages.retrieval?.chunkIds ?? []),
      ...(stages.rerank?.keptChunkIds ?? []),
    ];
    const uniqueIds = [...new Set(chunkIds)];
    const chunkMap = await getChunksWithSources(db, uniqueIds);
    const documentCount = await countReadyDocuments(db, run.corpusId);

    return {
      data: {
        trial,
        combo,
        question,
        corpus: {
          id: corpus?.id ?? run.corpusId,
          name: corpus?.name ?? "Document library",
          documentCount,
        },
        chunks: [...chunkMap.values()],
      },
    };
  });
}

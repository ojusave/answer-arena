import {
  htmlTextExtractor,
  recursiveChunker,
  rubricScorer,
  type PipelinePorts,
} from "@ragtime/core";
import { createPgVectorStore, getDb } from "@ragtime/db";
import { createModelGateway } from "./model-gateway.js";

/** Wires replaceable pipeline capabilities in one shared composition root. */
export function createPipelinePorts(): PipelinePorts {
  const db = getDb();
  return {
    gateway: createModelGateway(),
    vectorStore: createPgVectorStore(db),
    extractor: htmlTextExtractor,
    chunker: recursiveChunker,
    scorer: rubricScorer,
  };
}

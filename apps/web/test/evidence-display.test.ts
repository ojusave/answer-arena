import assert from "node:assert/strict";
import test from "node:test";
import {
  groupEvidencePassages,
  highlightSegments,
  matchStrength,
  matchStrengthLabel,
  passageTitle,
  questionTerms,
  usedChunkIds,
  type EvidenceChunk,
} from "../src/client/lib/evidence-display.js";

test("labels cosine scores as beginner-friendly match strength", () => {
  assert.equal(matchStrength(0.406, 1), "best");
  assert.equal(matchStrength(0.28, 2), "strong");
  assert.equal(matchStrength(0.2, 5), "possible");
  assert.equal(matchStrength(0.15, 12), "weak");
  assert.equal(matchStrengthLabel("best"), "Best match");
});

test("prefers document title over Passage N", () => {
  assert.equal(
    passageTitle({
      id: "c1",
      idx: 0,
      content: "# Fallback heading\nBody text",
      documentTitle: "Folic acid and homocysteine",
    }),
    "Folic acid and homocysteine"
  );
  assert.equal(
    passageTitle({
      id: "c2",
      idx: 0,
      content: "# Randomized trial of folic acid\nBackground…",
    }),
    "Randomized trial of folic acid"
  );
});

test("groups used context passages ahead of extra search hits", () => {
  const chunks = new Map<string, EvidenceChunk>([
    [
      "a",
      {
        id: "a",
        idx: 0,
        content: "Homocysteine and vitamin B12",
        documentTitle: "B12 abstract",
        corpusName: "SciFact",
      },
    ],
    [
      "b",
      {
        id: "b",
        idx: 0,
        content: "Unrelated malaria paper",
        documentTitle: "Malaria abstract",
        corpusName: "SciFact",
      },
    ],
    [
      "c",
      {
        id: "c",
        idx: 0,
        content: "Folate dosing study",
        documentTitle: "Folate abstract",
        corpusName: "SciFact",
      },
    ],
  ]);

  const grouped = groupEvidencePassages({
    retrievalIds: ["a", "b", "c"],
    retrievalScores: [0.4, 0.2, 0.3],
    usedIds: ["a", "c"],
    chunks,
  });

  assert.deepEqual(
    grouped.used.map((p) => p.id),
    ["a", "c"]
  );
  assert.deepEqual(
    grouped.additional.map((p) => p.id),
    ["b"]
  );
  assert.equal(grouped.used[0]!.usedInAnswer, true);
  assert.equal(grouped.additional[0]!.usedInAnswer, false);
  assert.equal(grouped.used[0]!.title, "B12 abstract");
});

test("resolves used chunk ids from generation, then rerank, then retrieval", () => {
  assert.deepEqual(
    usedChunkIds({
      retrieval: { chunkIds: ["r1", "r2", "r3", "r4", "r5", "r6"] },
      rerank: { keptChunkIds: ["r2", "r1"] },
      generation: { contextChunkIds: ["r1"] },
    }),
    ["r1"]
  );
  assert.deepEqual(
    usedChunkIds({
      retrieval: { chunkIds: ["r1", "r2", "r3", "r4", "r5", "r6"] },
      rerank: { keptChunkIds: ["r2", "r1"] },
    }),
    ["r2", "r1"]
  );
  assert.deepEqual(
    usedChunkIds({
      retrieval: { chunkIds: ["r1", "r2", "r3", "r4", "r5", "r6"] },
    }),
    ["r1", "r2", "r3", "r4", "r5"]
  );
});

test("highlights literal question terms in snippets", () => {
  const terms = questionTerms(
    "A deficiency of vitamin B12 increases blood levels of homocysteine."
  );
  assert.ok(terms.includes("vitamin"));
  assert.ok(terms.includes("homocysteine"));
  assert.ok(!terms.includes("of"));

  const parts = highlightSegments(
    "Lowering serum homocysteine with vitamin B12",
    terms
  );
  assert.ok(parts.some((part) => part.hit && /homocysteine/i.test(part.text)));
  assert.ok(parts.some((part) => part.hit && /vitamin/i.test(part.text)));
});

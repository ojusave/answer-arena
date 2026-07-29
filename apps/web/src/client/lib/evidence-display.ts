/** Pure helpers for ADHD-friendly Inspect evidence display. */

export type MatchStrength = "best" | "strong" | "possible" | "weak";

export type EvidenceChunk = {
  id: string;
  idx: number;
  content: string;
  documentId?: string;
  documentTitle?: string;
  sourceUri?: string | null;
  corpusName?: string;
};

export type EvidencePassage = {
  id: string;
  rank: number;
  score?: number;
  title: string;
  snippet: string;
  content: string;
  sourceUri: string | null;
  corpusName: string;
  usedInAnswer: boolean;
  match: MatchStrength;
};

/** Bands for cosine similarity (0–1). Tuned for SciFact demo scores. */
export function matchStrength(score: number | undefined, rank: number): MatchStrength {
  if (score == null) {
    if (rank === 1) return "best";
    if (rank <= 3) return "strong";
    if (rank <= 8) return "possible";
    return "weak";
  }
  if (score >= 0.35 || rank === 1) return "best";
  if (score >= 0.25) return "strong";
  if (score >= 0.18) return "possible";
  return "weak";
}

export function matchStrengthLabel(match: MatchStrength): string {
  switch (match) {
    case "best":
      return "Best match";
    case "strong":
      return "Strong match";
    case "possible":
      return "Possible match";
    case "weak":
      return "Weak match";
  }
}

/** First line or heading-like prefix from content when no document title exists. */
export function passageTitle(chunk: EvidenceChunk): string {
  const titled = chunk.documentTitle?.trim();
  if (titled) return titled;
  const first = chunk.content.trim().split(/\n/)[0] ?? "";
  const cleaned = first.replace(/^#\s*/, "").trim();
  if (cleaned.length <= 90) return cleaned || `Passage ${chunk.idx}`;
  return `${cleaned.slice(0, 87)}…`;
}

export function passageSnippet(content: string, max = 160): string {
  const text = content.replace(/^#\s*[^\n]+\n+/, "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/**
 * Splits retrieved passages into those sent to the answer model vs the rest.
 * Prefer generation.contextChunkIds, then rerank kept ids, else top retrieval.
 */
export function groupEvidencePassages(args: {
  retrievalIds: string[];
  retrievalScores: number[];
  usedIds: string[];
  chunks: Map<string, EvidenceChunk>;
}): { used: EvidencePassage[]; additional: EvidencePassage[] } {
  const scoreById = new Map(
    args.retrievalIds.map((id, i) => [id, args.retrievalScores[i]] as const)
  );
  const usedSet = new Set(args.usedIds);
  const order = [
    ...args.usedIds.filter((id) => args.retrievalIds.includes(id) || args.chunks.has(id)),
    ...args.retrievalIds.filter((id) => !usedSet.has(id)),
  ];

  const used: EvidencePassage[] = [];
  const additional: EvidencePassage[] = [];

  for (const id of order) {
    const chunk = args.chunks.get(id);
    if (!chunk) continue;
    const rank = Math.max(1, args.retrievalIds.indexOf(id) + 1);
    const score = scoreById.get(id);
    const passage: EvidencePassage = {
      id,
      rank,
      score,
      title: passageTitle(chunk),
      snippet: passageSnippet(chunk.content),
      content: chunk.content,
      sourceUri: chunk.sourceUri ?? null,
      corpusName: chunk.corpusName ?? "Document library",
      usedInAnswer: usedSet.has(id),
      match: matchStrength(score, rank),
    };
    if (passage.usedInAnswer) used.push(passage);
    else additional.push(passage);
  }

  return { used, additional };
}

/** Resolves which chunk ids the answer model actually read. */
export function usedChunkIds(stages: {
  retrieval?: { chunkIds: string[] };
  rerank?: { keptChunkIds: string[] };
  generation?: { contextChunkIds?: string[] };
}): string[] {
  const fromGeneration = stages.generation?.contextChunkIds;
  if (fromGeneration && fromGeneration.length > 0) return fromGeneration;
  if (stages.rerank?.keptChunkIds?.length) return stages.rerank.keptChunkIds;
  return stages.retrieval?.chunkIds?.slice(0, 5) ?? [];
}

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "is",
  "are",
  "was",
  "were",
  "be",
  "by",
  "with",
  "as",
  "at",
  "from",
  "that",
  "this",
  "it",
  "its",
]);

/** Significant question words for literal snippet highlighting. */
export function questionTerms(question: string): string[] {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
  return [...new Set(words)].slice(0, 8);
}

/** Splits text into plain and highlight segments for question-term matches. */
export function highlightSegments(
  text: string,
  terms: string[]
): { text: string; hit: boolean }[] {
  if (terms.length === 0) return [{ text, hit: false }];
  const pattern = new RegExp(`\\b(${terms.map(escapeRegExp).join("|")})\\b`, "gi");
  const parts: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start), hit: false });
    parts.push({ text: match[0]!, hit: true });
    last = start + match[0]!.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts.length > 0 ? parts : [{ text, hit: false }];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

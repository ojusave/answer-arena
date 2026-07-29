import { Badge, Group, Stack, Text } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import type { TrialStages } from "@ragtime/core";
import { COPY } from "../lib/copy";
import { scorePercent, scoreTone } from "../lib/score-display";
import {
  groupEvidencePassages,
  questionTerms,
  usedChunkIds,
  type EvidenceChunk,
} from "../lib/evidence-display";
import InspectEvidence from "./workspace/InspectEvidence";
import InspectRunDetails from "./workspace/InspectRunDetails";

type Props = {
  stages: TrialStages;
  answer?: string | null;
  chunks?: Map<string, EvidenceChunk>;
  questionText: string;
  corpusName: string;
  documentCount: number;
  combo: {
    embeddingModel: string;
    rerankModel: string | null;
    genModel: string;
  };
  highlightChunkId?: string | null;
  onChunkHover?: (id: string | null) => void;
  resetKey?: string;
};

function shortModel(id: string): string {
  return id.split("/").pop() ?? id;
}

/** Inspect body: Answer → Verdict → Evidence → Run details. */
export default function TrialStagesPanel({
  stages,
  answer,
  chunks,
  questionText,
  corpusName,
  documentCount,
  combo,
  highlightChunkId,
  onChunkHover,
  resetKey,
}: Props) {
  const retrieval = stages.retrieval;
  const judge = stages.judge;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    setExpandedId(null);
    setMoreOpen(false);
    setDetailsOpen(false);
  }, [resetKey]);

  const terms = useMemo(() => questionTerms(questionText), [questionText]);
  const usedIds = useMemo(() => usedChunkIds(stages), [stages]);
  const grouped = useMemo(
    () =>
      groupEvidencePassages({
        retrievalIds: retrieval?.chunkIds ?? [],
        retrievalScores: retrieval?.scores ?? [],
        usedIds,
        chunks: chunks ?? new Map(),
      }),
    [retrieval, usedIds, chunks]
  );

  const retrievedCount = retrieval?.chunkIds.length ?? 0;

  return (
    <Stack gap="lg" className="inspect-flow">
      <section className="inspect-section">
        <Text className="inspect-section__title">{COPY.app.answerFromSetup}</Text>
        {answer?.trim() ? (
          <Text size="sm" className="inspect-answer">
            {answer.split(/(\[chunk:\d+\])/g).map((part, i) =>
              /^\[chunk:(\d+)\]$/.test(part) ? (
                <Badge key={i} size="sm" variant="light" mr={4}>
                  {COPY.stages.passageLabel(Number(part.match(/\d+/)?.[0] ?? 0))}
                </Badge>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            {COPY.app.noAnswerYet}
          </Text>
        )}
      </section>

      <section className="inspect-section">
        <Text className="inspect-section__title">{COPY.app.howAnswerScored}</Text>
        {judge ? (
          <Stack gap="sm">
            <Group gap="xs" align="center">
              {judge.correctness == null && (
                <Badge color="grape" variant="light" size="sm">
                  {COPY.app.judgeOnlyBadge}
                </Badge>
              )}
              <Text size="xs" c="dimmed">
                {COPY.stages.rateAnswer(shortModel(judge.judgeModel))}
              </Text>
            </Group>
            <div className="judge-score-grid" role="list" aria-label="Judge dimension scores">
              {(
                [
                  [COPY.app.faithfulnessDimension, judge.faithfulness],
                  ...(judge.correctness == null
                    ? []
                    : ([[COPY.app.correctnessDimension, judge.correctness]] as const)),
                  [COPY.app.completenessDimension, judge.completeness],
                ] as const
              ).map(([label, value]) => {
                const score = scorePercent(value);
                return (
                  <div
                    key={label}
                    className={`judge-score score-tone--${scoreTone(score)}`}
                    role="listitem"
                    aria-label={`${label}: ${score ?? 0} out of 100`}
                  >
                    <span className="judge-score__value">{score ?? "—"}</span>
                    <span className="judge-score__scale">/100</span>
                    <span className="judge-score__label">{label}</span>
                  </div>
                );
              })}
            </div>
            <Text size="sm" className="judge-rationale">
              {judge.rationale}
            </Text>
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            {COPY.app.waitingForJudge}
          </Text>
        )}
      </section>

      <InspectEvidence
        corpusName={corpusName}
        documentCount={documentCount}
        retrievedCount={retrievedCount}
        used={grouped.used}
        additional={grouped.additional}
        terms={terms}
        expandedId={expandedId}
        onExpand={setExpandedId}
        moreOpen={moreOpen}
        onMoreToggle={() => setMoreOpen((open) => !open)}
        highlightChunkId={highlightChunkId}
        onChunkHover={onChunkHover}
      />

      <InspectRunDetails
        open={detailsOpen}
        onToggle={() => setDetailsOpen((open) => !open)}
        stages={stages}
        combo={combo}
        retrievedCount={retrievedCount}
      />
    </Stack>
  );
}

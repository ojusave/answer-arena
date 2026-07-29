import { Badge, Group, Text, UnstyledButton } from "@mantine/core";
import InfoHint from "../InfoHint";
import { COPY } from "../../lib/copy";
import {
  highlightSegments,
  matchStrengthLabel,
  type EvidencePassage,
} from "../../lib/evidence-display";

type Props = {
  passage: EvidencePassage;
  expanded: boolean;
  onToggle: () => void;
  terms: string[];
  highlighted: boolean;
  onHover?: (id: string | null) => void;
};

/** One evidence card: title + snippet collapsed; full text on demand. */
export default function EvidencePassageCard({
  passage,
  expanded,
  onToggle,
  terms,
  highlighted,
  onHover,
}: Props) {
  const panelId = `passage-${passage.id}`;
  const segments = highlightSegments(
    expanded ? passage.content : passage.snippet,
    terms
  );

  return (
    <article
      className={`evidence-card${highlighted ? " evidence-card--active" : ""}${
        passage.usedInAnswer ? " evidence-card--used" : ""
      }`}
      onMouseEnter={() => onHover?.(passage.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
        <Text className="evidence-card__title" lineClamp={expanded ? undefined : 2}>
          {passage.title}
        </Text>
        <Group gap={4} wrap="nowrap">
          <Badge size="xs" variant="light" color={passage.usedInAnswer ? "green" : "gray"}>
            {passage.usedInAnswer
              ? COPY.app.usedInAnswer
              : COPY.app.searchResultRank(passage.rank)}
          </Badge>
        </Group>
      </Group>

      <Group gap={6} align="center" mt={4}>
        <Text size="xs" c="dimmed">
          {matchStrengthLabel(passage.match)}
        </Text>
        <InfoHint ariaLabel={COPY.app.fieldInfoAria("Similarity score")}>
          {COPY.app.similarityScoreInfo}
          {passage.score != null ? ` Raw score: ${passage.score.toFixed(3)}.` : ""}
        </InfoHint>
      </Group>

      <Text size="sm" className="evidence-card__body" component="div">
        {segments.map((part, i) =>
          part.hit ? (
            <mark key={i} className="evidence-hit">
              {part.text}
            </mark>
          ) : (
            <span key={i}>{part.text}</span>
          )
        )}
      </Text>

      <UnstyledButton
        type="button"
        className="evidence-card__toggle"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        {expanded ? COPY.app.collapsePassage : COPY.app.readPassage}
      </UnstyledButton>
      <div id={panelId} hidden={!expanded} />
    </article>
  );
}

import { Collapse, Stack, Text, UnstyledButton } from "@mantine/core";
import { useId } from "react";
import { LabelWithInfo } from "../InfoHint";
import { COPY } from "../../lib/copy";
import type { EvidencePassage } from "../../lib/evidence-display";
import EvidencePassageCard from "./EvidencePassageCard";

type Props = {
  corpusName: string;
  documentCount: number;
  retrievedCount: number;
  used: EvidencePassage[];
  additional: EvidencePassage[];
  terms: string[];
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  moreOpen: boolean;
  onMoreToggle: () => void;
  highlightChunkId?: string | null;
  onChunkHover?: (id: string | null) => void;
};

/** Evidence summary plus used passages and collapsed extra search hits. */
export default function InspectEvidence({
  corpusName,
  documentCount,
  retrievedCount,
  used,
  additional,
  terms,
  expandedId,
  onExpand,
  moreOpen,
  onMoreToggle,
  highlightChunkId,
  onChunkHover,
}: Props) {
  const moreId = useId();

  return (
    <section className="inspect-section">
      <LabelWithInfo
        label={COPY.app.evidenceUsed}
        info={COPY.app.evidenceProvenanceInfo}
        ariaLabel={COPY.app.fieldInfoAria(COPY.app.evidenceUsed)}
      />
      <Text size="sm" mt={6} mb="sm">
        {COPY.app.evidenceSummary(documentCount, retrievedCount, used.length)}
      </Text>
      <Text size="xs" c="dimmed" mb="sm">
        Source library: {corpusName}
      </Text>

      {used.length === 0 && additional.length === 0 ? (
        <Text size="sm" c="dimmed">
          {COPY.app.noEvidenceYet}
        </Text>
      ) : (
        <Stack gap="sm">
          {used.map((passage) => (
            <EvidencePassageCard
              key={passage.id}
              passage={passage}
              expanded={expandedId === passage.id}
              onToggle={() => onExpand(expandedId === passage.id ? null : passage.id)}
              terms={terms}
              highlighted={highlightChunkId === passage.id}
              onHover={onChunkHover}
            />
          ))}

          {additional.length > 0 && (
            <div>
              <UnstyledButton
                type="button"
                className="evidence-more__toggle"
                onClick={onMoreToggle}
                aria-expanded={moreOpen}
                aria-controls={moreId}
              >
                {moreOpen
                  ? COPY.app.hideMoreResults
                  : COPY.app.showMoreResults(additional.length)}
              </UnstyledButton>
              <Collapse in={moreOpen}>
                <Stack gap="sm" id={moreId} mt="sm">
                  <Text size="xs" c="dimmed">
                    {COPY.app.moreSearchResults(additional.length)}
                  </Text>
                  {additional.map((passage) => (
                    <EvidencePassageCard
                      key={passage.id}
                      passage={passage}
                      expanded={expandedId === passage.id}
                      onToggle={() =>
                        onExpand(expandedId === passage.id ? null : passage.id)
                      }
                      terms={terms}
                      highlighted={highlightChunkId === passage.id}
                      onHover={onChunkHover}
                    />
                  ))}
                </Stack>
              </Collapse>
            </div>
          )}
        </Stack>
      )}
    </section>
  );
}

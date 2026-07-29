import { Collapse, Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { useId } from "react";
import type { TrialStages } from "@ragtime/core";
import InfoHint from "../InfoHint";
import { COPY } from "../../lib/copy";
import { formatReceipt } from "../../lib/receipt";

type Props = {
  open: boolean;
  onToggle: () => void;
  stages: TrialStages;
  combo: {
    embeddingModel: string;
    rerankModel: string | null;
    genModel: string;
  };
  retrievedCount: number;
};

function shortModel(id: string): string {
  return id.split("/").pop() ?? id;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="sm" wrap="nowrap" align="flex-start">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="xs" ta="right" ff="monospace">
        {value}
      </Text>
    </Group>
  );
}

/** Collapsed model / cost / latency details for one inspected setup. */
export default function InspectRunDetails({
  open,
  onToggle,
  stages,
  combo,
  retrievedCount,
}: Props) {
  const detailsId = useId();
  const { retrieval, rerank, generation, judge } = stages;

  return (
    <section className="inspect-section">
      <Group gap={6} align="center" wrap="nowrap">
        <UnstyledButton
          type="button"
          className="inspect-details__toggle"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={detailsId}
        >
          <Group gap={6} align="center">
            <Text fw={600} size="sm">
              {COPY.app.runDetails}
            </Text>
            <Text size="xs" c="dimmed">
              {open ? "▾" : "▸"}
            </Text>
          </Group>
        </UnstyledButton>
        <InfoHint ariaLabel={COPY.app.fieldInfoAria(COPY.app.runDetails)}>
          {COPY.app.runDetailsHint}
        </InfoHint>
      </Group>
      <Collapse in={open}>
        <Stack gap={6} id={detailsId} mt="sm" className="inspect-details">
          <DetailRow
            label={COPY.stages.embeddingModel}
            value={shortModel(combo.embeddingModel)}
          />
          <DetailRow
            label={COPY.stages.rerankModel}
            value={combo.rerankModel ? shortModel(combo.rerankModel) : COPY.stages.none}
          />
          <DetailRow label={COPY.stages.answerModel} value={shortModel(combo.genModel)} />
          {judge && (
            <DetailRow
              label={COPY.stages.judgeModel}
              value={shortModel(judge.judgeModel)}
            />
          )}
          {retrieval && (
            <DetailRow
              label={COPY.stages.findPassages(retrievedCount)}
              value={formatReceipt(retrieval)}
            />
          )}
          {rerank && (
            <DetailRow label={COPY.stages.rerank} value={formatReceipt(rerank)} />
          )}
          {generation && (
            <DetailRow
              label={COPY.stages.writeAnswer}
              value={formatReceipt(generation)}
            />
          )}
          {judge && (
            <DetailRow
              label={COPY.stages.rateAnswer(shortModel(judge.judgeModel))}
              value={formatReceipt(judge)}
            />
          )}
        </Stack>
      </Collapse>
    </section>
  );
}

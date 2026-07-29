/** User-facing copy (single source of truth). */

export const FLOW_STEPS = [
  { label: "Choose a question", description: "Pick a sample or write your own" },
  {
    label: "Compose setups",
    description:
      "Each setup combines an embedding, an optional rerank, and a generation model",
  },
  {
    label: "Run and compare",
    description: "Setups run in parallel as durable workflow tasks",
  },
] as const;

export const RUN_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ingesting: "Indexing documents",
  running: "Running",
  aggregating: "Aggregating",
  complete: "Complete",
  failed: "Failed",
  canceled: "Canceled",
  budget_exceeded: "Budget exceeded",
};

export function runStatusLabel(status: string): string {
  return RUN_STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

export const TEST_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  complete: "Complete",
  failed: "Failed",
  skipped: "Skipped",
};

/**
 * Keyed by trial.stage event names. Labels match answer-card roles
 * (Search / Rerank / Answer) so beginners see one vocabulary.
 */
export const PIPELINE_STAGE_LABEL: Record<string, string> = {
  retrieval: "Search",
  rerank: "Rerank",
  generation: "Answer",
  judge: "Judge",
};

export function stageLabel(stage: string): string {
  return PIPELINE_STAGE_LABEL[stage] ?? stage.replace(/_/g, " ");
}

/** Present-tense phrase for the live timeline status line. */
export function stageProgressPhrase(stage: string): string {
  switch (stage) {
    case "retrieval":
      return "searching the library";
    case "rerank":
      return "reranking passages";
    case "generation":
      return "writing an answer";
    case "judge":
      return "scoring the answer";
    default:
      return stageLabel(stage).toLowerCase();
  }
}

export function formatMatrixSummary(args: {
  embedCount: number;
  rerankCount: number;
  genCount: number;
  questionCount: number;
  budgetUsd: number;
  maxTrials: number;
}): { line: string; trialCount: number; overLimit: boolean } {
  const setups = args.embedCount * args.rerankCount * args.genCount;
  const trialCount = setups * args.questionCount;
  const overLimit = trialCount > args.maxTrials;
  const line = `Comparing ${setups} setup${setups === 1 ? "" : "s"} on ${args.questionCount} question${args.questionCount === 1 ? "" : "s"} (${trialCount} answer${trialCount === 1 ? "" : "s"}). Spend limit $${args.budgetUsd.toFixed(2)}.`;
  return { line, trialCount, overLimit };
}

/** Summary line for explicit-setup mode, counting one answer per setup per question. */
export function formatSetupSummary(args: {
  setupCount: number;
  questionCount: number;
  budgetUsd: number;
  maxTrials: number;
}): { line: string; trialCount: number; overLimit: boolean } {
  const trialCount = args.setupCount * args.questionCount;
  const overLimit = trialCount > args.maxTrials;
  const line = `Comparing ${args.setupCount} setup${args.setupCount === 1 ? "" : "s"} on ${args.questionCount} question${args.questionCount === 1 ? "" : "s"} (${trialCount} answer${trialCount === 1 ? "" : "s"}). Spend limit $${args.budgetUsd.toFixed(2)}.`;
  return { line, trialCount, overLimit };
}

export type FriendlyErrorMeta = {
  /** Machine-readable provider error code, mapped before any string heuristics. */
  code?: string;
  /** Adapter-supplied link that helps the user resolve the error. */
  helpUrl?: string;
};

/** Maps provider error codes to plain-language messages. Falls back to string heuristics. */
export function friendlyError(raw: string, meta?: FriendlyErrorMeta): string {
  switch (meta?.code) {
    case "insufficient_credits":
      return meta.helpUrl
        ? `Credits are low. Add more credits: ${meta.helpUrl}`
        : "Credits are low. Add more credits to your model gateway account.";
    case "rate_limited":
      return "The model gateway is rate limiting requests. Wait a moment and try again.";
    case "auth":
      return "The model gateway rejected the request. Check the API key configuration.";
    case "invalid_model":
      return "One of the selected models is not available on the model gateway.";
    case "provider_unavailable":
      return "The model gateway is temporarily unavailable. Try again shortly.";
    case "workflow_auth":
      return "Run did not start: the workflow dispatcher rejected its credentials. Check the deployment configuration.";
    case "workflow_not_found":
      return "Run did not start: the configured workflow task is unavailable.";
    case "workflow_unavailable":
      return "Run did not start: the workflow dispatcher could not be reached. Try again shortly.";
    // Admission messages already name the limit that was hit, so pass them through.
    case "session_run_limit":
    case "global_run_limit":
      return raw;
    default:
      break;
  }

  const msg = raw.trim();
  if (!msg || msg === "Unknown error") {
    return "Request failed. Try fewer models or check the service logs.";
  }
  if (msg.includes("ECONNREFUSED") || msg.includes("CONNECT_TIMEOUT") || msg.includes("5432")) {
    return "Database unavailable. Wait a minute and try again.";
  }
  if (msg.includes("403") || msg.includes("forbidden")) {
    return "Run did not start. Check deployment configuration.";
  }
  if (msg.includes("402") || msg.includes("Insufficient credits")) {
    return "Credits are low. Add more credits to your model gateway account.";
  }
  if (msg.includes("matrix would run") || msg.includes("max ")) {
    return msg.replace(/model stack/gi, "model setup");
  }
  if (msg.includes("Not found")) {
    return "Run not found. It may belong to another browser session.";
  }
  return msg;
}

export const COPY = {
  app: {
    subtitle: "RAG pipeline comparison",
    zones: { inputs: "Configure", run: "Compare", detail: "Inspect" },
    phaseConfigure: "Configure",
    phaseRunning: "Running",
    phaseResults: "Results",
    backToConfigure: "New comparison",
    closeEvidence: "Close evidence",
    runningSetupsHeading: (n: number) =>
      `Running ${n} setup${n === 1 ? "" : "s"} on the same question`,
    answersReady: (done: number, total: number) =>
      `${done} of ${total} answer${total === 1 ? "" : "s"} ready`,
    spendLimit: (spent: string, budget: string) => `Spend ${spent} / ${budget}`,
    topSetup: "Top setup",
    leadingSoFar: "Leading so far",
    noWinnerYet: "No winner yet",
    whyItLeads: "Why it leads",
    rankingBasis:
      "Ranked by judge score. Ties break to lower cost, then lower answer latency.",
    seeAnswerAndEvidence: "See answer and evidence",
    setupDetails: "Setup details",
    technicalTimeline: "Technical timeline",
    advancedResults: "Advanced results",
    runnerUp: "Runner-up",
    costVsNext: (delta: string) =>
      delta.startsWith("-") ? `${delta.slice(1)} cheaper than next` : `${delta} more than next`,
    latencyVsNext: (delta: string) =>
      delta.startsWith("-")
        ? `${delta.slice(1)} faster than next`
        : `${delta} slower than next`,
    stageSearch: "Search",
    stageRerank: "Rerank",
    stageAnswer: "Answer",
    stageJudge: "Judge",
    stageDone: "done",
    stageActive: "active",
    stageWaiting: "waiting",
    stageSkipped: "skipped",
    stageFailed: "failed",
    configureWhileRunning: "This comparison is running. Cancel it to change the setups.",
    welcomeTitle: "Compare retrieval pipelines against the same evidence.",
    welcomeBody:
      "Load the sample corpus, choose the models in each setup, then compare their answers, evidence, cost, and latency.",
    questionSection: "Question",
    modelsSection: "Setups",
    sampleQuestions: "Sample questions",
    sampleQuestionsInfo:
      "Pre-written questions that match the demo medical abstracts. Pick one to fill the question box, or ignore this and type your own.",
    promptPlaceholder: "What does the evidence say about…?",
    yourQuestion: "Question text",
    yourQuestionInfo:
      "The exact question every setup will answer. Keep it the same so you are comparing models, not different prompts.",
    embedLabel: "Embedding",
    embedHint: "Finds candidate passages",
    embedInfo:
      "The embedding model turns your question and each passage into vectors, then finds the passages whose vectors are closest. This is the first-pass search.",
    rerankLabel: "Rerank (optional)",
    rerankHint: "Reorders passages before answering",
    rerankInfo:
      "A reranker re-scores the passages from the first search and moves the most relevant ones to the top. It is optional: leave it as None to skip this step.",
    noRerankLabel: "Include runs without rerank",
    noRerankInfo:
      "When Matrix mode expands combinations, also create setups that skip reranking. Useful to see whether a reranker helps versus the same search + answer models alone.",
    genLabel: "Generation",
    genHint: "Writes the answer",
    genInfo:
      "The generation model reads the top passages and writes the final answer. This is the answer you compare across setups.",
    judgeLabel: "Judge model",
    judgeHint: "Scores every answer",
    judgeInfo:
      "The judge model reads each answer with the passages behind it, then scores faithfulness, correctness, and completeness. Every setup in a run is scored by the same judge.",
    fieldInfoAria: (name: string) => `What is ${name}?`,
    noneOption: "None",
    suggested: "Suggested",
    starterPreset: "Suggested setups",
    addSetup: "Add setup",
    removeSetup: "Remove setup",
    setupNumber: (n: number) => `Setup ${n}`,
    emptySetups: "Add a setup to compose your first pipeline.",
    matrixMode: "Matrix mode (cross every model)",
    matrixModeHint:
      "Pick models per stage and run every combination. Expanding fills the setup list above.",
    expandMatrix: "Expand into setups",
    advanced: "Retrieval settings",
    retrieveLabel: "Passages to search",
    retrieveInfo:
      "How many passages the embedding search returns first (sometimes called Retrieve K). Higher can find more evidence but costs more and may add noise. Default is fine to start.",
    finalKLabel: "Passages for the answer",
    finalKInfo:
      "How many passages the answer model actually reads (sometimes called Final K). If you use a reranker, it reorders the search results and keeps this many on top. Keep this less than or equal to Passages to search.",
    budgetLabel: "Spend limit (USD)",
    budgetInfo:
      "Maximum this comparison can spend on model calls. The run stops new paid calls once reservations would exceed this amount. Lower it for cheap smoke tests; raise it for larger matrices.",
    runSummaryInfo:
      "Each setup answers each question once. So 2 setups × 1 question means 2 answers side by side. The spend limit is the max this run can cost.",
    runButton: "Run",
    runningButton: "Running…",
    loadDemo: "Load demo library (100 medical abstracts)",
    loadingDemo: "Loading demo library…",
    demoLoadFailed: "Demo library failed to load",
    canvasIdleTitle: "No run in progress",
    canvasIdleBody:
      "Choose a question and configure at least one setup. Run the comparison to see every answer against the same evidence.",
    inspectorEmpty:
      "Select an answer to view its retrieved passages and the generated answer.",
    inspectorScoreAria: "Selected setup score",
    resizeAria: "Resize run and detail panes",
    runAgain: "New run",
    cancel: "Cancel run",
    escalateButton: (n: number) => `Run these setups across all ${n} questions`,
    escalateConfirmTitle: "Run the full comparison?",
    escalateConfirmBody: (trials: number, budget: string) =>
      `This runs every setup against all questions: ${trials} answers total, up to $${budget} in spend.`,
    escalateConfirm: "Run all questions",
    escalateCancel: "Not now",
    progressTitle: "Setups",
    progressHint: "Progress across every question. Select a setup to inspect one answer.",
    progressComplete: (done: number, total: number) => `${done}/${total} answered`,
    progress: (done: number, total: number) => `${done} of ${total} complete`,
    spend: (spent: string, budget: string) => `$${spent} / $${budget}`,
    elapsed: (sec: number) => `${sec.toFixed(1)}s`,
    bestScore: "Best score",
    answersTitle: "Compare answers",
    answersHint: "Same question for every setup. Open one to read the full answer and its evidence.",
    answerPending: "Waiting to run",
    answerRunning: "Writing an answer…",
    answerFailed: "This setup did not produce an answer.",
    answerEmpty: "No answer returned.",
    answerCost: "Cost",
    answerLatency: "Answer time",
    setups: "Setups",
    setupCount: (n: number) => `${n} setup${n === 1 ? "" : "s"}`,
    setupsScored: (scored: number, total: number) =>
      `${scored} of ${total} setup${total === 1 ? "" : "s"} scored`,
    awaitingScores: "Waiting for the first scored answer",
    arenaHint: "Open a setup to inspect its evidence.",
    judgeScore: "Judge score",
    judgeScoreTooltip:
      "A judge model rates faithfulness, correctness, and completeness from the retrieved passages.",
    judgeScoreAxis: "Judge score (0-100)",
    judgeOnlyBadge: "Judge-only",
    judgeOnlyTooltip:
      "No reference answer exists for this question, so correctness is not scored.",
    correctnessDimension: "Correctness",
    faithfulnessDimension: "Faithfulness",
    completenessDimension: "Completeness",
    answerFromSetup: "Answer from this setup",
    howAnswerScored: "How the answer scored",
    evidenceUsed: "Evidence used",
    evidenceSummary: (documents: number, retrieved: number, used: number) =>
      `Searched ${documents} documents · found ${retrieved} passages · used ${used}`,
    evidenceProvenanceInfo:
      "These passages came from the document library loaded into this RAGtime demo (for example SciFact medical abstracts). Search ranked them by similarity to your question. They are not live web results.",
    usedInAnswer: "Used in answer",
    searchResultRank: (n: number) => `Search result #${n}`,
    moreSearchResults: (count: number) => `More search results (${count})`,
    showMoreResults: (count: number) => `Show ${count} more results`,
    hideMoreResults: "Hide extra results",
    readPassage: "Read passage",
    collapsePassage: "Collapse",
    similarityScoreInfo:
      "This is how close the passage is to your question in embedding space. Higher means a closer match, not that the passage is factually correct.",
    runDetails: "Run details",
    runDetailsHint: "Models, timing, and spend for this setup.",
    noEvidenceYet: "No passages were retrieved for this setup yet.",
    noAnswerYet: "This setup has not produced an answer yet.",
    waitingForJudge: "Waiting for the judge score…",
    executionTimeline: "What's running",
    executionTimelineHint:
      "Each colored bar is one step. Bars that line up are working at the same time. Click a row to inspect that setup.",
    executionTimelineOverall: "Overall",
    executionTimelineWaiting: "Waiting for setups to start…",
    executionTimelineLive: "Live",
    howItWorks: "How it works",
    githubLink: "GitHub",
    footerStatus: (gatewayLabel: string) => `Workflow orchestration + ${gatewayLabel}`,
    gatewayDocs: (gatewayLabel: string) => `${gatewayLabel} docs`,
  },
  howItWorks: {
    title: "How a comparison runs",
    steps: [
      {
        title: "One question",
        body: "Your question goes to every setup.",
      },
      {
        title: "One setup, three models",
        body: "Each setup is one combination of the three models.",
      },
      {
        title: "Durable workflow tasks",
        body: "Setups run in parallel as durable tasks. Click any answer to see the passages and scores behind it.",
      },
    ],
    footnote: "Runs are scoped to this browser session.",
  },
  results: {
    leaderboard: "Results",
    chartTitle: "Cost vs score",
    exportCsv: "Download CSV",
    columns: {
      setup: "Setup",
      quality: "Score",
      cost: "Cost",
      p50: "p50 latency",
      p95: "p95 latency",
      failures: "Failed",
    },
    selfJudgedTooltip: "The answer model scored its own output.",
    selfJudgedBadge: "self-judged",
  },
  grid: {
    legendPending: "Pending",
    legendRunning: "Running",
    legendHigh: "Complete",
    legendFailed: "Failed",
  },
  stages: {
    findPassages: (n: number) => `Search results (${n})`,
    rerank: "Rerank",
    kept: (n: number) => `${n} passage${n === 1 ? "" : "s"} kept`,
    writeAnswer: "Answer",
    rateAnswer: (model: string) => `Judge (${model})`,
    costLatency: "Cost and latency",
    passageLabel: (idx: number) => `Passage ${idx}`,
    scores: (f: number, c: number, comp: number) =>
      `Faithfulness ${f} · Correctness ${c} · Completeness ${comp}`,
    embeddingModel: "Search model",
    rerankModel: "Rerank model",
    answerModel: "Answer model",
    judgeModel: "Judge model",
    none: "None",
  },
  notify: {
    comparisonStarted: "Run started",
    comparisonStopped: "Run canceled",
    demoLoaded: "Demo library loaded",
  },
  common: {
    loading: "Loading…",
    tryAgain: "Retry",
    cancel: "Cancel",
    confirm: "Confirm",
    close: "Close",
    notFound: "Not found",
    notFoundBody: "This page does not exist.",
    loadFailed: "Load failed",
  },
} as const;

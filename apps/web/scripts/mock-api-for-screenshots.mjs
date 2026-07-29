import http from "node:http";

const MODE = process.env.MOCK_MODE || "configure"; // configure | running | results

const models = {
  embedding: [
    {
      id: "nvidia/embed-v2",
      name: "NVIDIA Embed V2",
      pricing: { prompt: "0" },
    },
  ],
  rerank: [
    {
      id: "cohere/rerank-v3",
      name: "Cohere Rerank 3",
      pricing: { prompt: "0.0001" },
    },
  ],
  chat: [
    {
      id: "qwen/qwen3",
      name: "Qwen 3",
      pricing: { completion: "0.0002" },
    },
    {
      id: "anthropic/claude-sonnet",
      name: "Claude Sonnet",
      pricing: { completion: "0.001" },
    },
  ],
  gateway: {
    id: "openrouter",
    label: "OpenRouter",
    docsUrl: "https://openrouter.ai/docs",
  },
};

const samples = [
  {
    id: "q1",
    text: "What does the evidence say about treatment outcomes?",
    referenceAnswer: "Treatment improved outcomes.",
  },
];

const combos = [
  {
    comboId: "c1",
    embeddingModel: "nvidia/embed-v2",
    rerankModel: null,
    genModel: "qwen/qwen3",
    avgScore: MODE === "results" ? 9.1 : null,
    avgCostPerQuestion: MODE === "results" ? 0.0042 : null,
    p50GenerationLatencyMs: MODE === "results" ? 820 : null,
    p95GenerationLatencyMs: MODE === "results" ? 900 : null,
    totalCostUsd: MODE === "results" ? 0.0042 : 0.001,
    completeCount: MODE === "results" ? 1 : 0,
    failedCount: 0,
    selfJudged: false,
    label: "Qwen",
  },
  {
    comboId: "c2",
    embeddingModel: "nvidia/embed-v2",
    rerankModel: "cohere/rerank-v3",
    genModel: "anthropic/claude-sonnet",
    avgScore: MODE === "results" ? 8.4 : null,
    avgCostPerQuestion: MODE === "results" ? 0.0078 : null,
    p50GenerationLatencyMs: MODE === "results" ? 1100 : null,
    p95GenerationLatencyMs: MODE === "results" ? 1200 : null,
    totalCostUsd: MODE === "results" ? 0.0078 : 0.002,
    completeCount: MODE === "results" ? 1 : 0,
    failedCount: 0,
    selfJudged: false,
    label: "Claude",
  },
];

const grid =
  MODE === "configure"
    ? []
    : [
        {
          trialId: "t1",
          comboId: "c1",
          questionId: "q1",
          status: MODE === "results" ? "complete" : "running",
          overallScore: MODE === "results" ? "9.1" : null,
          attempts: 1,
          answer:
            MODE === "results"
              ? "The evidence supports a clear association between treatment and improved outcomes."
              : MODE === "running"
                ? "The evidence supports a clear association…"
                : null,
        },
        {
          trialId: "t2",
          comboId: "c2",
          questionId: "q1",
          status: MODE === "results" ? "complete" : "running",
          overallScore: MODE === "results" ? "8.4" : null,
          attempts: 1,
          answer:
            MODE === "results"
              ? "The abstracts indicate improved outcomes, though the studies differ in design and sample size."
              : null,
        },
      ];

if (MODE === "running") {
  combos[0].avgScore = null;
  grid[0].overallScore = null;
}

const run = {
  run: {
    id: "mock",
    corpusId: "corpus",
    status: MODE === "results" ? "complete" : MODE === "running" ? "running" : "pending",
    name: "Treatment evidence",
    budgetUsd: "5",
    totalCostUsd: MODE === "results" ? "0.012" : "0.003",
    startedAt: new Date(Date.now() - 12400).toISOString(),
    finishedAt: MODE === "results" ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
    error: null,
  },
  comboResults: combos,
  grid,
  questions: [
    {
      id: "q1",
      text: "What does the evidence say about treatment outcomes?",
    },
  ],
  phases: {
    documents: { total: 100, ready: 100 },
    embeddings: [],
    trials: { complete: MODE === "results" ? 2 : 0 },
  },
};

const trial = {
  trial: {
    answer: grid[0]?.answer ?? "Answer text",
    overallScore: "9.1",
    status: "complete",
    stages: {
      retrieval: {
        chunkIds: ["ch1", "ch2"],
        scores: [0.92, 0.81],
        latencyMs: 120,
        costUsd: 0,
      },
      generation: {
        model: "qwen/qwen3",
        latencyMs: 820,
        costUsd: 0.003,
      },
      judge: {
        judgeModel: "anthropic/claude-sonnet",
        faithfulness: 9.5,
        correctness: 9.0,
        completeness: 8.8,
        rationale: "The answer is supported by the retrieved evidence.",
        latencyMs: 430,
        costUsd: 0.0012,
      },
    },
  },
  question: {
    text: "What does the evidence say about treatment outcomes?",
    referenceAnswer: "Treatment improved outcomes.",
  },
  combo: {
    embeddingModel: "nvidia/embed-v2",
    rerankModel: null,
    genModel: "qwen/qwen3",
  },
  corpus: {
    name: "Medical abstracts",
    documentCount: 100,
  },
  chunks: [
    {
      id: "ch1",
      idx: 1,
      content:
        "The treatment group showed significantly improved outcomes compared with control.",
      documentTitle: "Treatment outcomes meta-analysis",
    },
    {
      id: "ch2",
      idx: 2,
      content: "Benefits were consistent across the included cohorts.",
      documentTitle: "Cohort consistency study",
    },
  ],
};

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const u = req.url || "";
  let out = null;
  let status = 200;
  if (u === "/api/demo") {
    out = {
      ready: true,
      corpusId: "corpus",
      documentCount: 100,
      readyDocumentCount: 100,
      questionCount: 4,
      name: "Medical abstracts",
    };
  } else if (u === "/api/samples") out = samples;
  else if (u === "/api/models") out = models;
  else if (u === "/api/config") out = { maxTrialsPerRun: 324, maxRunBudgetUsd: 20 };
  else if (u === "/api/runs/active") {
    out =
      MODE === "configure"
        ? null
        : { runId: "mock", status: run.run.status };
  } else if (req.method === "POST" && u === "/api/runs") out = { runId: "mock" };
  else if (u === "/api/runs/mock") out = run;
  else if (u.startsWith("/api/runs/mock/events")) out = [];
  else if (u.startsWith("/api/trials/")) out = trial;
  else if (u === "/healthz") {
    res.end(JSON.stringify({ ok: true }));
    return;
  } else {
    status = 404;
    out = { error: "not found", path: u };
  }
  res.statusCode = status;
  res.end(JSON.stringify(status === 404 ? out : { data: out }));
});

server.listen(3000, "127.0.0.1", () => {
  console.log(`mock api mode=${MODE} on :3000`);
});

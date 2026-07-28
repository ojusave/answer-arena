import assert from "node:assert/strict";
import test from "node:test";

import { createOpenRouterGateway } from "../dist/index.js";

async function withMockFetch(mock, run) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const CHAT_MODEL = {
  id: "vendor/chat",
  name: "Chat",
  architecture: { output_modalities: ["text"] },
};

const EMBEDDING_MODEL = {
  id: "vendor/embed",
  name: "Embed",
  architecture: { output_modalities: ["embeddings"] },
};

test("a broken embeddings source is reported, not reported as an empty catalog", async () => {
  const catalog = await withMockFetch(
    async (url) => {
      if (String(url).includes("/embeddings/models")) {
        return new Response("upstream exploded", { status: 500 });
      }
      return jsonResponse({ data: [CHAT_MODEL] });
    },
    async () => {
      const gateway = createOpenRouterGateway({ apiKey: "test-key" });
      return gateway.catalog();
    }
  );

  assert.equal(catalog.embedding.length, 0);
  assert.equal(catalog.chat.length, 1);
  assert.equal(catalog.warnings.length, 1);
  assert.equal(catalog.warnings[0].source, "/embeddings/models");
  // The failure must be distinguishable from a genuinely empty list.
  assert.ok(catalog.warnings[0].message.length > 0);
});

test("a healthy catalog carries no warnings", async () => {
  const catalog = await withMockFetch(
    async (url) =>
      jsonResponse({
        data: String(url).includes("/embeddings/models")
          ? [EMBEDDING_MODEL]
          : [CHAT_MODEL],
      }),
    async () => {
      const gateway = createOpenRouterGateway({ apiKey: "test-key" });
      return gateway.catalog();
    }
  );

  assert.deepEqual(catalog.warnings, []);
  assert.equal(catalog.embedding.length, 1);
  assert.equal(catalog.chat.length, 1);
});

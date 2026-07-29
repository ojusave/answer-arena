import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveJudgeModel,
  deriveStarterSetups,
  priceNumber,
  sortByPrice,
} from "../src/client/lib/model-preset.js";
import type { Catalog, CatalogModel } from "../src/client/hooks/types";

function chat(id: string, completion: string): CatalogModel {
  return { id, name: id, pricing: { prompt: "0.000001", completion } };
}

function catalogWith(chats: CatalogModel[]): Catalog {
  return {
    embedding: [
      { id: "cheap/embed", name: "cheap/embed", pricing: { prompt: "0" } },
    ],
    rerank: [],
    chat: chats,
    gateway: { id: "openrouter", label: "OpenRouter" },
    warnings: [],
  } as unknown as Catalog;
}

test("a variable price is not treated as the cheapest price", () => {
  assert.equal(priceNumber("-1"), Number.POSITIVE_INFINITY);
  assert.equal(priceNumber(""), Number.POSITIVE_INFINITY);
  assert.equal(priceNumber("not-a-price"), Number.POSITIVE_INFINITY);
  assert.equal(priceNumber("0"), 0);

  const sorted = sortByPrice(
    [chat("router/auto", "-1"), chat("real/cheap", "0.0000005")],
    "completion"
  );
  assert.equal(sorted[0]!.id, "real/cheap", "a real price sorts ahead of -1");
});

test("starter setups and the judge skip models with no comparable price", () => {
  const catalog = catalogWith([
    chat("router/auto", "-1"),
    chat("real/budget", "0.0000005"),
    chat("real/mid", "0.000002"),
    chat("real/premium", "0.0006"),
  ]);

  const chosen = deriveStarterSetups(catalog).map((s) => s.genModel);
  assert.ok(
    !chosen.includes("router/auto"),
    `router model should not be a starter default, got ${chosen.join(", ")}`
  );
  assert.notEqual(deriveJudgeModel(catalog), "router/auto");
});

test("a catalog with no comparable prices yields no starter setups", () => {
  assert.deepEqual(deriveStarterSetups(catalogWith([chat("router/auto", "-1")])), []);
});

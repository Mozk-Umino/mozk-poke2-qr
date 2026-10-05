import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDeck, CardDatabase, parseDeckQuery } from "../deck-codec.js";

// ページの使い方（ai-prompt.txt・index.html）とスキル（SKILL.md）で、デッキURLの説明がずれていないか
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const BASE = "https://mozk-umino.github.io/mozk-poke2-qr/";
const sources = {
  "ai-prompt.txt": read("../ai-prompt.txt"),
  "SKILL.md": read("../skill/pokepoke-deck-url/SKILL.md"),
  "index.html": read("../index.html"),
};

test("どの説明も同じ公開URLを指している", () => {
  for (const [name, text] of Object.entries(sources)) assert.ok(text.includes(BASE), name);
});

test("プロンプトとスキルの例のデッキURLは、そのまま正しいQRになる", () => {
  const database = new CardDatabase(JSON.parse(read("./cards-fixture.json")));
  for (const name of ["ai-prompt.txt", "SKILL.md"]) {
    const urls = sources[name].match(/https:\/\/mozk-umino\.github\.io\/mozk-poke2-qr\/\?\S+/g) ?? [];
    const examples = urls.filter((url) => url.includes("d=B1a-24x2"));
    assert.ok(examples.length > 0, `${name} に例のURLがない`);
    for (const url of examples) {
      const deck = buildDeck(parseDeckQuery(new URL(url).search), database);
      assert.deepEqual(deck.errors, [], `${name}: ${url}`);
    }
  }
});

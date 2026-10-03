// 日本語名が未登録のカードを一覧にする。GitHub Actions から週1回実行して Issue にする。
//
//   node scripts/check-names.mjs              # 一覧を表示
//   node scripts/check-names.mjs --out a.md   # Issue 本文用の Markdown を書き出す
//
// 未登録の件数を「MISSING=件数」の形で最後に出力する。

import { readFileSync, writeFileSync } from "node:fs";
import { CARD_DATABASE_URL, CardDatabase, cardCode } from "../deck-codec.js";
import { JapaneseNames } from "../ja-names.js";

const root = new URL("../", import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));

const response = await fetch(CARD_DATABASE_URL);
if (!response.ok) throw new Error(`カードDBを取得できません: HTTP ${response.status}`);
const japanese = new JapaneseNames({
  species: readJson("data/species-ja.json"),
  names: readJson("data/names-ja.json"),
});
const database = new CardDatabase(await response.json(), {
  localize: (record) => japanese.name(record),
});

// 英語名ごとにまとめ、例として一番若い収録番号を添える
const missing = new Map();
for (const record of database.records) {
  if (record.ja) continue;
  const key = `${record.type}:${record.name}`;
  const current = missing.get(key);
  if (!current) missing.set(key, { ...record, codes: [cardCode(record)] });
  else current.codes.push(cardCode(record));
}

const groups = [
  ["トレーナーズ", [...missing.values()].filter((card) => card.type === "trainer")],
  ["ポケモン", [...missing.values()].filter((card) => card.type === "pokemon")],
];

const lines = [
  `日本語名が未登録のカードが **${missing.size}種類** あります。ページでは英語名で表示されています。`,
  "",
  "## 直し方",
  "",
  "- `data/names-ja.json` の `trainers`（ポケモンなら `pokemon`）に `\"英語名\": \"日本語名\"` を足す",
  "- または Claude に「mozk-poke2-qr の未登録カードを日本語化して」と頼む。ゲーム内の日本語名をこの Issue にコメントしておくと確実",
  "- 全部登録されると、次のチェックでこの Issue は自動で閉じます",
  "",
];
for (const [title, cards] of groups) {
  if (cards.length === 0) continue;
  lines.push(`## ${title}（${cards.length}）`, "", "| 英語名 | 収録番号の例 |", "|---|---|");
  for (const card of cards.sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(`| ${card.name} | ${card.codes.slice(0, 3).join(", ")} |`);
  }
  lines.push("");
}
const markdown = lines.join("\n");

const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0) writeFileSync(process.argv[outIndex + 1], markdown);
else console.log(markdown);
console.log(`MISSING=${missing.size}`);

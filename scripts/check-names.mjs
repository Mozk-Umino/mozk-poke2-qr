// 日本語名が未登録・推測のカードを一覧にする。GitHub Actions から週1回実行して Issue にする。
//
//   node scripts/check-names.mjs              # 一覧を表示
//   node scripts/check-names.mjs --out a.md   # Issue 本文用の Markdown を書き出す
//
// 未登録と推測の合計件数を「MISSING=件数」の形で最後に出力する。

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
  isGuessed: (record) => japanese.isGuessed(record),
});

// 英語名ごとにまとめ、例として収録番号を添える
function collect(filter) {
  const map = new Map();
  for (const record of database.records.filter(filter)) {
    const key = `${record.type}:${record.name}`;
    const current = map.get(key);
    if (!current) map.set(key, { ...record, codes: [cardCode(record)] });
    else current.codes.push(cardCode(record));
  }
  return [...map.values()].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}
const missing = collect((record) => !record.ja);
const guessed = collect((record) => record.jaGuessed);
const typeLabel = (card) => (card.type === "pokemon" ? "ポケモン" : "トレーナーズ");

const lines = [
  `- 日本語名が**未登録**: ${missing.length}種類（ページでは英語名で表示）`,
  `- 日本語名が**推測**: ${guessed.length}種類（ページでは「推測」と表示）`,
  "",
  "## 直し方",
  "",
  "- 未登録: `data/names-ja.json` の `trainers`（ポケモンなら `pokemon`）に `\"英語名\": \"日本語名\"` を足す。Claude に「mozk-poke2-qr の未登録カードを日本語化して」と頼んでもよい",
  "- 推測: ゲーム内の名前を確かめたら `trainersGuessed` から `trainers` に移す（違っていたら直す）。ゲーム内の名前をこの Issue にコメントして Claude に頼んでもよい",
  "- 未登録・推測がなくなると、次のチェックでこの Issue は自動で閉じます",
  "",
];
if (missing.length > 0) {
  lines.push(`## 未登録（${missing.length}）`, "", "| 種類 | 英語名 | 収録番号の例 |", "|---|---|---|");
  for (const card of missing) lines.push(`| ${typeLabel(card)} | ${card.name} | ${card.codes.slice(0, 3).join(", ")} |`);
  lines.push("");
}
// 推測の一覧は、読みと並べて scripts/check-readings.py が出す
const markdown = lines.join("\n");

const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0) writeFileSync(process.argv[outIndex + 1], markdown);
else console.log(markdown);
console.log(`MISSING=${missing.length + guessed.length}`);

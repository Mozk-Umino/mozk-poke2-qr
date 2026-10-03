import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CardDatabase } from "../deck-codec.js";
import { JapaneseNames } from "../ja-names.js";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const japanese = new JapaneseNames({
  species: readJson("../data/species-ja.json"),
  names: readJson("../data/names-ja.json"),
});

const POKEMON = {
  "Pikachu ex": "ピカチュウex",
  "Toxapex": "ドヒドイデ",
  "Mega Gyarados ex": "メガギャラドスex",
  "Mega Charizard X ex": "メガリザードンXex",
  "AlolanVulpix": "アローラロコン",
  "Alolan Ninetales ex": "アローラキュウコンex",
  "Galarian Meowth": "ガラルニャース",
  "Team Rocket’s Mewtwo": "ロケット団のミュウツー",
  "Team Rocket’s Mr. Mime": "ロケット団のバリヤード",
  "Farfetch’d": "カモネギ",
  "Teal Mask Ogerpon ex": "オーガポン みどりのめんex",
  "Heat Rotom": "ヒートロトム",
};

test("ポケモン名をルールで日本語にできる", () => {
  for (const [english, expected] of Object.entries(POKEMON)) {
    assert.equal(japanese.pokemonName(english), expected, english);
  }
});

test("トレーナーズは対応表から引く（’ と ' は同じ扱い）", () => {
  assert.equal(japanese.trainerName("Professor’s Research"), "博士の研究");
  assert.equal(japanese.trainerName("poké ball"), "モンスターボール");
  assert.equal(japanese.trainerName("存在しないカード"), null);
});

test("日本語名・ひらがなでもカード検索できる", () => {
  const database = new CardDatabase(readJson("./cards-fixture.json"), {
    localize: (record) => japanese.name(record),
  });
  assert.ok(database.search("ピカチュウ").some((card) => card.ja === "ピカチュウex"));
  assert.ok(database.search("じばこいる").some((card) => card.ja === "ジバコイル"));
  assert.ok(database.search("博士の研究").length > 0);
});

test("スキルの lookup.py も同じ日本語名を返す", () => {
  const names = [...Object.keys(POKEMON).map((name) => ["pokemon", name]), ["trainer", "Professor’s Research"]];
  const output = execFileSync("python3", ["skill/pokepoke-deck-url/scripts/lookup.py", "--ja-names"], {
    cwd: new URL("../", import.meta.url),
    input: JSON.stringify(names),
    env: { ...process.env, POKEPOKE_DATA_DIR: "data" },
  });
  const expected = names.map(([type, name]) => japanese.name({ type, name }));
  assert.deepEqual(JSON.parse(output), expected);
});

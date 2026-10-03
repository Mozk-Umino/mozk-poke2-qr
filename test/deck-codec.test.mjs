import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildDeck,
  CardDatabase,
  decodePayload,
  deckFromPayload,
  deckQuery,
  encodePayload,
  parseDeckQuery,
  parseEnergyList,
} from "../deck-codec.js";

const database = new CardDatabase(
  JSON.parse(readFileSync(new URL("./cards-fixture.json", import.meta.url), "utf8")),
);

// tcgp-deck-qr で実機読み込みが確認されたデッキと、そのQRの中身
const SAMPLE_QUERY =
  "?n=ミライドンex&e=雷&d=B1a-24x2.A1-98x2.B1a-26.B3a-19x2.A3a-21x2.PROMO-A-7x2.B3a-73.B1-225.A2-150.B1-226.B1a-68.A1-225.PROMO-A-5x2.A2-147";
const KNOWN_PAYLOAD =
  "C5iWqJiWqJicApiaXpiXwJiaaJiahpiXKpiWnpiWnpiXogkAM+oAM+oAA9QAA9QAM/4AR6QAR6QAHPIAHPIBBA==";

test("デッキURLから実機確認済みのQRの中身が作られる", () => {
  const deck = buildDeck(parseDeckQuery(SAMPLE_QUERY), database);
  assert.deepEqual(deck.errors, []);
  assert.equal(deck.name, "ミライドンex");
  assert.equal(deck.payload, KNOWN_PAYLOAD);
});

test("decode → encode で元に戻る", () => {
  assert.equal(encodePayload(decodePayload(KNOWN_PAYLOAD)), KNOWN_PAYLOAD);
});

test("QRの中身 → デッキURL → QRの中身 で元に戻る", () => {
  const spec = deckFromPayload(KNOWN_PAYLOAD, database);
  assert.deepEqual(spec.errors, []);
  const again = buildDeck(parseDeckQuery(`?${deckQuery(spec)}`), database);
  assert.equal(again.payload, KNOWN_PAYLOAD);
});

test("c= でQRの中身をそのままURLに入れられる", () => {
  const parsed = parseDeckQuery(`?c=${encodeURIComponent(KNOWN_PAYLOAD)}`);
  assert.equal(parsed.payload, KNOWN_PAYLOAD);
});

test("エネルギーはいろいろな書き方を読める", () => {
  assert.deepEqual(parseEnergyList("雷"), [4]);
  assert.deepEqual(parseEnergyList("雷超"), [4, 5]);
  assert.deepEqual(parseEnergyList("雷,超"), [4, 5]);
  assert.deepEqual(parseEnergyList("Lightning,Psychic"), [4, 5]);
  assert.deepEqual(parseEnergyList("雷エネルギー"), [4]);
  assert.throws(() => parseEnergyList("ドラゴン"), /落ちます/);
});

test("カードの書き方は大文字小文字を問わない", () => {
  const deck = buildDeck(parseDeckQuery(SAMPLE_QUERY.replace("PROMO-A-7x2", "promo-a-7X2")), database);
  assert.equal(deck.payload, KNOWN_PAYLOAD);
});

test("20枚でないと止める", () => {
  const deck = buildDeck(parseDeckQuery(SAMPLE_QUERY.replace(".A2-147", "")), database);
  assert.equal(deck.payload, null);
  assert.match(deck.errors.join(), /19枚/);
});

test("同名カード3枚以上は止める", () => {
  const deck = buildDeck(parseDeckQuery(SAMPLE_QUERY.replace("A2-147", "A2b-111")), database);
  assert.match(deck.errors.join(), /Poké Ball.*3枚/);
});

test("存在しない番号・読めない書き方・ドラゴンは止める", () => {
  const deck = buildDeck(parseDeckQuery("?e=ドラゴン&d=A1-9999x2.foo"), database);
  const message = deck.errors.join("\n");
  assert.match(message, /A1-9999/);
  assert.match(message, /foo/);
  assert.match(message, /ドラゴン/);
});

test("QRの中身から戻すときは通常版の番号で表す", () => {
  const spec = deckFromPayload(KNOWN_PAYLOAD, database);
  const query = decodeURIComponent(deckQuery(spec));
  assert.match(query, /PROMO-A-7x2/);
  assert.match(query, /PROMO-A-5x2/);
  assert.doesNotMatch(query, /A4b|A2b/);
});

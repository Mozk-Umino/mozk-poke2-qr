// ポケポケのデッキQRとデッキURLの読み書き。DOMには依存しない。
//
// QRの中身（Base64）の形式は https://github.com/KevinGutowski/tcgp-deck-qr (MIT) の解析結果に準拠:
//   u8  トレーナーズ枚数
//   u24 トレーナーズのID + 10,000,000 （枚数ぶん）
//   u8  ポケモン枚数
//   u24 ポケモンのID （枚数ぶん）
//   u8  エネルギー種類数
//   u8  エネルギー種類 （種類数ぶん）

export const CARD_DATABASE_URL =
  "https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist/cards.min.json";

const TRAINER_ID_OFFSET = 10_000_000;
const MAX_U24 = 0xff_ff_ff;
export const DECK_SIZE = 20;

export const ENERGY_TYPES = [
  { value: 1, en: "Grass", ja: "草" },
  { value: 2, en: "Fire", ja: "炎" },
  { value: 3, en: "Water", ja: "水" },
  { value: 4, en: "Lightning", ja: "雷" },
  { value: 5, en: "Psychic", ja: "超" },
  { value: 6, en: "Fighting", ja: "闘" },
  { value: 7, en: "Darkness", ja: "悪" },
  { value: 8, en: "Metal", ja: "鋼" },
];

// ゲーム内で選べないエネルギー。コードに入れると読み込めてしまうが、
// ドラゴンは対戦開始時にゲームが落ちるため受け付けない。
const UNSELECTABLE_ENERGY = new Map([
  [10, "ドラゴンエネルギーはゲーム内で選べず、対戦開始時にゲームが落ちます"],
  [11, "無色エネルギーはゲーム内で選べません"],
]);

const ENERGY_LOOKUP = new Map();
for (const { value, en, ja } of ENERGY_TYPES) {
  for (const key of [en, ja, `${ja}エネルギー`, String(value)]) {
    ENERGY_LOOKUP.set(key.toLowerCase(), value);
  }
}
for (const [key, value] of [
  ["electric", 4], ["dark", 7], ["steel", 8],
  ["10", 10], ["11", 11], ["dragon", 10], ["ドラゴン", 10], ["竜", 10], ["colorless", 11], ["無色", 11], ["無", 11],
]) {
  ENERGY_LOOKUP.set(key, value);
}

export function energyLabel(value) {
  return (
    ENERGY_TYPES.find((type) => type.value === value)?.ja ??
    { 10: "ドラゴン", 11: "無色" }[value] ??
    `不明(${value})`
  );
}

export function energyValue(input) {
  const value = ENERGY_LOOKUP.get(String(input).trim().toLowerCase());
  if (value == null) {
    throw new Error(
      `エネルギー「${input}」が分かりません（使えるもの: ${ENERGY_TYPES.map((type) => type.ja).join(" ")}）`,
    );
  }
  if (UNSELECTABLE_ENERGY.has(value)) throw new Error(UNSELECTABLE_ENERGY.get(value));
  return value;
}

// 「雷超」「雷,超」「Lightning,Psychic」のどれでも読む
export function parseEnergyList(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return [];
  const tokens = /[,.、\s]/.test(trimmed)
    ? trimmed.split(/[,.、\s]+/)
    : /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+$/u.test(trimmed) &&
        !ENERGY_LOOKUP.has(trimmed)
      ? [...trimmed]
      : [trimmed];
  return tokens.filter(Boolean).map(energyValue);
}

// ---------------------------------------------------------------------------
// Base64 ⇔ ID列

function writeU24(bytes, value) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_U24) {
    throw new RangeError(`ID ${value} は24bitに収まりません`);
  }
  bytes.push((value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

export function encodePayload({ trainerIds, pokemonIds, energyTypes }) {
  const bytes = [trainerIds.length];
  for (const id of trainerIds) writeU24(bytes, id + TRAINER_ID_OFFSET);
  bytes.push(pokemonIds.length);
  for (const id of pokemonIds) writeU24(bytes, id);
  bytes.push(energyTypes.length, ...energyTypes);
  return btoa(String.fromCharCode(...bytes));
}

export function decodePayload(payload) {
  const normalized = String(payload ?? "").trim().replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(padded)) throw new Error("Base64の文字列ではありません");
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  let offset = 0;

  const readByte = () => {
    if (offset >= bytes.length) throw new Error("データが途中で切れています");
    return bytes[offset++];
  };
  const readU24 = () => readByte() * 0x1_00_00 + readByte() * 0x1_00 + readByte();

  const trainerIds = [];
  for (let count = readByte(); count > 0; count -= 1) {
    const id = readU24() - TRAINER_ID_OFFSET;
    if (id < 0) throw new Error("トレーナーズのIDが不正です");
    trainerIds.push(id);
  }
  const pokemonIds = [];
  for (let count = readByte(); count > 0; count -= 1) pokemonIds.push(readU24());
  const energyTypes = [];
  for (let count = readByte(); count > 0; count -= 1) energyTypes.push(readByte());

  if (offset !== bytes.length) throw new Error("データの末尾に余分なバイトがあります");
  return { trainerIds, pokemonIds, energyTypes };
}

// ---------------------------------------------------------------------------
// カードDB（flibustier/pokemon-tcg-pocket-database の cards.json）

export function normalizeName(value) {
  return String(value)
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// 画像ファイル名 cPK_10_018340_00_... の6桁がゲーム内のカードID。
// 同じカードのイラスト違いは同じIDになる。
function parseRecord(record) {
  const match = /^c(PK|TR)_\d+_(\d{6})_/i.exec(record.image ?? "");
  if (!match) return null;
  return {
    ...record,
    type: match[1].toUpperCase() === "PK" ? "pokemon" : "trainer",
    id: Number(match[2]),
  };
}

// 画像ファイル名の2つ目の数字: 10 = 通常版, 90 = プロモ, 20 = イラスト違い
function printRank(record) {
  const kind = /^c(?:PK|TR)_(\d+)_/i.exec(record.image)?.[1];
  return { 10: 0, 90: 1 }[kind] ?? 2;
}

function pushTo(map, key, record) {
  const list = map.get(key);
  if (list) list.push(record);
  else map.set(key, [record]);
}

export function cardCode(card) {
  return `${card.set}-${card.number}`;
}

export class CardDatabase {
  constructor(rawRecords) {
    this.records = rawRecords.map(parseRecord).filter(Boolean);
    this.byId = new Map();
    this.byCode = new Map();
    for (const record of this.records) {
      pushTo(this.byId, `${record.type}:${record.id}`, record);
      this.byCode.set(cardCode(record).toLowerCase(), record);
    }
  }

  // 同じIDの収録のうち、通常版 → プロモ → イラスト違い の順で、その中で一番若いものを代表にする
  describe(id, type) {
    const records = this.byId.get(`${type}:${id}`) ?? [];
    if (records.length === 0) return { id, type, name: `不明なカード(ID ${id})`, unknown: true };
    const [first] = [...records].sort(
      (a, b) =>
        printRank(a) - printRank(b) ||
        String(a.set).localeCompare(String(b.set)) ||
        a.number - b.number,
    );
    return first;
  }

  lookup(set, number) {
    return this.byCode.get(`${set}-${number}`.toLowerCase()) ?? null;
  }

  search(query) {
    const normalized = normalizeName(query);
    if (!normalized) return [];
    const seen = new Set();
    const results = [];
    for (const record of this.records) {
      const key = `${record.type}:${record.id}`;
      if (seen.has(key)) continue;
      const code = cardCode(record).toLowerCase();
      if (normalizeName(record.name).includes(normalized) || code === normalized) {
        seen.add(key);
        results.push(this.describe(record.id, record.type));
      }
    }
    return results;
  }
}

// ---------------------------------------------------------------------------
// デッキURL
//
//   ?n=デッキ名&e=雷&d=B1a-24x2.A1-98x2.PROMO-A-7x2
//
// d はカードを「.」区切りで並べたもの。1枚は「セット-番号」、2枚は末尾に「x2」。

const CARD_TOKEN = /^(.+)-(\d+)(?:[x*×](\d+))?$/i;

export function parseCardList(text) {
  const errors = [];
  const cards = [];
  for (const raw of String(text ?? "").split(/[.\s,、]+/)) {
    const token = raw.trim();
    if (!token) continue;
    const match = CARD_TOKEN.exec(token);
    if (!match) {
      errors.push(`「${token}」はカードの書き方として読めません（例: A1-98x2）`);
      continue;
    }
    cards.push({ set: match[1], number: Number(match[2]), count: match[3] ? Number(match[3]) : 1 });
  }
  return { cards, errors };
}

export function formatCardList(cards) {
  return cards.map((card) => `${cardCode(card)}${card.count > 1 ? `x${card.count}` : ""}`).join(".");
}

export function deckQuery({ name, energyTypes, cards }) {
  const params = new URLSearchParams();
  if (name) params.set("n", name);
  params.set("e", energyTypes.map(energyLabel).join(""));
  params.set("d", formatCardList(cards));
  // 「.」や「-」はエンコード不要なので読みやすいまま残す
  return params.toString();
}

// URLのクエリ → デッキの指定
export function parseDeckQuery(search) {
  const params = new URLSearchParams(search);
  if (params.has("c")) return { payload: params.get("c"), name: params.get("n") ?? "" };
  if (!params.has("d")) return null;
  const { cards, errors } = parseCardList(params.get("d"));
  let energyTypes = [];
  try {
    energyTypes = parseEnergyList(params.get("e"));
  } catch (error) {
    errors.push(error.message);
  }
  return { name: params.get("n") ?? "", energyTypes, cards, errors };
}

// ---------------------------------------------------------------------------
// デッキの組み立てとチェック

export function buildDeck({ name = "", energyTypes = [], cards = [], errors: inputErrors = [] }, database) {
  const errors = [...inputErrors];
  const pokemon = [];
  const trainers = [];

  for (const entry of cards) {
    if (!Number.isInteger(entry.count) || entry.count < 1 || entry.count > 2) {
      errors.push(`${cardCode(entry)} の枚数は1か2にしてください`);
    }
    const record = database.lookup(entry.set, entry.number);
    if (!record) {
      errors.push(`${cardCode(entry)} というカードは見つかりません`);
      continue;
    }
    (record.type === "pokemon" ? pokemon : trainers).push({ ...record, count: entry.count });
  }

  if (energyTypes.length < 1 || energyTypes.length > 3) {
    errors.push(`エネルギーは1〜3種類選んでください（今は${energyTypes.length}種類）`);
  }
  if (new Set(energyTypes).size !== energyTypes.length) errors.push("エネルギーが重複しています");

  const total = cards.reduce((sum, entry) => sum + entry.count, 0);
  if (total !== DECK_SIZE) errors.push(`デッキは${DECK_SIZE}枚ちょうどにしてください（今は${total}枚）`);

  // 同名カードはイラスト違い・効果違いも合わせて2枚まで
  const perName = new Map();
  for (const card of [...pokemon, ...trainers]) {
    const key = normalizeName(card.name);
    perName.set(key, { name: card.name, count: (perName.get(key)?.count ?? 0) + card.count });
  }
  for (const { name: cardName, count } of perName.values()) {
    if (count > 2) errors.push(`「${cardName}」が合計${count}枚あります（同名カードは2枚まで）`);
  }

  const deck = {
    name: name.trim(),
    pokemon,
    trainers,
    energyTypes,
    cards,
    total,
    errors: [...new Set(errors)],
    payload: null,
  };
  if (deck.errors.length === 0) {
    const ids = (list) => list.flatMap(({ id, count }) => Array(count).fill(id));
    deck.payload = encodePayload({
      trainerIds: ids(trainers),
      pokemonIds: ids(pokemon),
      energyTypes,
    });
  }
  return deck;
}

// QRの中身 → デッキの指定（URLにできる形）
export function deckFromPayload(payload, database) {
  const decoded = decodePayload(payload);
  const errors = [];
  const group = (ids, type) => {
    const map = new Map();
    for (const id of ids) {
      const card = database.describe(id, type);
      if (card.unknown) {
        errors.push(`カードDBにないカードがあります（ID ${id}）。DBの更新待ちかもしれません`);
        continue;
      }
      const current = map.get(id) ?? { set: card.set, number: card.number, count: 0 };
      current.count += 1;
      map.set(id, current);
    }
    return [...map.values()];
  };
  const cards = [...group(decoded.pokemonIds, "pokemon"), ...group(decoded.trainerIds, "trainer")];
  const energyTypes = [];
  for (const value of decoded.energyTypes) {
    try {
      energyTypes.push(energyValue(value));
    } catch (error) {
      errors.push(error.message);
    }
  }
  return { name: "", energyTypes, cards, errors };
}

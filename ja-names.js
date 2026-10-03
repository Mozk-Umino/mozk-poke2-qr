// カード名（英語）→ 日本語名。
// ポケモンは種族名の対応表（PokeAPI 由来の data/species-ja.json）と下のルールで変換するので、
// 新弾で新しいポケモンが増えても基本的に手を入れなくてよい。
// トレーナーズと、ルールで変換できないポケモンは data/names-ja.json に書く。

const PREFIXES = [
  [/^team rocket's\s*/, "ロケット団の"],
  [/^mega\s+/, "メガ"],
  [/^alolan\s*/, "アローラ"],
  [/^galarian\s*/, "ガラル"],
  [/^hisuian\s*/, "ヒスイ"],
  [/^paldean\s*/, "パルデア"],
];

export function nameKey(name) {
  return String(name)
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function keyedTable(table = {}) {
  return new Map(Object.entries(table).map(([english, japanese]) => [nameKey(english), japanese]));
}

export class JapaneseNames {
  constructor({ species, names }) {
    this.species = keyedTable(species);
    this.pokemonTable = keyedTable(names.pokemon);
    this.trainerTable = keyedTable(names.trainers);
  }

  trainerName(name) {
    return this.trainerTable.get(nameKey(name)) ?? null;
  }

  pokemonName(name) {
    let rest = nameKey(name);
    let suffix = "";
    if (/ ex$/.test(rest)) {
      rest = rest.slice(0, -3);
      suffix = "ex";
    }
    if (this.pokemonTable.has(rest)) return this.pokemonTable.get(rest) + suffix;

    let prefix = "";
    for (let changed = true; changed; ) {
      changed = false;
      for (const [pattern, japanese] of PREFIXES) {
        if (pattern.test(rest)) {
          rest = rest.replace(pattern, "");
          prefix += japanese;
          changed = true;
        }
      }
    }
    // メガリザードンX など
    const form = / ([xy])$/.exec(rest);
    if (form) {
      rest = rest.slice(0, -2);
      suffix = form[1].toUpperCase() + suffix;
    }
    const base = this.pokemonTable.get(rest) ?? this.species.get(rest);
    return base ? prefix + base + suffix : null;
  }

  name(record) {
    return record.type === "trainer" ? this.trainerName(record.name) : this.pokemonName(record.name);
  }
}

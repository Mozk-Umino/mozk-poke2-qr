#!/usr/bin/env python3
"""ポケポケのカードを日本語名・英語名・セット番号で調べる。

使い方:
  python3 lookup.py ピカチュウ "Professor's Research" B1a-24
  python3 lookup.py --check "B1a-24x2.A1-98x2.PROMO-A-7x2"   # デッキURLの d= をまとめて確認

カードDB: https://github.com/flibustier/pokemon-tcg-pocket-database
日本語名: https://github.com/Mozk-Umino/mozk-poke2-qr の data/（ページと同じ変換ルール）
"""
import json
import os
import re
import sys
import unicodedata
import urllib.request

DB_URL = "https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist/cards.min.json"
DATA_URL = "https://raw.githubusercontent.com/Mozk-Umino/mozk-poke2-qr/main/data/"

PREFIXES = [
    (r"^team rocket's\s*", "ロケット団の"),
    (r"^mega\s+", "メガ"),
    (r"^alolan\s*", "アローラ"),
    (r"^galarian\s*", "ガラル"),
    (r"^hisuian\s*", "ヒスイ"),
    (r"^paldean\s*", "パルデア"),
]


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.load(response)


def load_data(name):
    local = os.environ.get("POKEPOKE_DATA_DIR")
    if local:
        with open(os.path.join(local, name), encoding="utf-8") as f:
            return json.load(f)
    return fetch_json(DATA_URL + name)


def name_key(text):
    text = unicodedata.normalize("NFKC", text).replace("’", "'").replace("‘", "'")
    return re.sub(r"\s+", " ", text).strip().lower()


def search_key(text):
    # ひらがな → カタカナ
    return "".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in name_key(text))


class JapaneseNames:
    def __init__(self):
        names = load_data("names-ja.json")
        self.species = {name_key(k): v for k, v in load_data("species-ja.json").items()}
        self.pokemon = {name_key(k): v for k, v in names["pokemon"].items()}
        self.trainers = {name_key(k): v for k, v in names["trainers"].items()}
        # 公式名を確認できていない推測
        self.guessed = {name_key(k): v for k, v in names.get("trainersGuessed", {}).items()}

    def is_guessed(self, card_type, name):
        key = name_key(name)
        return card_type == "trainer" and key not in self.trainers and key in self.guessed

    def name(self, card_type, name):
        if card_type == "trainer":
            key = name_key(name)
            return self.trainers.get(key) or self.guessed.get(key)
        rest, suffix = name_key(name), ""
        if rest.endswith(" ex"):
            rest, suffix = rest[:-3], "ex"
        if rest in self.pokemon:
            return self.pokemon[rest] + suffix
        prefix, changed = "", True
        while changed:
            changed = False
            for pattern, japanese in PREFIXES:
                if re.match(pattern, rest):
                    rest = re.sub(pattern, "", rest)
                    prefix += japanese
                    changed = True
        form = re.search(r" ([xy])$", rest)
        if form:
            rest, suffix = rest[:-2], form.group(1).upper() + suffix
        base = self.pokemon.get(rest) or self.species.get(rest)
        return prefix + base + suffix if base else None


def load_cards():
    japanese = JapaneseNames()
    cards = []
    for r in fetch_json(DB_URL):
        m = re.match(r"^c(PK|TR)_(\d+)_(\d{6})_", r.get("image", ""))
        if not m:
            continue
        card_type = "pokemon" if m.group(1) == "PK" else "trainer"
        cards.append({
            **r,
            "type": card_type,
            "type_ja": "ポケモン" if card_type == "pokemon" else "トレーナーズ",
            "id": int(m.group(3)),
            # 10 = 通常版, 90 = プロモ, 20 = イラスト違い
            "rank": {"10": 0, "90": 1}.get(m.group(2), 2),
            "code": f"{r['set']}-{r['number']}",
            "ja": japanese.name(card_type, r["name"]),
            "guessed": japanese.is_guessed(card_type, r["name"]),
        })
    return cards


def label(card):
    if not card["ja"]:
        return f"{card['name']}（日本語名未登録）"
    if card["guessed"]:
        return f"{card['ja']}（{card['name']}・日本語名は推測）"
    return f"{card['ja']}（{card['name']}）"


def representative(cards, card):
    same = [c for c in cards if c["id"] == card["id"] and c["type"] == card["type"]]
    return sorted(same, key=lambda c: (c["rank"], c["set"], c["number"]))[0]


def search(cards, query):
    q = search_key(query)
    by_code = [c for c in cards if c["code"].lower() == q]
    hits = by_code or [
        c for c in cards if q in search_key(c["name"]) or (c["ja"] and q in search_key(c["ja"]))
    ]
    seen, out = set(), []
    for c in hits:
        key = (c["type"], c["id"])
        if key in seen:
            continue
        seen.add(key)
        out.append(c if by_code else representative(cards, c))
    return out


def check(cards, deck):
    by_code = {c["code"].lower(): c for c in cards}
    total, names = 0, {}
    for token in filter(None, re.split(r"[.\s]+", deck)):
        m = re.match(r"^(.+)-(\d+)(?:[x×*](\d+))?$", token, re.I)
        if not m:
            print(f"NG  {token}: 書き方が読めない")
            continue
        count = int(m.group(3) or 1)
        card = by_code.get(f"{m.group(1)}-{m.group(2)}".lower())
        if not card:
            print(f"NG  {token}: そのセット番号のカードはない")
            continue
        total += count
        key = name_key(card["name"])
        names[key] = (names.get(key, (0, ""))[0] + count, label(card))
        print(f"OK  {token:14} {card['type_ja']:6} {label(card)}")
    print(f"合計 {total} 枚" + ("" if total == 20 else "  ← 20枚ではない"))
    for count, shown in names.values():
        if count > 2:
            print(f"NG  同名カード {shown} が {count} 枚")


def main(args):
    if args and args[0] == "--ja-names":
        # テスト用: 標準入力の [[種類, 英語名], ...] を日本語名の配列にして返す
        japanese = JapaneseNames()
        print(json.dumps([japanese.name(t, n) for t, n in json.load(sys.stdin)], ensure_ascii=False))
        return
    cards = load_cards()
    if args and args[0] == "--check":
        check(cards, " ".join(args[1:]))
        return
    for query in args:
        results = search(cards, query)
        print(f"# {query}")
        if not results:
            print("  見つからない")
        for c in results[:15]:
            print(f"  {c['code']:12} {c['type_ja']:6} {label(c)}  (rarity {c['rarity']})")


if __name__ == "__main__":
    main(sys.argv[1:])

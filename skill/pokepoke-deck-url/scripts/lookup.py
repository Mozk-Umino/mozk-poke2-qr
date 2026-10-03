#!/usr/bin/env python3
"""ポケポケのカードを英語名かセット番号で調べる。

使い方:
  python3 lookup.py "Pikachu ex" "Professor's Research" B1a-24
  python3 lookup.py --check "B1a-24x2.A1-98x2.PROMO-A-7x2"   # デッキURLの d= をまとめて確認

カードDB: https://github.com/flibustier/pokemon-tcg-pocket-database
"""
import json
import re
import sys
import unicodedata
import urllib.request

DB_URL = "https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist/cards.min.json"


def norm(text):
    text = unicodedata.normalize("NFKC", text).replace("’", "'").replace("‘", "'")
    return re.sub(r"\s+", " ", text).strip().lower()


def load():
    with urllib.request.urlopen(DB_URL, timeout=30) as response:
        records = json.load(response)
    cards = []
    for r in records:
        m = re.match(r"^c(PK|TR)_(\d+)_(\d{6})_", r.get("image", ""))
        if not m:
            continue
        cards.append({
            **r,
            "type": "ポケモン" if m.group(1) == "PK" else "トレーナーズ",
            "id": int(m.group(3)),
            # 10 = 通常版, 90 = プロモ, 20 = イラスト違い
            "rank": {"10": 0, "90": 1}.get(m.group(2), 2),
            "code": f"{r['set']}-{r['number']}",
        })
    return cards


def representative(cards, card):
    same = [c for c in cards if c["id"] == card["id"] and c["type"] == card["type"]]
    return sorted(same, key=lambda c: (c["rank"], c["set"], c["number"]))[0]


def search(cards, query):
    q = norm(query)
    by_code = [c for c in cards if c["code"].lower() == q]
    hits = by_code or [c for c in cards if q in norm(c["name"])]
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
        names[norm(card["name"])] = names.get(norm(card["name"]), 0) + count
        print(f"OK  {token:14} {card['type']:6} {card['name']}")
    print(f"合計 {total} 枚" + ("" if total == 20 else "  ← 20枚ではない"))
    for name, count in names.items():
        if count > 2:
            print(f"NG  同名カード {name} が {count} 枚")


def main(args):
    cards = load()
    if args and args[0] == "--check":
        check(cards, " ".join(args[1:]))
        return
    for query in args:
        results = search(cards, query)
        print(f"# {query}")
        if not results:
            print("  見つからない")
        for c in results[:15]:
            print(f"  {c['code']:12} {c['type']:6} {c['name']}  (rarity {c['rarity']})")


if __name__ == "__main__":
    main(sys.argv[1:])

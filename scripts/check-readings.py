#!/usr/bin/env python3
"""トレーナーズの日本語名を、カード画像のファイル名にある読み（ローマ字）と照らし合わせる。

カードDBの画像ファイル名（例: cTR_90_000040_00_HAKASENOKENKYU_C.webp）には、公式の日本語名の
読みがローマ字で入っている。登録した日本語名をローマ字にして比べ、食い違うものを一覧にする。
分かるのは読みだけで、漢字・ひらがな・カタカナの表記までは確かめられない。

  pip install pykakasi
  python3 scripts/check-readings.py              # 一覧を表示
  python3 scripts/check-readings.py --out a.md   # Issue 本文用の Markdown を書き出す

最後に「MISMATCH=件数」（推測以外で読みが食い違う件数）を出力する。
"""
import difflib
import json
import os
import re
import sys
import urllib.request

import pykakasi

DB_URL = "https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist/cards.min.json"
ROOT = os.path.join(os.path.dirname(__file__), "..")
THRESHOLD = 0.8

kakasi = pykakasi.kakasi()


def key(name):
    return name.replace("’", "'").replace("‘", "'").strip().lower()


def romaji(text):
    return "".join(part["hepburn"] for part in kakasi.convert(text)).upper()


def loose(text):
    """長音・ヘボン式の揺れを吸収して比べやすくする"""
    text = re.sub(r"[^A-Z]", "", text.upper())
    for a, b in [("OU", "O"), ("UU", "U"), ("OO", "O"), ("SHI", "SI"), ("CHI", "TI"), ("TSU", "TU"),
                 ("JYO", "JO"), ("JYU", "JU"), ("SYA", "SHA"), ("TYO", "CHO"), ("Y", ""), ("H", "")]:
        text = text.replace(a, b)
    return text


def similarity(japanese, reading):
    return difflib.SequenceMatcher(None, loose(romaji(japanese)), loose(reading)).ratio()


def main(args):
    with open(os.path.join(ROOT, "data", "names-ja.json"), encoding="utf-8") as f:
        names = json.load(f)
    confirmed = {key(k): v for k, v in names["trainers"].items()}
    guessed = {key(k): v for k, v in names.get("trainersGuessed", {}).items()}
    skip = {key(k) for k in names.get("readingCheckSkip", [])}

    with urllib.request.urlopen(DB_URL, timeout=60) as response:
        records = json.load(response)

    # 英語名ごとに、ファイル名の読みと収録番号を集める
    cards = {}
    for record in records:
        m = re.match(r"^cTR_\d+_\d{6}_\d+_(.+?)_[A-Z]+\.webp$", record.get("image", ""))
        if not m:
            continue
        card = cards.setdefault(record["name"], {"reading": m.group(1), "codes": []})
        card["codes"].append(f"{record['set']}-{record['number']}")

    guess_rows, mismatch_rows = [], []
    for name, card in sorted(cards.items()):
        k = key(name)
        codes = ", ".join(card["codes"][:3])
        if k in guessed and k not in confirmed:
            score = similarity(guessed[k], card["reading"])
            mark = "" if score >= THRESHOLD else "⚠️"
            guess_rows.append(f"| {name} | {guessed[k]} | {card['reading']} {mark} | {codes} |")
        elif k in confirmed and k not in skip:
            score = similarity(confirmed[k], card["reading"])
            if score < THRESHOLD:
                mismatch_rows.append(f"| {name} | {confirmed[k]} | {card['reading']} | {codes} |")

    lines = [
        "## 読みの照合",
        "",
        "カード画像のファイル名には公式の日本語名の読み（ローマ字）が入っている。登録した日本語名の読みと比べた結果。",
        "分かるのは読みだけで、表記（漢字・かな）は確かめられない。カタカナ名は英語つづりで入っていることも多い。",
        "",
    ]
    if mismatch_rows:
        lines += [
            f"### 確認済みなのに読みが食い違う（{len(mismatch_rows)}）",
            "",
            "間違いなら `trainers` を直す。正しい（英語つづりの読みなど）なら `readingCheckSkip` に英語名を足す。",
            "",
            "| 英語名 | 登録した日本語名 | ファイル名の読み | 収録番号の例 |",
            "|---|---|---|---|",
            *mismatch_rows,
            "",
        ]
    if guess_rows:
        lines += [
            f"### 推測の名前と読み（{len(guess_rows)}）",
            "",
            "⚠️ は読みが食い違うもの。ゲーム内やカード一覧サイトで確かめて `trainers` に移す。",
            "",
            "| 英語名 | 推測した日本語名 | ファイル名の読み | 収録番号の例 |",
            "|---|---|---|---|",
            *guess_rows,
            "",
        ]
    markdown = "\n".join(lines)

    if "--out" in args:
        with open(args[args.index("--out") + 1], "w", encoding="utf-8") as f:
            f.write(markdown)
    else:
        print(markdown)
    print(f"MISMATCH={len(mismatch_rows)}")


if __name__ == "__main__":
    main(sys.argv[1:])

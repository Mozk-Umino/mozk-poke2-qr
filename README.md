# ポケポケ デッキQR

ポケポケ（Pokémon TCG Pocket）のデッキを **URL** で表し、開くとゲームで読み込めるQRコードを出すツール。

**ページ**: https://mozk-umino.github.io/mozk-poke2-qr/

## 使い方の流れ

1. **Claudeと相談してデッキを作る**: スキル `pokepoke-deck-url` を入れておくと、Claudeが最後にデッキURLを出す
2. **URLを開く**: QRコードとデッキ一覧が出る
3. **ゲームで読む**: 「マイデッキ」→「新規作成」→「コードを読み取る」
   - スマホだけ: 「QR画像を保存」→ 保存した画像から読み取る
   - PCがある: PCに出したQRをスマホのカメラで読む

ブログ・SNS用に、まとめ画像（デッキ名・一覧・QR）の保存と、Markdown / HTML のコピーもできる。

## デッキURLの形式

```
https://mozk-umino.github.io/mozk-poke2-qr/?n=ミライドンex&e=雷&d=B1a-24x2.A1-98x2.B1a-26.B3a-19x2.A3a-21x2.PROMO-A-7x2.B3a-73.B1-225.A2-150.B1-226.B1a-68.A1-225.PROMO-A-5x2.A2-147
```

| パラメータ | 中身 |
|---|---|
| `n` | デッキ名（省略可） |
| `e` | エネルギー。漢字1文字を続けて書く（草 炎 水 雷 超 闘 悪 鋼、1〜3種類） |
| `d` | カードを `.` でつなぐ。`セット-番号`、2枚なら末尾に `x2` |
| `c` | `d`・`e` の代わりに、ゲームのQRの中身（Base64）をそのまま入れてもよい |

## 初期設定

### GitHub Pages
リポジトリの Settings → Pages → Build and deployment で、Source を「Deploy from a branch」、Branch を `main` / `/ (root)` にして保存。数分で上のURLが開けるようになる。

### Claude のスキル
`skill/pokepoke-deck-url.zip` を claude.ai の 設定 → Capabilities（機能）→ Skills からアップロードする。
スキルの中身は `skill/pokepoke-deck-url/`。中身を変えたら `npm run build:skill` でzipを作り直してアップロードし直す。

## 日本語名

カードDBは英語名なので、ページを開いたときに日本語名へ変換している。

- **ポケモン**: `data/species-ja.json`（[PokeAPI](https://github.com/PokeAPI/pokeapi) のポケモン名）と、`ja-names.js` のルール（ex・メガ・アローラ等・ロケット団の）で自動変換。新弾で新しいポケモンが出ても基本的に手入れ不要。ルールで変換できないもの（フォルム違いなど）だけ `data/names-ja.json` の `pokemon` に書く
- **トレーナーズ**: `data/names-ja.json` の `trainers` に1枚ずつ書く。新弾のたびに追加が必要
- 未登録のカードは英語名で表示される（壊れはしない）

### 自動チェック
`.github/workflows/check-names.yml` が毎週月曜に未登録カードを調べ、あれば Issue「日本語名が未登録のカードがあります」を作る（または更新する）。全部登録されると Issue は自動で閉じる。Actions タブから手動実行もできる。

追加するときは `data/names-ja.json` に `"英語名": "日本語名"` を足す。Claude に「mozk-poke2-qr の未登録カードを日本語化して」と頼んでもよい。

## しくみ

QRの中身はBase64文字列で、デコードするとこうなる（数値はビッグエンディアン）。

```text
u8  トレーナーズ枚数
u24 トレーナーズのID + 10,000,000 （枚数ぶん）
u8  ポケモン枚数
u24 ポケモンのID （枚数ぶん）
u8  エネルギー種類数
u8  エネルギー種類 （1草 2炎 3水 4雷 5超 6闘 7悪 8鋼）
```

- IDはカードの種類ごとの番号で、イラスト違いは同じID（読み込んだ側の手持ちのイラストになる）
- QRはバージョン9・誤り訂正H（ゲームが表示するものと同じ）
- セット番号とIDの対応は [flibustier/pokemon-tcg-pocket-database](https://github.com/flibustier/pokemon-tcg-pocket-database) の `cards.min.json` をページを開いたときに取得する。新弾はDB側の更新で使えるようになる
- 形式の解析は [KevinGutowski/tcgp-deck-qr](https://github.com/KevinGutowski/tcgp-deck-qr)（MIT）による。テストで、同プロジェクトで実機読み込みが確認されたデッキと同じコードが出ることを確かめている

## ファイル

| パス | 中身 |
|---|---|
| `index.html` / `style.css` / `app.js` | ページ |
| `deck-codec.js` | QRの中身・デッキURLの読み書きとデッキのチェック（DOM非依存） |
| `ja-names.js` / `data/` | 日本語名の変換 |
| `scripts/check-names.mjs` | 日本語名が未登録のカードの一覧を出す |
| `vendor/qrcode.js` | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)（MIT） |
| `skill/` | Claude 用スキル |
| `test/` | `npm test` で実行 |

非公式のファンツール。任天堂・クリーチャーズ・ゲームフリーク・株式会社ポケモンとは関係ない。

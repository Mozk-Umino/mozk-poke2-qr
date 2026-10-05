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
スキルの中身は `skill/pokepoke-deck-url/`。

- 日本語名の対応表（`data/`）と `scripts/lookup.py` は、スキルが実行時にこのリポジトリから最新版を取るので、**変えてもアップロードし直さなくてよい**
- `SKILL.md`（URLの形式・デッキのルール・出力の型など）を変えたときだけ、次の2つをやる
  1. `npm run build:skill` でzipを作り直し、claude.ai にアップロードし直す
  2. `npm run sync:skill` で MozkSkills（`~/.claude/skills/pokepoke-deck-url`）のコピーを更新し、MozkSkills 側で commit / push する
- 本体はこのリポジトリの `skill/`。MozkSkills と claude.ai にあるのはコピーなので、直すのは必ずこちら

### 使い方欄とAI用プロンプト
ページ上部の「使い方」に、ページでの作り方・AI用プロンプトのコピー・デッキURLの書き方を置いている（デッキURLから開いたときは畳む）。

**デッキURLの形式やデッキのルールを変えるときは、次の3つを同時に直す。**
`test/guide.test.mjs` が、3つが同じ公開URLを指していることと、例のURLが正しいデッキになることを確かめる。

- `skill/pokepoke-deck-url/SKILL.md`（Claude のスキル）
- `ai-prompt.txt`（ほかの人が ChatGPT などに貼るプロンプト。ページの「プロンプトをコピー」で配る）
- `index.html` の「使い方」欄

## 日本語名

カードDBは英語名なので、ページを開いたときに日本語名へ変換している。

- **ポケモン**: `data/species-ja.json`（[PokeAPI](https://github.com/PokeAPI/pokeapi) のポケモン名）と、`ja-names.js` のルール（ex・メガ・アローラ等・ロケット団の）で自動変換。新弾で新しいポケモンが出ても基本的に手入れ不要。ルールで変換できないもの（フォルム違いなど）だけ `data/names-ja.json` の `pokemon` に書く
- **トレーナーズ**: `data/names-ja.json` の `trainers` に1枚ずつ書く。新弾のたびに追加が必要
- **推測**: 公式名を確認できていないトレーナーズは `trainersGuessed` に入れてある。ページでは「推測」と表示し、フッターとHTMLコピーに注意書きを出す。ゲーム内の名前を確かめたら `trainers` に移す
- 未登録のカードは英語名で表示される（壊れはしない）

### 自動チェック
`.github/workflows/check-names.yml` が毎週月曜に次を調べ、あれば Issue「日本語名の未登録・推測カード」を作る（または更新する）。すべてなくなると Issue は自動で閉じる。Actions タブから手動実行もできる。

- 未登録のカード（`scripts/check-names.mjs`）
- 推測のカードと、その読み（`scripts/check-readings.py`）
- 確認済みなのに読みが食い違うカード（同上）

**読みの照合**: カードDBの画像ファイル名（例: `cTR_90_000040_00_HAKASENOKENKYU_C.webp`）には公式の日本語名の読みがローマ字で入っている。登録した日本語名をローマ字にして比べる。分かるのは読みだけで、表記（漢字・かな）は確かめられない。カタカナ名は英語つづり（`GAMECENTER` など）で入っていることも多いので、正しいと確認したものは `readingCheckSkip` に入れて報告から外す。

### 正確な表記の確認（新弾のたび）
クラウド環境からはカード一覧サイトに接続できないので、ローカルの Claude Code で行う。
「mozk-poke2-qr の docs/verify-names.md に従って日本語名を確かめて」と頼めば、手順どおり一覧サイトで確認し、`data/names-ja.json` を直す。

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
| `scripts/check-readings.py` | 日本語名とカード画像のファイル名の読みを照合する |
| `docs/verify-names.md` | 日本語名をカード一覧サイトで確かめる手順（ローカルの Claude Code 用） |
| `vendor/qrcode.js` | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)（MIT） |
| `skill/` | Claude 用スキル |
| `ai-prompt.txt` | ほかの人がAIに貼る用のプロンプト |
| `test/` | `npm test` で実行 |

## ライセンス表記・商標

利用しているソフトウェア・データのライセンスは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) にまとめている。依存を増やしたら、ここに著作権表示とライセンス全文を足す。

- QRコードは株式会社デンソーウェーブの登録商標です。「QRコード」という語を使う画面には、この表記を入れる（ページはフッターに入れてある。ブログ用の出力は「コード」と書いて、この語を使わない）
- ポケモン・Pokémon・ポケットモンスターは任天堂・クリーチャーズ・ゲームフリークの登録商標です。

非公式のファンツール。任天堂・クリーチャーズ・ゲームフリーク・株式会社ポケモンとは関係ない。

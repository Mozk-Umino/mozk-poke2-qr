# 日本語名をカード一覧サイトで確かめる手順

トレーナーズの日本語名（`data/names-ja.json`）を、日本語のカード一覧サイトで一括確認する手順。
**新弾が出たとき**と、Issue「日本語名の未登録・推測カード」に推測・未登録が残っているときに、
ローカルの Claude Code に「mozk-poke2-qr の docs/verify-names.md に従って日本語名を確かめて」と頼む。

クラウド環境（claude.ai/code）は一覧サイトに接続できないので、ローカルで行う。

## 前提

- `data/names-ja.json` の構造
  - `trainers`: 確認済みの日本語名（英語名 → 日本語名）
  - `trainersGuessed`: 推測。ページで「推測」と表示される
  - `pokemon`: ルールで変換できないポケモンだけ（通常は触らない）
  - `readingCheckSkip`: 読みの照合で食い違って見えるが正しいもの
- 英語名とセット番号の対応はカードDB（`https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist/cards.min.json`）
- カード画像のファイル名に公式の日本語名の**読み**がローマ字で入っている（`python3 scripts/check-readings.py` で一覧が出る）。表記を決める手がかりに使う

## 手順

1. `git pull` してから、確認する対象を出す
   - `python3 scripts/check-readings.py`（要 `pip install pykakasi`）で、推測の一覧と読みを出す
   - `node scripts/check-names.mjs` で未登録の一覧を出す
2. 日本語のカード一覧サイトで、対象カードの正式な日本語名を調べる
   - 例: ゲームエイト・ゲームウィズのポケポケ カード一覧、Pokémon GO Hub のポケポケDB（日本語）
   - **セット番号（例: B4-154）で照合する**。英語名からの推測で当てない
   - サイトの利用規約を守る。ページを人が見る程度の取得にとどめ、短時間に大量のアクセスをしない
   - 2つのサイトで一致したもの、またはサイトの表記がファイル名の読みと一致したものだけを「確認済み」とする
3. `data/names-ja.json` を直す
   - 確認できたもの: `trainersGuessed` から消して `trainers` に入れる（表記はサイトのとおり。全角・半角、スペースも合わせる）
   - 確認済みなのに読みの照合で食い違って見えるもの（英語つづりの読みなど）: `readingCheckSkip` に英語名を足す
   - 確認できなかったもの: `trainersGuessed` に残す（読みを手がかりに推測を直すのはよい）
4. 確かめる
   - `npm test`
   - `python3 scripts/check-readings.py` で「確認済みなのに読みが食い違う」が0件、または残りが説明できること
5. コミットして push する（公開リポジトリなので、push の前に差分をユーザーに見せて確認を取る）
   - push すると GitHub Actions が Issue を更新する。推測・未登録がなくなれば Issue は自動で閉じる

## 報告すること

- 確認済みにしたカード（英語名 → 日本語名、確認に使ったサイト）
- 推測のまま残したカードと理由
- サイト同士やファイル名の読みと食い違っていたもの

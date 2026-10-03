#!/bin/sh
# スキルのコピーを更新する。SKILL.md を変えたときに実行する。
#   npm run sync:skill                      # ~/.claude/skills/pokepoke-deck-url（MozkSkills）へ
#   npm run sync:skill -- <コピー先フォルダ>
# コピー後、MozkSkills 側で差分を確認して commit / push する。
set -eu
cd "$(dirname "$0")/.."
target="${1:-$HOME/.claude/skills/pokepoke-deck-url}"
mkdir -p "$(dirname "$target")"
rm -rf "$target"
cp -R skill/pokepoke-deck-url "$target"
find "$target" -name __pycache__ -type d -prune -exec rm -rf {} +
echo "コピーしました: $target"
[ -d "$(dirname "$(dirname "$target")")/.git" ] && git -C "$(dirname "$(dirname "$target")")" status --short -- "skills/$(basename "$target")" || true

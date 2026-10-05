import {
  buildDeck,
  CARD_DATABASE_URL,
  CardDatabase,
  cardCode,
  deckFromPayload,
  deckQuery,
  DECK_SIZE,
  displayName,
  ENERGY_TYPES,
  energyLabel,
  parseCardList,
  parseDeckQuery,
} from "./deck-codec.js";
import { JapaneseNames } from "./ja-names.js";

const $ = (id) => document.getElementById(id);
const FONT = '"Hiragino Sans", "Noto Sans JP", system-ui, sans-serif';

// ブログ・SNS用の出力（まとめ画像・Markdown・HTML）に入れる作成者クレジット
const CREDIT = "作成: Mozk";
const NAME_NOTE = "カード名の日本語表記は非公式のもので、一部推測を含みます。正確な名前はゲーム内でご確認ください。";

let database = null;
let selectedEnergy = [];
let currentDeck = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function showErrors(element, errors) {
  element.classList.toggle("hidden", errors.length === 0);
  element.innerHTML = errors.length
    ? `<ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`
    : "";
}

function fileSafe(name) {
  return (name || "deck").replace(/[\\/:*?"<>|\s]+/g, "_");
}

function deckUrl(deck) {
  return `${location.origin}${location.pathname}?${deckQuery(deck)}`;
}

// ---------------------------------------------------------------------------
// 編集欄 ⇔ デッキの指定

function readEditor() {
  // 1行1枚。「#」以降はメモとして無視し、「B1a-24 x2」のような空白も許す
  const lines = $("edit-cards").value
    .split("\n")
    .map((line) => line.replace(/#.*/, "").replace(/\s+/g, ""))
    .filter(Boolean);
  const { cards, errors } = parseCardList(lines.join("."));
  return { name: $("edit-name").value, energyTypes: [...selectedEnergy], cards, errors };
}

function writeEditor({ name, energyTypes, cards }) {
  $("edit-name").value = name ?? "";
  selectedEnergy = [...energyTypes];
  renderEnergyPicker();
  $("edit-cards").value = cards
    .map((card) => {
      const record = database?.lookup(card.set, card.number);
      const line = `${cardCode(card)}${card.count > 1 ? `x${card.count}` : ""}`;
      return record ? `${line.padEnd(12)} # ${displayName(record)}` : line;
    })
    .join("\n");
}

function renderEnergyPicker() {
  $("edit-energy").innerHTML = ENERGY_TYPES.map(
    ({ value, ja }) =>
      `<button type="button" data-energy="${value}" aria-pressed="${selectedEnergy.includes(value)}">${ja}</button>`,
  ).join("");
}

// ---------------------------------------------------------------------------
// QR と画像

function qrMatrix(payload) {
  // 実際のゲームのコードと同じ バージョン9・誤り訂正H
  const qr = window.qrcode(9, "H");
  qr.addData(payload, "Byte");
  qr.make();
  return qr;
}

function qrSvg(payload, margin = 4) {
  const qr = qrMatrix(payload);
  const size = qr.getModuleCount();
  const side = size + margin * 2;
  let path = "";
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (qr.isDark(row, col)) path += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges" role="img" aria-label="デッキのQRコード"><path fill="#fff" d="M0 0h${side}v${side}H0z"/><path fill="#000" d="${path}"/></svg>`;
}

function drawQr(context, payload, x, y, size) {
  const qr = qrMatrix(payload);
  const count = qr.getModuleCount();
  const margin = 4;
  const cell = Math.floor(size / (count + margin * 2));
  const offset = Math.floor((size - cell * count) / 2);
  context.fillStyle = "#fff";
  context.fillRect(x, y, size, size);
  context.fillStyle = "#000";
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) context.fillRect(x + offset + col * cell, y + offset + row * cell, cell, cell);
    }
  }
}

function qrCanvas(payload) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 720;
  drawQr(canvas.getContext("2d"), payload, 0, 0, 720);
  return canvas;
}

function fitText(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && context.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

// ブログ・SNS用: デッキ名 + カード一覧 + QR を1枚に
function deckCardCanvas(deck) {
  const width = 1200;
  const pad = 56;
  const qrSize = 440;
  const rowHeight = 36;
  const listWidth = width - pad * 2 - qrSize - 48;
  const groups = [
    [`ポケモン ${countOf(deck.pokemon)}枚`, deck.pokemon],
    [`トレーナーズ ${countOf(deck.trainers)}枚`, deck.trainers],
  ];
  const listHeight = groups.reduce((sum, [, cards]) => sum + 52 + cards.length * rowHeight, 0);
  const top = 170;
  const height = top + Math.max(qrSize + 50, listHeight) + 90;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#1d2130";
  context.font = `bold 48px ${FONT}`;
  context.textBaseline = "alphabetic";
  context.fillText(fitText(context, deck.name || "ポケポケ デッキ", width - pad * 2), pad, 96);
  context.fillStyle = "#646b80";
  context.font = `28px ${FONT}`;
  context.fillText(`エネルギー: ${deck.energyTypes.map(energyLabel).join("・")}　${deck.total}枚`, pad, 142);

  let y = top;
  for (const [title, cards] of groups) {
    context.fillStyle = "#646b80";
    context.font = `bold 24px ${FONT}`;
    context.fillText(title, pad, y + 30);
    y += 52;
    for (const card of cards) {
      context.fillStyle = "#1d2130";
      context.font = `bold 26px ${FONT}`;
      context.fillText(`${card.count}`, pad + 4, y + 26);
      context.font = `26px ${FONT}`;
      context.fillText(fitText(context, displayName(card), listWidth - 170), pad + 40, y + 26);
      context.fillStyle = "#8a90a3";
      context.font = `20px ${FONT}`;
      context.textAlign = "right";
      context.fillText(cardCode(card), pad + listWidth, y + 26);
      context.textAlign = "left";
      context.fillStyle = "#e6e9f1";
      context.fillRect(pad, y + rowHeight - 2, listWidth, 1);
      y += rowHeight;
    }
  }

  const qrX = width - pad - qrSize;
  drawQr(context, deck.payload, qrX, top, qrSize);
  context.fillStyle = "#646b80";
  context.font = `22px ${FONT}`;
  context.textAlign = "center";
  context.fillText("ポケポケ「コードを読み取る」で読み込めます", qrX + qrSize / 2, top + qrSize + 36);
  context.textAlign = "left";

  context.fillStyle = "#a0a6b8";
  context.font = `18px ${FONT}`;
  context.fillText(`${location.host}${location.pathname}`, pad, height - 36);
  context.textAlign = "right";
  context.fillText(CREDIT, width - pad, height - 36);
  context.textAlign = "left";
  return canvas;
}

async function saveCanvas(canvas, filename) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const file = new File([blob], filename, { type: "image/png" });
  // スマホは共有シートから「画像を保存」で写真に入れられる
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  const link = document.createElement("a");
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  const label = button.textContent;
  button.textContent = "コピーしました";
  setTimeout(() => (button.textContent = label), 1500);
}

// ---------------------------------------------------------------------------
// ブログ用テキスト

function countOf(cards) {
  return cards.reduce((sum, card) => sum + card.count, 0);
}

function deckMarkdown(deck) {
  const lines = (cards) => cards.map((card) => `- ${displayName(card)} ×${card.count}（${cardCode(card)}）`);
  return [
    `## ${deck.name || "デッキ"}`,
    "",
    `エネルギー: ${deck.energyTypes.map(energyLabel).join("・")}`,
    "",
    `**ポケモン（${countOf(deck.pokemon)}枚）**`,
    "",
    ...lines(deck.pokemon),
    "",
    `**トレーナーズ（${countOf(deck.trainers)}枚）**`,
    "",
    ...lines(deck.trainers),
    "",
    `[デッキのQRコードを表示](${deckUrl(deck)})`,
    "",
    CREDIT,
    "",
  ].join("\n");
}

function deckHtml(deck) {
  const items = (cards) =>
    cards.map((card) => `    <li>${escapeHtml(displayName(card))} ×${card.count}（${cardCode(card)}）</li>`).join("\n");
  return [
    `<div class="pokepoke-deck">`,
    `  <h3>${escapeHtml(deck.name || "デッキ")}</h3>`,
    `  <p>エネルギー: ${deck.energyTypes.map(energyLabel).join("・")}</p>`,
    `  <p><strong>ポケモン（${countOf(deck.pokemon)}枚）</strong></p>`,
    `  <ul>\n${items(deck.pokemon)}\n  </ul>`,
    `  <p><strong>トレーナーズ（${countOf(deck.trainers)}枚）</strong></p>`,
    `  <ul>\n${items(deck.trainers)}\n  </ul>`,
    `  <p><a href="${escapeHtml(deckUrl(deck))}">デッキのQRコードを表示</a></p>`,
    `  <p><small>${NAME_NOTE}</small></p>`,
    `  <p><small>${CREDIT}</small></p>`,
    `</div>`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// 表示

// 日本語名があれば日本語名 + 小さく英語名。推測の日本語名には印を付ける
function nameCell(card) {
  if (!card.ja) return escapeHtml(card.name);
  const guessed = card.jaGuessed ? ' <span class="guess" title="日本語名は推測です">推測</span>' : "";
  return `${escapeHtml(card.ja)}${guessed} <span class="en">${escapeHtml(card.name)}</span>`;
}

function cardTable(title, cards) {
  if (cards.length === 0) return "";
  return `<div class="group-title">${title} ${countOf(cards)}枚</div>
    <table><tbody>${cards
      .map(
        (card) => `<tr><td class="num">${card.count}</td><td>${nameCell(card)}</td><td class="code">${escapeHtml(cardCode(card))}</td></tr>`,
      )
      .join("")}</tbody></table>`;
}

function render(spec) {
  const deck = buildDeck(spec, database);
  currentDeck = deck;
  const hasContent = spec.cards.length > 0 || spec.errors.length > 0;
  $("deck-section").classList.toggle("hidden", !hasContent);
  if (!hasContent) return;

  $("deck-name").textContent = deck.name || "名前なしデッキ";
  $("deck-summary").innerHTML = `<span class="${deck.total === DECK_SIZE ? "ok" : ""}">${deck.total}/${DECK_SIZE}枚</span>
    <span>エネルギー: ${escapeHtml(deck.energyTypes.map(energyLabel).join("・") || "未選択")}</span>`;
  showErrors($("deck-errors"), deck.errors);
  $("deck-list").innerHTML = cardTable("ポケモン", deck.pokemon) + cardTable("トレーナーズ", deck.trainers);

  const ready = Boolean(deck.payload);
  $("qr-area").classList.toggle("hidden", !ready);
  $("publish-area").classList.toggle("hidden", !ready);
  if (ready) {
    $("qr").innerHTML = qrSvg(deck.payload);
    $("card-preview").src = deckCardCanvas(deck).toDataURL("image/png");
  }
  document.title = deck.name ? `${deck.name} | ポケポケ デッキQR` : "ポケポケ デッキQR";
}

function updateFromEditor() {
  const spec = readEditor();
  render(spec);
  const query = spec.cards.length ? `?${deckQuery(spec)}` : location.pathname;
  history.replaceState(null, "", query);
}

let timer = null;
function scheduleUpdate() {
  clearTimeout(timer);
  timer = setTimeout(updateFromEditor, 250);
}

function loadSpec(spec) {
  writeEditor(spec);
  render(spec);
}

function importText(text) {
  const value = text.trim();
  if (!value) return;
  let spec;
  try {
    if (/^https?:\/\//.test(value) || value.startsWith("?")) {
      const url = new URL(value, location.href);
      const parsed = parseDeckQuery(url.search);
      if (!parsed) throw new Error("URLにデッキが入っていません");
      spec = parsed.payload ? { ...deckFromPayload(parsed.payload, database), name: parsed.name } : parsed;
    } else {
      spec = deckFromPayload(value, database);
    }
  } catch (error) {
    showErrors($("import-errors"), [error.message]);
    return;
  }
  showErrors($("import-errors"), []);
  loadSpec(spec);
  updateFromEditor();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------------------------------------------------------------------------
// 検索

function renderSearch() {
  const results = database ? database.search($("search").value).slice(0, 50) : [];
  $("search-results").innerHTML = results.length
    ? `<table><tbody>${results
        .map(
          (card) => `<tr>
            <td>${nameCell(card)}<br><span class="note">${card.type === "pokemon" ? "ポケモン" : "トレーナーズ"}</span></td>
            <td class="code">${escapeHtml(cardCode(card))}</td>
            <td class="num"><button type="button" class="small" data-add="${escapeHtml(cardCode(card))}" data-name="${escapeHtml(displayName(card))}">＋</button></td>
          </tr>`,
        )
        .join("")}</tbody></table>`
    : "";
}

function addCard(code, name) {
  const area = $("edit-cards");
  const lines = area.value.split("\n").filter((line) => line.trim());
  const index = lines.findIndex((line) => line.replace(/#.*/, "").replace(/\s+/g, "").replace(/x\d+$/i, "").toLowerCase() === code.toLowerCase());
  if (index >= 0) {
    lines[index] = `${`${code}x2`.padEnd(12)} # ${name}`;
  } else {
    lines.push(`${code.padEnd(12)} # ${name}`);
  }
  area.value = lines.join("\n");
  updateFromEditor();
}

// ---------------------------------------------------------------------------
// 起動

$("edit-name").addEventListener("input", scheduleUpdate);
$("edit-cards").addEventListener("input", scheduleUpdate);
$("edit-energy").addEventListener("click", (event) => {
  const value = Number(event.target.dataset?.energy);
  if (!value) return;
  selectedEnergy = selectedEnergy.includes(value)
    ? selectedEnergy.filter((energy) => energy !== value)
    : [...selectedEnergy, value];
  renderEnergyPicker();
  updateFromEditor();
});
$("search").addEventListener("input", renderSearch);
$("search-results").addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (button) addCard(button.dataset.add, button.dataset.name);
});
$("import-button").addEventListener("click", () => importText($("import").value));

$("save-qr").addEventListener("click", () => {
  if (currentDeck?.payload) saveCanvas(qrCanvas(currentDeck.payload), `${fileSafe(currentDeck.name)}_QR.png`);
});
$("save-card").addEventListener("click", () => {
  if (currentDeck?.payload) saveCanvas(deckCardCanvas(currentDeck), `${fileSafe(currentDeck.name)}.png`);
});
$("copy-markdown").addEventListener("click", (event) => currentDeck && copyText(deckMarkdown(currentDeck), event.target));
$("copy-html").addEventListener("click", (event) => currentDeck && copyText(deckHtml(currentDeck), event.target));
$("copy-url").addEventListener("click", (event) => currentDeck && copyText(deckUrl(currentDeck), event.target));
$("share-url").addEventListener("click", async (event) => {
  if (!currentDeck) return;
  const url = deckUrl(currentDeck);
  if (navigator.share) {
    try {
      await navigator.share({ title: currentDeck.name || "ポケポケ デッキ", url });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  copyText(url, event.target);
});

// 使い方: AIに貼るプロンプト（ai-prompt.txt）
let promptText = null;
async function loadPrompt() {
  if (promptText) return promptText;
  const response = await fetch("ai-prompt.txt");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  promptText = await response.text();
  $("prompt-text").value = promptText;
  return promptText;
}
$("copy-prompt").addEventListener("click", async (event) => {
  try {
    await copyText(await loadPrompt(), event.target);
  } catch {
    event.target.textContent = "読み込めませんでした";
  }
});
$("show-prompt").addEventListener("click", async () => {
  try {
    await loadPrompt();
  } catch { /* 読めなければ空のまま */ }
  $("prompt-text").classList.toggle("hidden");
});

async function start() {
  renderEnergyPicker();
  // デッキURLから開いたときは注意事項と使い方を畳んで、QRを主役にする
  if (/[?&](d|c)=/.test(location.search)) {
    $("guide").open = false;
    $("caution").open = false;
  }
  try {
    const fetchJson = async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      return response.json();
    };
    const [records, species, names] = await Promise.all([
      fetchJson(CARD_DATABASE_URL),
      fetchJson("data/species-ja.json"),
      fetchJson("data/names-ja.json"),
    ]);
    const japanese = new JapaneseNames({ species, names });
    database = new CardDatabase(records, {
      localize: (record) => japanese.name(record),
      isGuessed: (record) => japanese.isGuessed(record),
    });
    $("db-status").textContent = `カードDB: ${database.records.length}枚分を読み込みました`;
  } catch (error) {
    $("db-status").textContent = `カードDBを読み込めませんでした（${error.message}）。時間をおいて再読み込みしてください`;
    return;
  }

  const parsed = parseDeckQuery(location.search);
  if (!parsed) return;
  let spec = parsed;
  if (parsed.payload) {
    try {
      spec = { ...deckFromPayload(parsed.payload, database), name: parsed.name };
    } catch (error) {
      spec = { name: parsed.name, energyTypes: [], cards: [], errors: [error.message] };
    }
  }
  loadSpec(spec);
  // URLから開いたときはQRを主役にして、編集欄は畳む
  if (currentDeck?.payload) $("editor").open = false;
}

start();

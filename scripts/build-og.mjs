// OGP画像（assets/og.png）とアイコンPNGを作り直す。要 playwright: npx -p playwright node scripts/build-og.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
const at = (p) => new URL(p, root).pathname;
const qrlib = readFileSync(at("vendor/qrcode.js"), "utf8");
const icon = readFileSync(at("assets/icon.svg"), "utf8");
const payload = "C5iWqJiWqJicApiaXpiXwJiaaJiahpiXKpiWnpiWnpiXogkAM+oAM+oAA9QAA9QAM/4AR6QAR6QAHPIAHPIBBA==";
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#f6f7fb;font-family:"Hiragino Sans","Noto Sans JP",sans-serif;color:#1d2130;display:flex;align-items:center;padding:0 80px;gap:72px}
.text{flex:1}
.badge{display:inline-block;font-size:24px;color:#646b80;border:2px solid #dde1ec;border-radius:999px;padding:6px 18px;margin-bottom:28px}
h1{font-size:84px;line-height:1.1;letter-spacing:.01em}
p{font-size:32px;color:#3a4052;margin-top:28px;line-height:1.5}
.url{font-size:24px;color:#8a90a3;margin-top:40px}
.qr{width:380px;height:380px;background:#fff;border-radius:28px;padding:22px;box-shadow:0 8px 30px rgba(30,40,80,.12)}
.qr svg{width:100%;height:100%}
.icon{display:inline-block;width:64px;height:64px;vertical-align:-6px;margin-right:16px}
</style></head><body>
<div class="text">
<div class="badge">非公式ファンツール</div>
<h1><span class="icon">${icon.replace("<svg ", '<svg width="64" height="64" ')}</span>ポケポケ<br>デッキQR</h1>
<p>デッキを作って、<br>ゲームで読み込めるコードに。</p>
<div class="url">mozk-umino.github.io/mozk-poke2-qr</div>
</div>
<div class="qr" id="qr"></div>
<script>${qrlib}
const qr=qrcode(9,"H");qr.addData(${JSON.stringify(payload)},"Byte");qr.make();
const n=qr.getModuleCount();let d="";for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))d+="M"+c+" "+r+"h1v1h-1z";
document.getElementById("qr").innerHTML='<svg viewBox="0 0 '+n+' '+n+'" shape-rendering="crispEdges"><path d="'+d+'"/></svg>';
</script></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: at("assets/og.png") });
const p2 = await browser.newPage({ viewport: { width: 180, height: 180 } });
await p2.setContent(`<html><body style="margin:0">${icon.replace("<svg ", '<svg width="180" height="180" ')}</body></html>`);
await p2.screenshot({ path: at("assets/apple-touch-icon.png"), omitBackground: true });
await browser.close();

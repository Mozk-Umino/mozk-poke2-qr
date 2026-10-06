// アクセス解析（Google アナリティクス 4）。
// GA_MEASUREMENT_ID が空のうちは何も読み込まない。
//
// デッキURLの ? 以降にはデッキの内容が入るので、送るURLは ? 以降を落としたものにする。
// GA4 の管理画面で「拡張計測機能 → ページの変更（ブラウザの履歴イベントに基づく）」を必ずオフにする
// （このページは編集のたびに URL を書き換えるため、オンだとデッキ入りの URL が送られる）。

export const GA_MEASUREMENT_ID = "";

const enabled = Boolean(GA_MEASUREMENT_ID);

function stripQuery(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  } catch {
    return "";
  }
}

if (enabled) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  const cleanUrl = stripQuery(location.href);
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: false,
    page_location: cleanUrl,
    page_referrer: stripQuery(document.referrer),
  });
  window.gtag("set", { page_location: cleanUrl });
  // デッキURLから開いたかどうかだけを送る（デッキの中身は送らない）
  window.gtag("event", "page_view", {
    page_location: cleanUrl,
    opened_with_deck: /[?&](d|c)=/.test(location.search) ? "yes" : "no",
  });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.append(script);
}

// ボタン操作などを数える。デッキの内容は渡さないこと
export function track(name) {
  if (enabled) window.gtag("event", name);
}

export const analyticsEnabled = enabled;

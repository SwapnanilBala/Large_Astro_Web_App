/**
 * Screenshot a URL at an exact viewport, with no dependencies.
 *
 *   node shot.mjs <url> <out.png> [width] [height] [--full]
 *
 * Why not just `msedge --headless --window-size=375,812`: Edge enforces a
 * minimum window width on Windows (measured ~490px here), so the flag silently
 * lays the page out at 492-518px and then crops the image to the requested
 * size. Everything looks clipped and nothing is actually wrong with the page.
 *
 * Emulation.setDeviceMetricsOverride sets the viewport directly and is not
 * bounded by the OS window, so 375x812 really is 375x812 — and it can turn on
 * mobile emulation, which --window-size cannot do at all.
 *
 * Node 22+ (global WebSocket). Uses whichever Chromium browser is installed.
 */

import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

const [, , url, out, w = "375", h = "812", ...rest] = process.argv;
if (!url || !out) {
  console.error(
    "usage: node shot.mjs <url> <out.png> [w] [h] [--full] [--init=f.js] [--scroll-to=sel] [--wait=ms]",
  );
  process.exit(1);
}
const fullPage = rest.includes("--full");
/* Runs before any page script, so it can seed localStorage. Most screens here
   render from local state — a profile picker with one profile is not the view
   worth judging, and there is no other way to reach a seeded one headlessly. */
const initFile = rest.find((a) => a.startsWith("--init="))?.slice(7);
const width = Number(w);
const height = Number(h);
const mobile = width < 768;

const { existsSync } = await import("node:fs");
const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
  console.error("no Chromium browser found; edit BROWSERS in this file");
  process.exit(1);
}

const port = 9000 + Math.floor((Date.now() % 900));
const profile = mkdtempSync(join(tmpdir(), "shot-"));
const child = spawn(browser, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--hide-scrollbars",
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${port}`,
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The debugging endpoint takes a moment to bind. */
async function targets() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* not listening yet */
    }
    await sleep(125);
  }
  throw new Error("browser never exposed a page target");
}

const ws = new WebSocket(await targets());
await new Promise((res, rej) => {
  ws.addEventListener("open", res, { once: true });
  ws.addEventListener("error", rej, { once: true });
});

let nextId = 0;
const pending = new Map();
const events = new Map();
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id !== undefined) {
    const entry = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? entry.reject(new Error(msg.error.message)) : entry.resolve(msg.result);
  } else if (events.has(msg.method)) {
    events.get(msg.method)();
    events.delete(msg.method);
  }
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

const once = (method) => new Promise((resolve) => events.set(method, resolve));

await send("Page.enable");

/* Console and uncaught errors go to stderr. A screenshot shows what rendered;
   it does not show a React key warning or a thrown effect, and those are
   exactly what turn up as "N Issues" in the dev overlay. */
const consoleLines = [];
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === "Runtime.consoleAPICalled" && /error|warning/.test(msg.params.type)) {
    consoleLines.push(
      `[${msg.params.type}] ` +
        msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(" "),
    );
  }
  if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    consoleLines.push(`[exception] ${d.exception?.description ?? d.text}`);
  }
});
await send("Runtime.enable");
/* The whole point: an exact viewport the OS window cannot constrain. */
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 2,
  mobile,
  screenWidth: width,
  screenHeight: height,
});
if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

if (initFile) {
  const { readFileSync } = await import("node:fs");
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: readFileSync(initFile, "utf8"),
  });
}

const loaded = once("Page.loadEventFired");
await send("Page.navigate", { url });
await Promise.race([loaded, sleep(15000)]);
/* Fonts, hydration, and any first paint after it. */
await sleep(1200);

/* --scroll-to brings one element to the top of the viewport. Full-page capture
   of a long results page produces an image too tall to read; this frames the
   part being judged instead. */
const scrollTo = rest.find((a) => a.startsWith("--scroll-to="))?.slice(12);
if (scrollTo) {
  await send("Runtime.evaluate", {
    expression: `(() => { const el = document.querySelector(${JSON.stringify(scrollTo)});
      if (el) { window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 24, behavior: "instant" }); return "ok"; }
      return "selector not found: " + ${JSON.stringify(scrollTo)}; })()`,
    returnByValue: true,
  }).then((r) => { if (r.result.value !== "ok") console.error(r.result.value); });
  /* Sections here reveal on intersection, so the frame right after a scroll is
     still mid-animation. --wait raises this for pages that need longer. */
  await sleep(1500);
}

const extraWait = Number(rest.find((a) => a.startsWith("--wait="))?.slice(7) ?? 0);
if (extraWait) await sleep(extraWait);

/* No clip. captureScreenshot's clip is in page coordinates, not viewport ones,
   so clipping at y:0 returns the top of the document however far the page has
   been scrolled — which silently defeats --scroll-to. The viewport is already
   exactly `width` x `height` from setDeviceMetricsOverride, so an unclipped
   capture is the right size anyway. */
const { data } = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: fullPage,
});
writeFileSync(out, Buffer.from(data, "base64"));

/* --eval runs an expression in the page after everything has settled and prints
   the result. A screenshot shows what rendered; this answers why. */
const evalExpr = rest.find((a) => a.startsWith("--eval="))?.slice(7);
if (evalExpr) {
  const out = await send("Runtime.evaluate", {
    expression: evalExpr,
    returnByValue: true,
    awaitPromise: true,
  });
  console.log(
    typeof out.result.value === "string"
      ? out.result.value
      : JSON.stringify(out.result.value, null, 1),
  );
}

const metrics = await send("Runtime.evaluate", {
  expression:
    "JSON.stringify({inner:innerWidth+'x'+innerHeight, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, title: document.title})",
  returnByValue: true,
});
console.log(out, metrics.result.value);
if (consoleLines.length) {
  console.error(`
${consoleLines.length} console error/warning(s):`);
  for (const line of consoleLines.slice(0, 15)) console.error("  " + line.slice(0, 600));
}

ws.close();
child.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}

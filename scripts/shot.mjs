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
    "usage: node shot.mjs <url> <out.png> [width] [height] [--full] [--init=<file.js>]",
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

const { data } = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: fullPage,
  ...(fullPage ? {} : { clip: { x: 0, y: 0, width, height, scale: 1 } }),
});
writeFileSync(out, Buffer.from(data, "base64"));

const metrics = await send("Runtime.evaluate", {
  expression:
    "JSON.stringify({inner:innerWidth+'x'+innerHeight, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, title: document.title})",
  returnByValue: true,
});
console.log(out, metrics.result.value);

ws.close();
child.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}

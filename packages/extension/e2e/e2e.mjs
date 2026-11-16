// E2E: load the unpacked extension in Chromium; mock Claude (SSE) and RemNote (stub page with a fake plugin iframe).
import { chromium } from "playwright";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert";

const ext = path.resolve("dist/chrome");
const cards = {
  topic: "Hypertrophy basics", scaffold: "Muscle grows when mechanical tension is high enough",
  gaps: [], scenarioNotes: [],
  clusters: [{ concept: "Mechanical tension", definition: "Force a muscle fibre produces while resisting load", direction: "backward", descriptors: [
    { kind: "descriptor", prompt: "Primary driver of hypertrophy", answer: "Mechanical tension" },
    { kind: "counterfactual", prompt: "what happens to growth if load is always trivially light?", answer: "Tension stays too low to stimulate growth" },
    { kind: "scenario", prompt: "a set stopped 10 reps from failure - effective?", answer: "Usually not; effective reps need near-failure effort" } ] }],
};
const sse = (obj) => {
  const ev = (t, d) => `event: ${t}\ndata: ${JSON.stringify({ type: t, ...d })}\n\n`;
  const text = JSON.stringify(obj);
  return ev("message_start", { message: { id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, usage: { input_tokens: 100, output_tokens: 1 } } })
    + ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } })
    + ev("content_block_delta", { index: 0, delta: { type: "text_delta", text } })
    + ev("content_block_stop", { index: 0 })
    + ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 80 } })
    + ev("message_stop", {});
};

const ctx = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "rfg-")), {
  headless: false, executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium", args: ["--headless=new", "--no-sandbox", `--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
let apiCalls = 0;
await ctx.route("https://api.anthropic.com/**", (r) => { apiCalls++; r.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: sse(cards) }); });
await ctx.route("https://example.test/**", (r) => r.fulfill({ contentType: "text/html", body: `<html><head><title>Muscle growth</title></head><body><article><h1>Muscle growth</h1>${"<p>Mechanical tension is the primary driver of muscle hypertrophy because load on the fibre triggers growth signalling. </p>".repeat(8)}</article></body></html>` }));
await ctx.route("https://www.remnote.com/**", (r) => r.fulfill({ contentType: "text/html", body: `<html><body>stub remnote<iframe id="plugin" srcdoc="<script>
  window.addEventListener('message', e => { const d = e.data; if (!d || d.type!=='rfg:import') return;
    const ok = d.token==='tok'; if (ok) window.parent.document.title='received:'+d.payload.title+'|'+d.payload.markdown.split('\\n').length;
    e.source.postMessage({type:'rfg:ack', id:d.id, ok, error: ok?undefined:'bad-token'}, '*'); });
</script>"></iframe></body></html>` }));

let sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
const extId = new URL(sw.url()).host;
await sw.evaluate(() => chrome.storage.local.set({ settings: { apiKey: "sk-ant-test", model: "claude-opus-5-5", effort: "medium", maxClusters: 5, pairingToken: "tok", autoDomains: "", openRemNote: false } }));

const article = await ctx.newPage(); await article.goto("https://example.test/article");
const remnote = await ctx.newPage(); await remnote.goto("https://www.remnote.com/"); await remnote.waitForSelector("#plugin");
const popup = await ctx.newPage(); await popup.goto(`chrome-extension://${extId}/popup.html`);

const gen = await popup.evaluate(async () => { const [t] = await chrome.tabs.query({ url: "https://example.test/*" }); return chrome.runtime.sendMessage({ type: "generate", tabId: t.id }); });
assert.ok(gen.ok, "generate failed: " + gen.error);
assert.equal(apiCalls, 1, "Claude called once (no repair needed)");
assert.match(gen.pending.markdown, /Mechanical tension :< Force a muscle fibre/);
assert.match(gen.pending.markdown, /Counterfactual: what happens to growth/);
console.log("generate OK:\n" + gen.pending.markdown);

await popup.evaluate((p) => chrome.runtime.sendMessage({ type: "queue", item: { title: p.title, url: p.url, markdown: p.markdown } }), gen.pending);
const fl = await popup.evaluate(() => chrome.runtime.sendMessage({ type: "flush" }));
assert.equal(fl.sent, 1, "flush result " + JSON.stringify(fl));
await remnote.waitForFunction(() => document.title.startsWith("received:Muscle growth"));
console.log("bridge OK ->", await remnote.title());
const left = await sw.evaluate(async () => (await chrome.storage.local.get("outbox")).outbox.length);
assert.equal(left, 0, "queue drained");

// wrong token must not drain the queue
await popup.evaluate(() => chrome.storage.local.set({ settings: { apiKey: "x", model: "claude-opus-5-5", effort: "medium", maxClusters: 5, pairingToken: "WRONG", autoDomains: "", openRemNote: false } }));
await popup.evaluate(() => chrome.runtime.sendMessage({ type: "queue", item: { title: "t", url: "https://e.test", markdown: "- a =- b" } }));
const fl2 = await popup.evaluate(() => chrome.runtime.sendMessage({ type: "flush" }));
assert.equal(fl2.sent, 0); assert.equal(fl2.left, 1);
console.log("bad token rejected OK; queue kept");
await ctx.close();
console.log("E2E PASS");

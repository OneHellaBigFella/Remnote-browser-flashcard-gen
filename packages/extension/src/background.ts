import { generateCards, renderCardSet, formatIssues } from "@rfg/core";
import { getSettings, Outbound, Pending } from "./settings";

const REMNOTE = "https://www.remnote.com/*";

async function setBadge() {
  const { outbox = [], pending } = await chrome.storage.local.get(["outbox", "pending"]);
  const n = (outbox as Outbound[]).length;
  await chrome.action.setBadgeBackgroundColor({ color: n ? "#d9822b" : "#2b7fd9" });
  await chrome.action.setBadgeText({ text: n ? String(n) : pending ? "✓" : "" });
}

async function extractFrom(tabId: number) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["extract.js"] });
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: () => (window as any).__rfgExtract() });
  return res.result as { title: string; url: string; text: string; isSelection: boolean };
}

export async function generateForTab(tabId: number, auto = false): Promise<Pending> {
  const s = await getSettings();
  if (!s.apiKey) throw new Error("Add your Anthropic API key in the extension options first");
  await chrome.action.setBadgeText({ text: "…" });
  try {
    const page = await extractFrom(tabId);
    if (page.text.length < 200) throw new Error("Not enough readable text on this page");
    const r = await generateCards(page, { apiKey: s.apiKey, model: s.model, effort: s.effort, maxClusters: s.maxClusters });
    if (!r.set.clusters.length) throw new Error("Nothing on this page was worth carding");
    const pending: Pending = {
      title: page.title, url: page.url, markdown: renderCardSet(r.set),
      issues: r.issues.length ? formatIssues(r.issues).split("\n") : [], gaps: r.set.gaps, scenarioNotes: r.set.scenarioNotes,
      usage: r.usage, model: s.model,
    };
    if (auto) await enqueue(pending); else await chrome.storage.local.set({ pending });
    return pending;
  } finally { await setBadge(); }
}

async function enqueue(p: { title: string; url: string; markdown: string }) {
  const { outbox = [] } = await chrome.storage.local.get("outbox");
  (outbox as Outbound[]).push({ id: crypto.randomUUID(), title: p.title, url: p.url, markdown: p.markdown, createdAt: Date.now() });
  await chrome.storage.local.set({ outbox, pending: null });
  await setBadge();
  flush().catch(() => {});
}

type FlushResult = { sent: number; left: number; error?: string };
let inflight: Promise<FlushResult> | null = null;
/** Concurrent callers (auto-flush after enqueue + popup's explicit flush) share one run. */
export function flush(): Promise<FlushResult> {
  return (inflight ??= doFlush().finally(() => { inflight = null; }));
}
async function doFlush(): Promise<FlushResult> {
  {
    const s = await getSettings();
    if (!s.pairingToken) return { sent: 0, left: 0, error: "Set the pairing token in options (RemNote > Settings > Plugins > Flashcard Generator Importer)" };
    let tabs = await chrome.tabs.query({ url: REMNOTE });
    if (!tabs.length && s.openRemNote) {
      const t = await chrome.tabs.create({ url: "https://www.remnote.com/", active: false });
      await new Promise((r) => setTimeout(r, 12000)); // let RemNote + plugins load
      tabs = [t];
    }
    if (!tabs.length) return { sent: 0, left: 0, error: "Open RemNote to import the queued cards" };
    let { outbox = [] } = (await chrome.storage.local.get("outbox")) as { outbox: Outbound[] };
    let sent = 0, error: string | undefined;
    for (const item of [...outbox]) {
      let ok = false;
      for (const tab of tabs) {
        const r = await chrome.tabs.sendMessage(tab.id!, { type: "rfg:send", id: item.id, token: s.pairingToken, payload: { title: item.title, url: item.url, markdown: item.markdown } }).catch(() => null);
        if (r?.ok) { ok = true; break; }
        error = r?.error ?? "bridge-unreachable";
      }
      if (!ok) break;
      sent++;
      outbox = outbox.filter((o) => o.id !== item.id);
      await chrome.storage.local.set({ outbox });
    }
    await setBadge();
    return { sent, left: outbox.length, error: outbox.length ? error : undefined };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus?.create({ id: "rfg", title: "Make RemNote flashcards from page / selection", contexts: ["page", "selection"] });
  setBadge();
});
chrome.contextMenus?.onClicked.addListener((info, tab) => { if (tab?.id) generateForTab(tab.id).catch((e) => chrome.storage.local.set({ lastError: String(e.message ?? e) })); });
chrome.commands?.onCommand.addListener(async (cmd) => {
  if (cmd !== "generate") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) generateForTab(tab.id).catch((e) => chrome.storage.local.set({ lastError: String(e.message ?? e) }));
});

// Auto mode: allow-listed domains are carded and queued when a page finishes loading.
chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  if (change.status !== "complete" || !tab.url?.startsWith("http")) return;
  const s = await getSettings();
  const hosts = s.autoDomains.split("\n").map((h) => h.trim().toLowerCase()).filter(Boolean);
  const host = new URL(tab.url).hostname.toLowerCase();
  if (!hosts.some((h) => host === h || host.endsWith("." + h))) return;
  const { seen = [] } = await chrome.storage.local.get("seen");
  if ((seen as string[]).includes(tab.url)) return;
  await chrome.storage.local.set({ seen: [...(seen as string[]).slice(-200), tab.url] });
  generateForTab(tabId, true).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, _s, send) => {
  (async () => {
    try {
      if (msg.type === "generate") send({ ok: true, pending: await generateForTab(msg.tabId) });
      else if (msg.type === "queue") { await enqueue(msg.item); send({ ok: true }); }
      else if (msg.type === "flush") send({ ok: true, ...(await flush()) });
      else if (msg.type === "discard") { await chrome.storage.local.set({ pending: null }); await setBadge(); send({ ok: true }); }
    } catch (e: any) { send({ ok: false, error: String(e?.message ?? e) }); }
  })();
  return true;
});

import { Outbound, Pending } from "./settings";
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let cur: Pending | null = null;

async function refresh() {
  const { pending, outbox = [], lastError } = (await chrome.storage.local.get(["pending", "outbox", "lastError"])) as any;
  cur = pending ?? null;
  $("preview").hidden = !cur;
  if (cur) {
    $<HTMLTextAreaElement>("block").value = cur.markdown;
    const cost = (cur.usage.input / 1e6) * 4 + (cur.usage.output / 1e6) * 20;
    $("meta").textContent = `${cur.title} - ${cur.usage.input + cur.usage.output} tokens` + (cur.model.includes("opus") ? ` (~$${cost.toFixed(3)})` : "");
    $("warn").textContent = [...cur.issues, ...cur.gaps.map((g) => "Gap (not taught): " + g), ...cur.scenarioNotes.map((s) => "Scenario to veto?: " + s)].join("\n");
  }
  const n = (outbox as Outbound[]).length;
  $<HTMLButtonElement>("flush").hidden = !n;
  $("flush").textContent = `Send ${n} queued now`;
  $("status").textContent = lastError ? lastError : "";
  $("status").className = lastError ? "err" : "muted";
}

$("gen").onclick = async () => {
  await chrome.storage.local.set({ lastError: "" });
  $("status").textContent = "Reading page and generating…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const r = await chrome.runtime.sendMessage({ type: "generate", tabId: tab.id });
  if (!r.ok) await chrome.storage.local.set({ lastError: r.error });
  await refresh();
};
$("send").onclick = async () => {
  if (!cur) return;
  const markdown = $<HTMLTextAreaElement>("block").value;
  await chrome.runtime.sendMessage({ type: "queue", item: { title: cur.title, url: cur.url, markdown } });
  $("status").textContent = "Queued - sending to RemNote…";
  const r = await chrome.runtime.sendMessage({ type: "flush" });
  $("status").textContent = r.error ? r.error : `Sent ${r.sent} to today's Daily Doc`;
  await refresh();
};
$("copy").onclick = () => navigator.clipboard.writeText($<HTMLTextAreaElement>("block").value).then(() => ($("status").textContent = "Copied - paste into RemNote"));
$("discard").onclick = async () => { await chrome.runtime.sendMessage({ type: "discard" }); await refresh(); };
$("flush").onclick = async () => { const r = await chrome.runtime.sendMessage({ type: "flush" }); $("status").textContent = r.error ?? `Sent ${r.sent}`; await refresh(); };
$("opts").onclick = (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); };
refresh();

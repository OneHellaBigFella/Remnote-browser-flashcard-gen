import { generateCards, renderCardSet, formatIssues } from "@rfg/core";
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const q = new URLSearchParams(location.search);
const shared = q.get("url") || (q.get("text") ?? "");
if (shared) $<HTMLTextAreaElement>("input").value = [q.get("title"), shared].filter(Boolean).join("\n");
try { $<HTMLInputElement>("key").value = localStorage.getItem("rfg-key") ?? ""; } catch {}
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

async function fetchReadable(url: string): Promise<string> {
  // Pages rarely allow cross-origin fetch; r.jina.ai returns readable text. The page URL is sent to that service.
  const r = await fetch("https://r.jina.ai/" + url);
  if (!r.ok) throw new Error("Could not fetch the page; paste its text instead");
  return r.text();
}

$("go").onclick = async () => {
  const key = $<HTMLInputElement>("key").value.trim();
  const raw = $<HTMLTextAreaElement>("input").value.trim();
  if (!key || !raw) return void ($("status").textContent = "Need an API key and a URL or text");
  try { localStorage.setItem("rfg-key", key); } catch {}
  $("status").textContent = "Generating…";
  try {
    const m = raw.match(/https?:\/\/\S+/);
    const isUrl = !!m && raw.replace(m[0], "").trim().length < 200;
    const text = isUrl ? await fetchReadable(m![0]) : raw;
    const r = await generateCards({ title: isUrl ? m![0] : raw.slice(0, 60), url: isUrl ? m![0] : "pasted text", text, isSelection: !isUrl }, { apiKey: key });
    if (!r.set.clusters.length) throw new Error("Nothing worth carding in that text");
    $<HTMLTextAreaElement>("out").value = renderCardSet(r.set);
    $("out").hidden = false; $("copy").hidden = false;
    $("status").textContent = r.issues.length ? formatIssues(r.issues) : "Done";
  } catch (e: any) { $("status").textContent = String(e.message ?? e); }
};
$("copy").onclick = () => navigator.clipboard.writeText($<HTMLTextAreaElement>("out").value).then(() => ($("status").textContent = "Copied"));

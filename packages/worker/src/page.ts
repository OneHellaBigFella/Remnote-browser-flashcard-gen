import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

export interface Page { title: string; text: string }

const MIN_TEXT = 500;

function readable(html: string, url: string): Page {
  const { document } = parseHTML(html);
  try {
    const base = document.createElement("base");
    base.setAttribute("href", url);
    document.head?.appendChild(base);
  } catch { /* base is best effort */ }
  const art = new Readability(document as any).parse();
  const title = (art?.title || document.title || url).trim();
  const text = (art?.textContent ?? document.body?.textContent ?? "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();
  return { title, text };
}

/** Fetch readable text for a URL. Direct fetch first; r.jina.ai as a fallback for JS-rendered or blocked pages. */
export async function fetchPage(url: string, fetcher: typeof fetch = fetch): Promise<Page> {
  let direct: Page | undefined;
  try {
    const r = await fetcher(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; RFGBot/1.0)", accept: "text/html,*/*" }, redirect: "follow" });
    const type = r.headers.get("content-type") ?? "";
    if (r.ok && /html|text\/plain/.test(type)) {
      const body = await r.text();
      direct = /html/.test(type) ? readable(body, url) : { title: url, text: body };
      if (direct.text.length >= MIN_TEXT) return direct;
    }
  } catch { /* fall through */ }
  try {
    const r = await fetcher("https://r.jina.ai/" + url, { headers: { accept: "text/plain" } });
    if (r.ok) {
      const text = (await r.text()).trim();
      if (text.length > (direct?.text.length ?? 0)) return { title: direct?.title ?? url, text };
    }
  } catch { /* ignore */ }
  if (direct && direct.text.length > 0) return direct;
  throw new Error("Could not read that page");
}

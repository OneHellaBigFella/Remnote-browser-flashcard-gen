import { Readability } from "@mozilla/readability";

export interface Extracted { title: string; url: string; text: string; isSelection: boolean; }

function extract(): Extracted {
  const sel = window.getSelection()?.toString().trim() ?? "";
  if (sel.length >= 40) return { title: document.title, url: location.href, text: sel, isSelection: true };
  const clone = document.cloneNode(true) as Document;
  const article = new Readability(clone).parse();
  const text = (article?.textContent ?? document.body.innerText ?? "").replace(/\n{3,}/g, "\n\n").trim();
  return { title: article?.title || document.title, url: location.href, text, isSelection: false };
}
(window as any).__rfgExtract = extract;

import { describe, it, expect } from "vitest";
import { fetchPage } from "../src/page";

const html = `<html><head><title>Cushing</title></head><body><nav>Home About</nav><article><h1>Cushing syndrome</h1>${"<p>Cortisol excess causes central obesity and striae in patients over time. </p>".repeat(20)}</article></body></html>`;
const res = (body: string, type = "text/html") => new Response(body, { headers: { "content-type": type } });

describe("fetchPage", () => {
  it("extracts readable text directly", async () => {
    const p = await fetchPage("https://a.test", (async () => res(html)) as any);
    expect(p.title).toContain("Cushing");
    expect(p.text).toContain("Cortisol excess");
  });
  it("falls back to jina for thin pages", async () => {
    const seen: string[] = [];
    const f = (async (u: string) => { seen.push(u); return u.startsWith("https://r.jina.ai/") ? res("J".repeat(800), "text/plain") : res("<html><body><div id=app></div></body></html>"); }) as any;
    const p = await fetchPage("https://spa.test", f);
    expect(seen[1]).toBe("https://r.jina.ai/https://spa.test");
    expect(p.text).toHaveLength(800);
  });
  it("throws when nothing is readable", async () => {
    await expect(fetchPage("https://x.test", (async () => { throw new Error("net"); }) as any)).rejects.toThrow("Could not read");
  });
});

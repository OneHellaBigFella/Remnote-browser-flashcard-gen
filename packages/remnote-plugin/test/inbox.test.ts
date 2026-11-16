import { describe, it, expect } from "vitest";
import { pollInbox, type SeenStore } from "../src/inbox";

function fakePlugin(failOn?: string) {
  const created: string[] = [];
  return {
    created,
    date: { getTodaysDoc: async () => ({ _id: "today" }) },
    rem: {
      createSingleRemWithMarkdown: async (md: string) => { if (failOn && md.includes(failOn)) throw new Error("fail"); created.push(md); return { _id: "src" + created.length }; },
      createTreeWithMarkdown: async () => [],
    },
  };
}
const mem = (init: string[] = []): SeenStore & { ids: string[] } => { const s: any = { ids: init, get: async () => s.ids, set: async (i: string[]) => { s.ids = i; } }; return s; };
const items = [{ id: "a", title: "A", url: "https://a.test", markdown: "- x" }, { id: "b", title: "B", url: "https://b.test", markdown: "- y" }];
function fakeFetch(acked: string[][], status = 200) {
  return (async (u: string, init?: any) => {
    if (u.endsWith("/inbox")) return new Response(JSON.stringify({ items }), { status });
    acked.push(JSON.parse(init.body).ids);
    return new Response("{}");
  }) as any;
}
const cfg = { workerUrl: "https://w.test/", pullToken: "t" };

describe("pollInbox", () => {
  it("imports all items and acks them", async () => {
    const p = fakePlugin(), acked: string[][] = [], seen = mem();
    const r = await pollInbox(p as any, cfg, seen, fakeFetch(acked));
    expect(r).toEqual({ imported: 2, failed: 0 });
    expect(p.created).toHaveLength(2);
    expect(acked[0]).toEqual(["a", "b"]);
    expect(seen.ids).toEqual(["a", "b"]);
  });
  it("does not ack items that failed to import, and retries them later", async () => {
    const p = fakePlugin("B"), acked: string[][] = [];
    const r = await pollInbox(p as any, cfg, mem(), fakeFetch(acked));
    expect(r).toEqual({ imported: 1, failed: 1 });
    expect(acked[0]).toEqual(["a"]);
  });
  it("skips already-imported ids but still acks them (no duplicates after a failed ack)", async () => {
    const p = fakePlugin(), acked: string[][] = [];
    const r = await pollInbox(p as any, cfg, mem(["a"]), fakeFetch(acked));
    expect(r.imported).toBe(1);
    expect(p.created).toHaveLength(1);
    expect(acked[0]).toEqual(["a", "b"]);
  });
  it("reports config and auth problems without touching RemNote", async () => {
    const p = fakePlugin();
    expect((await pollInbox(p as any, { workerUrl: "", pullToken: "" }, mem())).error).toBe("not-configured");
    expect((await pollInbox(p as any, cfg, mem(), fakeFetch([], 401))).error).toBe("bad-token");
    expect(p.created).toHaveLength(0);
  });
});

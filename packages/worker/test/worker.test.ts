import { describe, it, expect } from "vitest";
import { handle, type Env, type Deps, type KV } from "../src/index";

function memKV(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    put: async (k, v) => void data.set(k, v),
    delete: async (k) => void data.delete(k),
    list: async ({ prefix }) => ({ keys: [...data.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }),
  };
}
const SET = { topic: "Cushing's", scaffold: "", gaps: [], scenarioNotes: [], clusters: [{ concept: "Cortisol", definition: "Stress hormone", direction: "both", descriptors: [] }] };
function setup(over: Partial<Deps> = {}, env: Partial<Env> = {}) {
  const kv = memKV();
  const calls: any[] = [];
  const deps: Deps = {
    fetchPage: async (u) => ({ title: "Fetched " + u, text: "x".repeat(900) }),
    generate: async (input, opts) => { calls.push({ input, opts }); return { set: SET as any, issues: [], usage: { input: 1, output: 1 } }; },
    now: () => 1_000_000,
    id: (() => { let n = 0; return () => "id" + ++n; })(),
    ...over,
  };
  const e: Env = { INBOX: kv, ANTHROPIC_API_KEY: "sk", SUBMIT_TOKEN: "sub", PULL_TOKEN: "pull", ...env };
  const call = (path: string, init: RequestInit & { token?: string; json?: unknown } = {}) =>
    handle(new Request("https://w.test" + path, { method: init.method ?? (init.json ? "POST" : "GET"), headers: { ...(init.token ? { authorization: "Bearer " + init.token } : {}), "content-type": "application/json" }, body: init.json ? JSON.stringify(init.json) : undefined }), e, deps);
  return { kv, calls, call };
}

describe("worker", () => {
  it("rejects bad or missing submit token", async () => {
    const { call } = setup();
    expect((await call("/submit", { json: { url: "https://a.test" } })).status).toBe(401);
    expect((await call("/submit", { json: { url: "https://a.test" }, token: "pull" })).status).toBe(401);
  });
  it("submit stores cards; inbox returns them; ack deletes", async () => {
    const { call, kv, calls } = setup();
    const r = await call("/submit", { json: { url: "https://a.test/x" }, token: "sub" });
    expect(r.status).toBe(200);
    expect(calls[0].input.url).toBe("https://a.test/x");
    expect(calls[0].opts.apiKey).toBe("sk");
    const inbox = await (await call("/inbox", { token: "pull" })).json() as any;
    expect(inbox.items).toHaveLength(1);
    expect(inbox.items[0].markdown).toContain("Cortisol");
    expect((await call("/inbox", { token: "sub" })).status).toBe(401);
    await call("/ack", { json: { ids: ["id1", "../bad"] }, token: "pull" });
    expect([...kv.data.keys()].filter((k) => k.startsWith("inbox:"))).toHaveLength(0);
  });
  it("extracts the URL from share-sheet text", async () => {
    const { call, calls } = setup();
    await call("/submit", { json: { text: "Cool article\nhttps://b.test/p" }, token: "sub" });
    expect(calls[0].input.url).toBe("https://b.test/p");
  });
  it("uses supplied long text instead of fetching, and notes screen source", async () => {
    let fetched = false;
    const { call, calls } = setup({ fetchPage: async () => { fetched = true; return { title: "t", text: "t" }; } });
    await call("/submit", { json: { text: "word ".repeat(100), source: "screen" }, token: "sub" });
    expect(fetched).toBe(false);
    expect(calls[0].input.text).toContain("read off a phone screen");
  });
  it("rejects non-http urls and empty bodies", async () => {
    const { call } = setup();
    expect((await call("/submit", { json: { url: "file:///etc/passwd" }, token: "sub" })).status).toBe(400);
    expect((await call("/submit", { json: {}, token: "sub" })).status).toBe(400);
  });
  it("rate limits", async () => {
    const { call } = setup({}, { SUBMITS_PER_HOUR: "1" });
    expect((await call("/submit", { json: { url: "https://a.test" }, token: "sub" })).status).toBe(200);
    expect((await call("/submit", { json: { url: "https://a.test" }, token: "sub" })).status).toBe(429);
  });
  it("reports fetch and generation failures", async () => {
    expect((await setup({ fetchPage: async () => { throw new Error("nope"); } }).call("/submit", { json: { url: "https://a.test" }, token: "sub" })).status).toBe(422);
    expect((await setup({ generate: async () => { throw new Error("boom"); } }).call("/submit", { json: { url: "https://a.test" }, token: "sub" })).status).toBe(502);
  });
  it("answers CORS preflight", async () => {
    const r = await setup().call("/inbox", { method: "OPTIONS" });
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
  });
});

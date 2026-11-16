import { generateCards, renderForPlugin, type GenerateInput, type GenerateOptions, type GenerateResult } from "@rfg/core";
import { fetchPage, type Page } from "./page";

export interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string }): Promise<{ keys: { name: string }[] }>;
}
export interface Env {
  INBOX: KV;
  ANTHROPIC_API_KEY: string;
  SUBMIT_TOKEN: string;
  PULL_TOKEN: string;
  MODEL?: string;
  MAX_CLUSTERS?: string;
  SUBMITS_PER_HOUR?: string;
}
export interface Deps {
  fetchPage: (url: string) => Promise<Page>;
  generate: (input: GenerateInput, opts: GenerateOptions) => Promise<GenerateResult>;
  now: () => number;
  id: () => string;
}
export const defaultDeps: Deps = {
  fetchPage: (u) => fetchPage(u),
  generate: generateCards,
  now: () => Date.now(),
  id: () => crypto.randomUUID(),
};

export interface InboxItem { id: string; title: string; url: string; markdown: string; createdAt: number }

const TTL = 60 * 60 * 24 * 30;
const MAX_TEXT = 300_000;
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } });

/** Constant-time-ish compare so tokens are not leaked by timing. */
function same(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function bearer(req: Request): string {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}
function isHttpUrl(s: string): boolean {
  try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
}

async function rateLimited(env: Env, now: number): Promise<boolean> {
  const limit = Number(env.SUBMITS_PER_HOUR ?? 60);
  const key = `rl:${Math.floor(now / 3_600_000)}`;
  const n = Number((await env.INBOX.get(key)) ?? 0);
  if (n >= limit) return true;
  await env.INBOX.put(key, String(n + 1), { expirationTtl: 7200 });
  return false;
}

async function submit(req: Request, env: Env, deps: Deps): Promise<Response> {
  if (!same(bearer(req), env.SUBMIT_TOKEN)) return json({ error: "unauthorized" }, 401);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const sharedText = typeof body.text === "string" ? body.text.trim() : "";
  let title = typeof body.title === "string" ? body.title.trim() : "";
  const source = body.source === "screen" ? "screen" : "share";

  // Share sheets often put the URL inside text ("Title\nhttps://..."), so recover it.
  let pageUrl = url;
  if (!pageUrl) { const m = sharedText.match(/https?:\/\/\S+/); if (m && sharedText.replace(m[0], "").trim().length < 200) pageUrl = m[0]; }
  if (pageUrl && !isHttpUrl(pageUrl)) return json({ error: "url must be http(s)" }, 400);
  if (!pageUrl && !sharedText) return json({ error: "send url or text" }, 400);
  if (await rateLimited(env, deps.now())) return json({ error: "rate limited" }, 429);

  let text = "";
  let isSelection = false;
  try {
    if (sharedText.length >= 200 && !(pageUrl && sharedText.includes(pageUrl) && sharedText.length < 200)) {
      // Real text from the phone (e.g. a selection or screen read) beats refetching.
      text = sharedText;
      isSelection = true;
    } else if (pageUrl) {
      const page = await deps.fetchPage(pageUrl);
      text = page.text; title ||= page.title;
    } else {
      return json({ error: "text too short to make cards from" }, 400);
    }
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 422);
  }
  text = text.slice(0, MAX_TEXT);
  if (source === "screen") text = "[This text was read off a phone screen; ignore navigation, buttons, ads and other interface text.]\n\n" + text;
  title ||= text.slice(0, 60);

  try {
    const r = await deps.generate(
      { title, url: pageUrl || "phone screen", text, isSelection },
      { apiKey: env.ANTHROPIC_API_KEY, model: env.MODEL ?? "claude-sonnet-5-5", maxClusters: Number(env.MAX_CLUSTERS ?? 5), chunkChars: 100_000 },
    );
    if (!r.set.clusters.length) return json({ error: "nothing worth carding in that content" }, 422);
    const item: InboxItem = { id: deps.id(), title: r.set.topic || title, url: pageUrl || "https://remnote.com", markdown: renderForPlugin(r.set), createdAt: deps.now() };
    await env.INBOX.put(`inbox:${item.id}`, JSON.stringify(item), { expirationTtl: TTL });
    return json({ ok: true, id: item.id, title: item.title, clusters: r.set.clusters.length, warnings: r.issues.length });
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 502);
  }
}

async function inbox(req: Request, env: Env): Promise<Response> {
  if (!same(bearer(req), env.PULL_TOKEN)) return json({ error: "unauthorized" }, 401);
  const { keys } = await env.INBOX.list({ prefix: "inbox:" });
  const items: InboxItem[] = [];
  for (const k of keys.slice(0, 20)) {
    const v = await env.INBOX.get(k.name);
    if (v) items.push(JSON.parse(v));
  }
  items.sort((a, b) => a.createdAt - b.createdAt);
  return json({ items });
}

async function ack(req: Request, env: Env): Promise<Response> {
  if (!same(bearer(req), env.PULL_TOKEN)) return json({ error: "unauthorized" }, 401);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string" && /^[\w-]{1,64}$/.test(x)) : [];
  for (const id of ids) await env.INBOX.delete(`inbox:${id}`);
  return json({ ok: true, deleted: ids.length });
}

export async function handle(req: Request, env: Env, deps: Deps = defaultDeps): Promise<Response> {
  const { pathname } = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method === "GET" && pathname === "/health") return json({ ok: true });
  if (req.method === "POST" && pathname === "/submit") return submit(req, env, deps);
  if (req.method === "GET" && pathname === "/inbox") return inbox(req, env);
  if (req.method === "POST" && pathname === "/ack") return ack(req, env);
  return json({ error: "not found" }, 404);
}

export default { fetch: (req: Request, env: Env) => handle(req, env) };

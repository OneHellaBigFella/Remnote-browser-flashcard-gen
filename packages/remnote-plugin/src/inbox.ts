import { importIntoDailyDoc, type PluginLike, type ImportPayload } from "./importer";

export interface InboxConfig { workerUrl: string; pullToken: string }
export interface InboxItem extends ImportPayload { id: string }
export interface InboxResult { imported: number; failed: number; error?: string }

/** Persistence for already-imported ids, so a failed ack never creates duplicates. */
export interface SeenStore { get(): Promise<string[]>; set(ids: string[]): Promise<void> }

/** Pull finished cards from the Worker, write each into today's Daily Doc, then ack the ones that landed. */
export async function pollInbox(
  plugin: PluginLike,
  cfg: InboxConfig,
  seen: SeenStore,
  fetcher: typeof fetch = fetch,
): Promise<InboxResult> {
  const base = cfg.workerUrl.trim().replace(/\/+$/, "");
  if (!base || !cfg.pullToken) return { imported: 0, failed: 0, error: "not-configured" };
  const auth = { authorization: "Bearer " + cfg.pullToken };
  let items: InboxItem[];
  try {
    const r = await fetcher(base + "/inbox", { headers: auth });
    if (!r.ok) return { imported: 0, failed: 0, error: r.status === 401 ? "bad-token" : "http-" + r.status };
    items = ((await r.json()) as { items?: InboxItem[] }).items ?? [];
  } catch (e: any) {
    return { imported: 0, failed: 0, error: "network: " + (e?.message ?? e) };
  }

  const done = new Set(await seen.get());
  const toAck: string[] = [];
  let imported = 0, failed = 0;
  for (const it of items) {
    if (!it || typeof it.id !== "string" || typeof it.markdown !== "string") continue;
    if (!done.has(it.id)) {
      try {
        await importIntoDailyDoc(plugin, { title: it.title ?? it.url, url: it.url, markdown: it.markdown });
        done.add(it.id);
        imported++;
      } catch {
        failed++;
        continue;
      }
    }
    toAck.push(it.id);
  }
  await seen.set([...done].slice(-300));
  if (toAck.length) {
    try {
      await fetcher(base + "/ack", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ ids: toAck }) });
    } catch { /* items stay in the inbox; seen-set prevents duplicates next poll */ }
  }
  return { imported, failed };
}

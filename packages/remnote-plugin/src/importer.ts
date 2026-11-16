/** Pure import logic, separated from the RemNote runtime so it can be unit-tested with a fake plugin. */
export interface PluginLike {
  date: { getTodaysDoc(): Promise<{ _id: string } | undefined> };
  rem: {
    createSingleRemWithMarkdown(md: string, parentId?: string): Promise<{ _id: string } | undefined>;
    createTreeWithMarkdown(md: string, parentId?: string): Promise<unknown[]>;
  };
}
export interface ImportPayload {
  title: string;
  url: string;
  /** Indented RemNote block, e.g. "- Topic =- model\n  - Concept :< def\n    - prompt ;; answer" */
  markdown: string;
}

/** Writes `📥 title` (link) under today's doc, then the card tree under it. Returns the source rem id. */
export async function importIntoDailyDoc(plugin: PluginLike, p: ImportPayload): Promise<string> {
  const today = await plugin.date.getTodaysDoc();
  if (!today) throw new Error("Could not find today's Daily Document - open RemNote's Daily Document once and retry");
  const safeTitle = p.title.replace(/[\[\]()]/g, "").slice(0, 120) || p.url;
  const source = await plugin.rem.createSingleRemWithMarkdown(`📥 [${safeTitle}](${p.url})`, today._id);
  if (!source) throw new Error("RemNote refused to create the source rem");
  await plugin.rem.createTreeWithMarkdown(p.markdown, source._id);
  return source._id;
}

export function isPayload(x: any): x is ImportPayload {
  return x && typeof x.title === "string" && typeof x.url === "string" && typeof x.markdown === "string" && x.markdown.length < 2_000_000;
}

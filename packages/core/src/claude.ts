import Anthropic from "@anthropic-ai/sdk";
import { CARD_SET_SCHEMA } from "./schema";
import { SYSTEM_PROMPT, userPrompt, REPAIR_PROMPT } from "./prompt";
import { validate, hasErrors, formatIssues } from "./validate";
import type { CardSet, Issue } from "./types";

export const MODELS = {
  "claude-opus-5-5": "Claude Opus 5.5 (best quality)",
  "claude-sonnet-5-5": "Claude Sonnet 5.5 (balanced)",
  "claude-haiku-5-5": "Claude Haiku 5.5 (cheapest)",
} as const;

export interface GenerateInput {
  title: string;
  url: string;
  text: string;
  isSelection?: boolean;
}
export interface GenerateOptions {
  apiKey: string;
  model?: string;
  effort?: "low" | "medium" | "high";
  maxClusters?: number;
  /** Characters per request; longer pages are split on paragraph boundaries, never truncated. */
  chunkChars?: number;
  /** Test seam. */
  createMessage?: (params: any) => Promise<any>;
}
export interface GenerateResult {
  set: CardSet;
  issues: Issue[];
  usage: { input: number; output: number };
}

export function chunkText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let cur = "";
  for (const para of text.split(/\n{2,}/)) {
    if (cur && cur.length + para.length + 2 > max) { out.push(cur); cur = ""; }
    // a single paragraph larger than max is split hard on whitespace
    let p = para;
    while (p.length > max) { const cut = p.lastIndexOf(" ", max) > 0 ? p.lastIndexOf(" ", max) : max; out.push(p.slice(0, cut)); p = p.slice(cut); }
    cur = cur ? cur + "\n\n" + p : p;
  }
  if (cur) out.push(cur);
  return out;
}

function makeCaller(opts: GenerateOptions) {
  if (opts.createMessage) return opts.createMessage;
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });
  const useFallback = !(opts.model ?? "").includes("haiku");
  return async (params: any) => {
    const body: any = { ...params };
    let stream: any;
    if (useFallback) {
      body.betas = ["server-side-fallback-2026-07-01"];
      body.fallbacks = "default";
      stream = (client as any).beta.messages.stream(body);
    } else {
      stream = (client as any).messages.stream(body);
    }
    return stream.finalMessage();
  };
}

function parseResponse(msg: any): CardSet {
  if (msg.stop_reason === "refusal") throw new Error("Claude declined this content (" + (msg.stop_details?.category ?? "refusal") + ")");
  if (msg.stop_reason === "max_tokens") throw new Error("Response was cut off; try a smaller selection or fewer clusters");
  const block = (msg.content ?? []).find((b: any) => b.type === "text");
  if (!block) throw new Error("No text in response");
  const raw = JSON.parse(block.text);
  return {
    topic: String(raw.topic ?? ""),
    scaffold: String(raw.scaffold ?? ""),
    clusters: Array.isArray(raw.clusters) ? raw.clusters : [],
    gaps: Array.isArray(raw.gaps) ? raw.gaps : [],
    scenarioNotes: Array.isArray(raw.scenarioNotes) ? raw.scenarioNotes : [],
  };
}

export async function generateCards(input: GenerateInput, opts: GenerateOptions): Promise<GenerateResult> {
  const model = opts.model ?? "claude-opus-5-5";
  const call = makeCaller({ ...opts, model });
  const usage = { input: 0, output: 0 };
  const base = (messages: any[]) => ({
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort ?? "medium", format: { type: "json_schema", schema: CARD_SET_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages,
  });
  const track = (m: any) => { usage.input += m.usage?.input_tokens ?? 0; usage.output += m.usage?.output_tokens ?? 0; };

  const chunks = chunkText(input.text, opts.chunkChars ?? 150_000);
  const merged: CardSet = { topic: "", scaffold: "", clusters: [], gaps: [], scenarioNotes: [] };
  for (const chunk of chunks) {
    const first = [{ role: "user", content: userPrompt({ ...input, text: chunk, maxClusters: opts.maxClusters ?? 5, isSelection: !!input.isSelection }) }];
    const msg = await call(base(first));
    track(msg);
    let set = parseResponse(msg);
    let issues = validate(set);
    if (hasErrors(issues)) {
      // one repair pass; keep the original conversation so thinking blocks stay valid
      const msg2 = await call(base([...first, { role: "assistant", content: msg.content }, { role: "user", content: REPAIR_PROMPT(formatIssues(issues.filter((i) => i.severity === "error"))) }]));
      track(msg2);
      set = parseResponse(msg2);
      issues = validate(set);
    }
    merged.topic ||= set.topic;
    merged.scaffold ||= set.scaffold;
    merged.clusters.push(...set.clusters);
    merged.gaps.push(...set.gaps);
    merged.scenarioNotes.push(...set.scenarioNotes);
  }
  if (!merged.topic) merged.topic = input.title;
  return { set: merged, issues: validate(merged), usage };
}

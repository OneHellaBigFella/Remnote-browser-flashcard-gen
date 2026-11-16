import type { CardSet, Issue } from "./types";

export const MAX_ANSWER_WORDS = 15;
export const MAX_DEFINITION_WORDS = 20;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const YESNO_START = /^(is|are|was|were|do|does|did|can|could|will|would|should|has|have|had)\b/i;
const YESNO_ANSWER = /^(yes|no|true|false)\b[.!]?$/i;
const FORBIDDEN = /(::|;;|>>|<<|=-|;-|\{\{|\}\}|\n)/;
const SOURCE_REF = /\b(the (article|author|page|lecture|video|text|passage)|according to|as mentioned|in this (article|page))\b/i;
const OR_FRAME = /\b\w+ or \w+\?$/i;

/** Rough count of items in an inline list: separators , ; and "and"/"or". */
export function listItemCount(answer: string): number {
  const parts = answer.split(/,|;|\band\b|\bor\b/i).map((p) => p.trim()).filter(Boolean);
  return parts.length;
}

export function validate(set: CardSet): Issue[] {
  const issues: Issue[] = [];
  const push = (severity: Issue["severity"], rule: number, where: string, message: string) =>
    issues.push({ severity, rule, where, message });

  set.clusters.forEach((c, ci) => {
    const cw = `cluster ${ci + 1} "${c.concept}"`;
    for (const [label, text] of [["concept", c.concept], ["definition", c.definition]] as const) {
      if (FORBIDDEN.test(text)) push("error", 0, cw, `${label} contains a RemNote delimiter or newline`);
      if (SOURCE_REF.test(text)) push("error", 3, cw, `${label} references the source`);
    }
    if (words(c.definition) > MAX_DEFINITION_WORDS)
      push("error", 2, cw, `definition is ${words(c.definition)} words (max ${MAX_DEFINITION_WORDS})`);
    if (c.direction === "both" && words(c.definition) > 5)
      push("warn", 2, cw, `bidirectional concept with a long definition; use backward-only`);

    if (c.descriptors.length < 3) push("warn", 8, cw, `only ${c.descriptors.length} descriptors (aim for 3-5, anti-orphan)`);
    if (c.descriptors.length > 6) push("warn", 8, cw, `${c.descriptors.length} descriptors; trim to the most valuable`);
    if (!c.descriptors.some((d) => d.kind === "scenario" || d.kind === "counterfactual"))
      push("warn", 6, cw, `no scenario or counterfactual prompt`);

    const seen = new Set<string>();
    c.descriptors.forEach((d, di) => {
      const w = `${cw} / #${di + 1} "${d.prompt}"`;
      if (!d.prompt.trim() || !d.answer.trim()) push("error", 3, w, "empty prompt or answer");
      if (FORBIDDEN.test(d.prompt) || FORBIDDEN.test(d.answer)) push("error", 0, w, "contains a RemNote delimiter or newline");
      if (words(d.answer) > MAX_ANSWER_WORDS) push("error", 2, w, `answer is ${words(d.answer)} words (max ${MAX_ANSWER_WORDS})`);
      if (YESNO_ANSWER.test(d.answer.trim())) push("error", 4, w, "yes/no answer");
      if (YESNO_START.test(d.prompt.trim()) && !/^(why|how|which|what)\b/i.test(d.prompt)) push("error", 4, w, "yes/no style prompt");
      if (OR_FRAME.test(d.prompt.trim())) push("error", 4, w, "two-option frame");
      if (SOURCE_REF.test(d.prompt) || SOURCE_REF.test(d.answer)) push("error", 3, w, "references the source");
      if (d.prompt.toLowerCase().includes(c.concept.toLowerCase()) && c.concept.length > 3 && d.kind === "descriptor")
        push("warn", 3, w, "prompt repeats the parent concept (RemNote already shows it)");
      const n = listItemCount(d.answer);
      if (n > 3 && !/\(\d\)|\bcount\b/i.test(d.prompt)) push("error", 10, w, `answer lists ~${n} items (max 3 unordered)`);
      const key = d.prompt.trim().toLowerCase();
      if (seen.has(key)) push("error", 2, w, "duplicate prompt");
      seen.add(key);
    });
  });
  return issues;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.severity === "error");
export const formatIssues = (issues: Issue[]) =>
  issues.map((i) => `- [${i.severity}] Rule ${i.rule} @ ${i.where}: ${i.message}`).join("\n");

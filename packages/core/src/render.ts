import type { CardSet, Cluster, Descriptor } from "./types";

const CONCEPT_DELIM = { both: "::", forward: ":>", backward: ":<" } as const;
const PREFIX: Record<Descriptor["kind"], string> = {
  descriptor: "",
  basic: "",
  scenario: "Scenario: ",
  counterfactual: "Counterfactual: ",
  contrast: "Contrast: ",
};
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export function renderDescriptor(d: Descriptor): string {
  const prompt = PREFIX[d.kind] + clean(d.prompt);
  return `${prompt} ${d.kind === "basic" ? ">>" : ";;"} ${clean(d.answer)}`;
}

export function renderCluster(c: Cluster, indent = "  "): string[] {
  const lines = [`${indent}- ${clean(c.concept)} ${CONCEPT_DELIM[c.direction]} ${clean(c.definition)}`];
  for (const d of c.descriptors) lines.push(`${indent}  - ${renderDescriptor(d)}`);
  return lines;
}

/** Indented RemNote paste block: `Topic =- scaffold` (no card) with concept clusters nested under it. */
export function renderCardSet(set: CardSet): string {
  const lines = [`- ${clean(set.topic)} =- ${clean(set.scaffold)}`];
  for (const c of set.clusters) lines.push(...renderCluster(c));
  return lines.join("\n");
}

/** Markdown the plugin turns into rems: top-level bullets are children of the source rem. */
export function renderForPlugin(set: CardSet): string {
  return renderCardSet(set);
}

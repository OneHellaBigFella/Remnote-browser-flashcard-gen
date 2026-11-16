export type Direction = "both" | "forward" | "backward";
export type DescriptorKind = "descriptor" | "scenario" | "counterfactual" | "contrast" | "basic";

export interface Descriptor {
  kind: DescriptorKind;
  /** Attribute / question text (no delimiters, no "Scenario:" prefix - the renderer adds it). */
  prompt: string;
  answer: string;
}

export interface Cluster {
  concept: string;
  definition: string;
  /** Concept card direction: "backward" (:<) for long definitions, "both" (::) for short symmetric ones. */
  direction: Direction;
  descriptors: Descriptor[];
}

export interface CardSet {
  /** Short topic header for the scaffold rem. */
  topic: string;
  /** One-sentence mental model (non-tested). */
  scaffold: string;
  clusters: Cluster[];
  /** Material the page gestured at but never taught. */
  gaps: string[];
  /** Scenarios the model wrote that apply taught definitions (for user veto). */
  scenarioNotes: string[];
}

export interface Issue {
  severity: "error" | "warn";
  rule: number;
  where: string;
  message: string;
}
